/**
 * x402 Autonomous Agent Client SDK
 * Enables AI agents to discover, negotiate, and settle x402 microtransactions on Base Mainnet.
 */

import { createWalletClient, createPublicClient, http, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

export const BASE_USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const SERVICE_PAYEE_WALLET = "0x3028C30B8c8985Bd54669BC313Fe7950fCeB1142";
export const DEFAULT_SERVICE_URL = "https://x402-agent-service.vercel.app";

const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  }
];

export class X402AgentClient {
  /**
   * @param {Object} options
   * @param {string} [options.baseUrl] - Base URL of the x402 service
   * @param {string} [options.privateKey] - Hex string private key for autonomous Base settlement
   * @param {string} [options.rpcUrl] - Base JSON-RPC URL (defaults to https://mainnet.base.org)
   * @param {string} [options.bypassSecret] - Optional test bypass secret for zero-gas CI/dry-run
   */
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || process.env.X402_SERVICE_URL || DEFAULT_SERVICE_URL).replace(/\/$/, "");
    this.privateKey = options.privateKey || process.env.BASE_PRIVATE_KEY || null;
    this.rpcUrl = options.rpcUrl || process.env.BASE_RPC_URL || "https://mainnet.base.org";
    this.bypassSecret = options.bypassSecret || process.env.X402_TEST_BYPASS_SECRET || null;
  }

  /**
   * Fetch protocol manifest from /.well-known/x402
   */
  async getManifest() {
    const res = await fetch(`${this.baseUrl}/.well-known/x402`);
    if (!res.ok) {
      throw new Error(`Failed to fetch manifest: HTTP ${res.status}`);
    }
    return await res.json();
  }

  /**
   * Fetch service health status
   */
  async getHealth() {
    const res = await fetch(`${this.baseUrl}/api/health`);
    if (!res.ok) {
      throw new Error(`Failed to fetch health: HTTP ${res.status}`);
    }
    return await res.json();
  }

  /**
   * Execute an on-chain USDC transfer on Base Mainnet to fulfill a 402 challenge
   * @param {Object} challenge - Payment challenge object returned in 402 response
   * @param {string} [privateKey] - Optional private key override
   */
  async executeOnChainPayment(challenge, privateKey) {
    const key = privateKey || this.privateKey;
    if (!key) {
      throw new Error("Cannot execute on-chain payment: No privateKey provided to client.");
    }

    const formattedKey = key.startsWith('0x') ? key : `0x${key}`;
    const account = privateKeyToAccount(formattedKey);

    const publicClient = createPublicClient({
      chain: base,
      transport: http(this.rpcUrl)
    });

    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(this.rpcUrl)
    });

    const recipient = challenge.recipient || challenge.payee || SERVICE_PAYEE_WALLET;
    const tokenContract = challenge.tokenAddress || BASE_USDC_CONTRACT;
    const amount = BigInt(challenge.amountUnits);

    // Prepare ERC20 transfer data
    const txHash = await walletClient.sendTransaction({
      to: tokenContract,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [recipient, amount]
      })
    });

    // Wait for on-chain inclusion
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    return txHash;
  }

  /**
   * Universal x402 payment execution and request cycle
   * Handles: Unpaid call -> 402 challenge -> on-chain Base settlement / bypass -> 200 fulfillment
   * @param {string} endpointPath
   * @param {Object} body
   * @param {Object} [callOptions]
   */
  async callWithX402(endpointPath, body = {}, callOptions = {}) {
    const targetUrl = `${this.baseUrl}${endpointPath.startsWith('/') ? '' : '/'}${endpointPath}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(callOptions.headers || {})
    };

    // If caller explicitly gave a pre-paid txHash
    if (callOptions.txHash && !callOptions.simulateOnly) {
      headers['X-PAYMENT'] = callOptions.txHash;
    }

    // If caller provided bypass key (and not simulating challenge)
    const bypass = callOptions.bypassSecret || this.bypassSecret;
    if (bypass && !headers['X-PAYMENT'] && !callOptions.simulateOnly) {
      headers['X-Test-Payment-Bypass'] = bypass;
    }

    // Initial Request
    let response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (response.status === 200) {
      const data = await response.json();
      return {
        status: 200,
        fulfilled: true,
        data
      };
    }

    // If challenge returned
    if (response.status === 402) {
      const challengeBody = await response.json();
      const paymentChallenge = challengeBody.payment || {};

      // If dry-run / simulate requested
      if (callOptions.simulateOnly) {
        return {
          status: 402,
          simulated: true,
          challenge: paymentChallenge,
          instructions: paymentChallenge.instructions
        };
      }

      // If we have a private key, settle autonomously on Base Mainnet
      const activeKey = callOptions.privateKey || this.privateKey;
      if (activeKey) {
        const txHash = await this.executeOnChainPayment(paymentChallenge, activeKey);
        
        // Retry with payment proof header
        headers['X-PAYMENT'] = txHash;
        delete headers['X-Test-Payment-Bypass'];

        response = await fetch(targetUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });

        if (response.ok) {
          const paidData = await response.json();
          return {
            status: 200,
            fulfilled: true,
            txHash,
            data: paidData
          };
        } else {
          const errData = await response.json().catch(() => ({}));
          throw new Error(`Payment submitted (${txHash}) but service returned ${response.status}: ${JSON.stringify(errData)}`);
        }
      }

      // No private key available to pay
      return {
        status: 402,
        fulfilled: false,
        error: "PAYMENT_REQUIRED",
        challenge: paymentChallenge,
        message: "Payment required. Provide 'txHash' or set 'privateKey' on client to settle automatically."
      };
    }

    // Other HTTP error
    const errorJson = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorJson)}`);
  }

  /**
   * Call Crossword Generator ($0.50 USDC)
   */
  async generateCrossword(params = {}, options = {}) {
    return await this.callWithX402('/api/crossword/generate', {
      theme: params.theme || "Decentralized Systems & AI",
      difficulty: params.difficulty || "medium"
    }, options);
  }

  /**
   * Call Fast Email & MAP Validator ($0.25 USDC)
   */
  async verifyEmail(params = {}, options = {}) {
    if (!params.email) {
      throw new Error("Missing required parameter: 'email'");
    }
    return await this.callWithX402('/api/verify/email', {
      email: params.email,
      checkMx: params.checkMx !== undefined ? params.checkMx : true
    }, options);
  }
}
