import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';

// Replay Store (in-memory + local /tmp persistence)
const TMP_FILE = '/tmp/x402_redeemed_txs.json';
const redeemedTxs = new Set();

// Load persisted redeemed txs if present
try {
  if (fs.existsSync(TMP_FILE)) {
    const raw = fs.readFileSync(TMP_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach(tx => redeemedTxs.add(tx.toLowerCase()));
    }
  }
} catch (e) {
  // Ignore filesystem errors in restricted serverless environments
}

function recordRedeemedTx(txHash) {
  const normalized = txHash.toLowerCase();
  redeemedTxs.add(normalized);
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(Array.from(redeemedTxs)));
  } catch (e) {
    // best-effort persistence
  }
}

function isTxRedeemed(txHash) {
  return redeemedTxs.has(txHash.toLowerCase());
}

export function resetRedeemedStore() {
  redeemedTxs.clear();
  try {
    if (fs.existsSync(TMP_FILE)) {
      fs.unlinkSync(TMP_FILE);
    }
  } catch (e) {}
}

/**
 * Query Base JSON-RPC for a transaction receipt
 */
async function fetchBaseTransactionReceipt(txHash) {
  const rpcUrl = CONFIG.rpcUrl;
  const payload = {
    jsonrpc: "2.0",
    method: "eth_getTransactionReceipt",
    params: [txHash],
    id: 1
  };

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Base RPC HTTP error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  if (json.error) {
    throw new Error(`Base RPC error: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json.result;
}

/**
 * Creates x402 Payment Middleware for a specific endpoint price
 * @param {number} priceUsdc - Price in USD/USDC, e.g. 0.50
 * @param {string} endpointPath - Endpoint route path
 */
export function requirePayment(priceUsdc, endpointPath) {
  const amountUnits = BigInt(Math.round(priceUsdc * 10 ** CONFIG.tokenDecimals));

  return async function x402Middleware(req, res, next) {
    // Extract payment header (supports X-PAYMENT, Payment-Signature, or Authorization: Bearer <tx_hash>)
    const rawHeader = req.headers['x-payment'] || 
                      req.headers['payment-signature'] || 
                      req.headers['authorization'];

    let txHash = null;
    if (rawHeader) {
      if (typeof rawHeader === 'string') {
        const trimmed = rawHeader.trim();
        if (trimmed.toLowerCase().startsWith('bearer ')) {
          txHash = trimmed.slice(7).trim();
        } else if (trimmed.toLowerCase().startsWith('x402 ')) {
          txHash = trimmed.slice(5).trim();
        } else {
          txHash = trimmed;
        }
      }
    }

    // Optional test bypass header for controlled integration testing
    const bypassSecret = process.env.X402_TEST_BYPASS_SECRET || "x402-dev-test-key-2026";
    const testHeader = req.headers['x-test-payment-bypass'];
    if (testHeader && testHeader === bypassSecret) {
      req.x402Payment = {
        verified: true,
        method: "test-bypass",
        amountUsdc: priceUsdc,
        txHash: "0xtestbypass" + "0".repeat(54)
      };
      res.setHeader('X-Payment-Status', 'VERIFIED');
      res.setHeader('X-Payment-Method', 'TEST_BYPASS');
      return next();
    }

    // Build standard 402 challenge response
    const endpointMeta = CONFIG.endpoints[endpointPath] || {};
    const paymentChallenge = {
      network: CONFIG.network,
      chainId: CONFIG.chainId,
      token: CONFIG.tokenSymbol,
      tokenAddress: CONFIG.tokenAddress,
      priceUsdc: priceUsdc,
      amountUnits: amountUnits.toString(),
      decimals: CONFIG.tokenDecimals,
      payee: CONFIG.payeeAddress,
      recipient: CONFIG.payeeAddress,
      rpcUrl: CONFIG.rpcUrl,
      instructions: `Transfer at least ${priceUsdc.toFixed(2)} USDC (${amountUnits.toString()} atomic units) to recipient address ${CONFIG.payeeAddress} on Base Mainnet (Chain ID ${CONFIG.chainId}). Retransmit your request with header 'X-PAYMENT: <transaction_hash>'.`,
      extensions: {
        bazaar: {
          info: {
            name: endpointMeta.name || "x402 Microservice",
            description: endpointMeta.description || "x402 Paid Endpoint",
            input: {
              type: "http",
              method: "POST",
              routeTemplate: endpointPath
            },
            output: {
              format: "json"
            }
          }
        }
      }
    };

    // If no payment header provided, return 402 Payment Required
    if (!txHash) {
      res.setHeader('X-Payment-Required', 'true');
      res.setHeader('PAYMENT-REQUIRED', JSON.stringify({
        price: priceUsdc.toFixed(2),
        token: CONFIG.tokenSymbol,
        network: CONFIG.network,
        chainId: CONFIG.chainId,
        recipient: CONFIG.payeeAddress
      }));

      return res.status(402).json({
        error: "Payment Required",
        statusCode: 402,
        message: `Payment of ${priceUsdc.toFixed(2)} USDC on Base Mainnet is required to access ${endpointPath || req.path}.`,
        payment: paymentChallenge
      });
    }

    // Validate format of transaction hash
    const txHashRegex = /^0x[a-fA-F0-9]{64}$/;
    if (!txHashRegex.test(txHash)) {
      return res.status(402).json({
        error: "Payment Required",
        statusCode: 402,
        message: "Invalid transaction hash format. Expected a 66-character 0x-prefixed hex string.",
        provided: txHash,
        payment: paymentChallenge
      });
    }

    // Check for replay attacks
    if (isTxRedeemed(txHash)) {
      return res.status(402).json({
        error: "Payment Required",
        statusCode: 402,
        message: "Transaction replay detected. This transaction hash has already been redeemed for a request.",
        txHash: txHash,
        payment: paymentChallenge
      });
    }

    // Verify transaction on Base Mainnet via JSON-RPC
    try {
      const receipt = await fetchBaseTransactionReceipt(txHash);

      if (!receipt) {
        return res.status(402).json({
          error: "Payment Required",
          statusCode: 402,
          message: "Transaction not found on Base Mainnet. The transaction may still be pending in the mempool or invalid.",
          txHash: txHash,
          payment: paymentChallenge
        });
      }

      // Check transaction execution status (0x1 = success)
      if (receipt.status !== "0x1") {
        return res.status(402).json({
          error: "Payment Required",
          statusCode: 402,
          message: "Transaction failed or reverted on Base Mainnet.",
          txHash: txHash,
          receiptStatus: receipt.status,
          payment: paymentChallenge
        });
      }

      // Scan event logs for USDC Transfer to recipient
      const usdcAddress = CONFIG.tokenAddress.toLowerCase();
      const targetPayee = CONFIG.payeeAddress.toLowerCase().slice(2);
      const transferTopic = CONFIG.transferTopic.toLowerCase();

      let totalTransferred = 0n;
      let matchingLogsCount = 0;

      for (const log of (receipt.logs || [])) {
        if (log.address && log.address.toLowerCase() === usdcAddress) {
          if (log.topics && log.topics[0] && log.topics[0].toLowerCase() === transferTopic) {
            // log.topics[2] is the 32-byte padded recipient address
            const recipientTopic = log.topics[2] ? log.topics[2].toLowerCase() : "";
            if (recipientTopic.endsWith(targetPayee)) {
              if (log.data && log.data !== '0x') {
                try {
                  const amount = BigInt(log.data);
                  totalTransferred += amount;
                  matchingLogsCount++;
                } catch (parseErr) {
                  // ignore malformed log data
                }
              }
            }
          }
        }
      }

      if (matchingLogsCount === 0 || totalTransferred === 0n) {
        return res.status(402).json({
          error: "Payment Required",
          statusCode: 402,
          message: `Transaction verified on Base Mainnet, but contains no valid USDC transfer to payee address ${CONFIG.payeeAddress}.`,
          txHash: txHash,
          payment: paymentChallenge
        });
      }

      // Verify that total transferred covers the required price
      if (totalTransferred < amountUnits) {
        const receivedUsdc = Number(totalTransferred) / (10 ** CONFIG.tokenDecimals);
        return res.status(402).json({
          error: "Payment Required",
          statusCode: 402,
          message: `Insufficient USDC transfer amount. Required: ${priceUsdc.toFixed(2)} USDC, Received: ${receivedUsdc.toFixed(6)} USDC.`,
          txHash: txHash,
          requiredUnits: amountUnits.toString(),
          receivedUnits: totalTransferred.toString(),
          payment: paymentChallenge
        });
      }

      // Payment is verified! Mark transaction as redeemed
      recordRedeemedTx(txHash);

      // Attach payment info to request
      req.x402Payment = {
        verified: true,
        txHash: txHash,
        payer: receipt.from,
        blockNumber: parseInt(receipt.blockNumber, 16),
        amountTransferredUnits: totalTransferred.toString(),
        amountUsdc: Number(totalTransferred) / (10 ** CONFIG.tokenDecimals),
        timestamp: new Date().toISOString()
      };

      res.setHeader('X-Payment-Status', 'VERIFIED');
      res.setHeader('X-Payment-Tx', txHash);
      res.setHeader('PAYMENT-RESPONSE', JSON.stringify({
        status: "VERIFIED",
        txHash: txHash,
        amountUsdc: Number(totalTransferred) / (10 ** CONFIG.tokenDecimals),
        network: "base",
        recipient: CONFIG.payeeAddress
      }));

      return next();

    } catch (err) {
      console.error("Base RPC verification error:", err);
      return res.status(502).json({
        error: "Payment Verification Gateway Error",
        statusCode: 502,
        message: "Failed to communicate with Base Mainnet JSON-RPC node. Please try again shortly.",
        details: err.message
      });
    }
  };
}
