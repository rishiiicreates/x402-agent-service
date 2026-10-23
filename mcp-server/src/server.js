/**
 * Model Context Protocol (MCP) Server for x402 Base Mainnet Service
 * Enables Claude Desktop, Cursor, Zed, Windsurf, LangChain, and autonomous agents
 * to seamlessly discover, simulate, pay for, and consume x402-gated APIs.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { X402AgentClient, BASE_USDC_CONTRACT, SERVICE_PAYEE_WALLET, DEFAULT_SERVICE_URL } from './client.js';

export function createX402McpServer(options = {}) {
  const client = new X402AgentClient({
    baseUrl: options.baseUrl || process.env.X402_SERVICE_URL || DEFAULT_SERVICE_URL,
    privateKey: options.privateKey || process.env.BASE_PRIVATE_KEY,
    rpcUrl: options.rpcUrl || process.env.BASE_RPC_URL || "https://mainnet.base.org",
    bypassSecret: options.bypassSecret || process.env.X402_TEST_BYPASS_SECRET
  });

  const server = new McpServer({
    name: "x402-agent-service",
    version: "1.0.0",
    description: "Production x402-compliant API gateway accepting Base USDC micropayments"
  });

  // Tool 1: Discover Service & Pricing Info
  server.tool(
    "x402_get_service_info",
    "Inspect x402 protocol manifest, available endpoints, prices, token contract, and recipient wallet.",
    {},
    async () => {
      try {
        const manifest = await client.getManifest();
        const health = await client.getHealth();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                service: manifest.name,
                description: manifest.description,
                status: health.status,
                network: manifest.network,
                chainId: manifest.chainId,
                payeeWallet: manifest.payee.address,
                paymentAsset: manifest.token,
                endpoints: manifest.endpoints,
                bazaarDiscovery: manifest.extensions?.bazaar
              }, null, 2)
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error fetching x402 service info: ${err.message}` }]
        };
      }
    }
  );

  // Tool 2: Simulate Payment Challenge
  server.tool(
    "x402_simulate_challenge",
    "Dry-run / simulate calling an endpoint to inspect the exact HTTP 402 Payment Required challenge and payment instructions without spending funds.",
    {
      endpoint: z.enum(["crossword", "email"]).describe("Endpoint to simulate: 'crossword' ($0.50 USDC) or 'email' ($0.25 USDC)")
    },
    async ({ endpoint }) => {
      try {
        const path = endpoint === "crossword" ? "/api/crossword/generate" : "/api/verify/email";
        const sampleBody = endpoint === "crossword" 
          ? { theme: "Decentralized Systems & AI" } 
          : { email: "satoshinakamoto@gmx.com" };

        const simResult = await client.callWithX402(path, sampleBody, { simulateOnly: true });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(simResult, null, 2)
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error simulating challenge: ${err.message}` }]
        };
      }
    }
  );

  // Tool 3: Generate Crossword ($0.50 USDC)
  server.tool(
    "x402_generate_crossword",
    "Generate dynamic crossword puzzle grid with progressive clues and rebus cells ($0.50 USDC on Base Mainnet). Requires txHash, configured privateKey, or bypassSecret.",
    {
      theme: z.string().optional().describe("Theme for the puzzle (e.g. 'Decentralized Systems & AI', 'Cryptographic Proofs')"),
      difficulty: z.enum(["easy", "medium", "hard"]).optional().describe("Difficulty level (default: medium)"),
      txHash: z.string().optional().describe("Pre-paid Base transaction hash for X-PAYMENT header (0x-prefixed 66 chars)"),
      privateKey: z.string().optional().describe("Base private key to automatically sign & pay 0.50 USDC"),
      bypassSecret: z.string().optional().describe("Development test bypass secret for zero-gas test runs")
    },
    async ({ theme, difficulty, txHash, privateKey, bypassSecret }) => {
      try {
        const result = await client.generateCrossword(
          { theme, difficulty },
          { txHash, privateKey, bypassSecret }
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `x402 Crossword call failed: ${err.message}` }]
        };
      }
    }
  );

  // Tool 4: Fast Email & MAP Validator ($0.25 USDC)
  server.tool(
    "x402_verify_email",
    "Validate email syntax according to RFC 5322 & MAP specifications with live DNS MX host lookup ($0.25 USDC on Base Mainnet).",
    {
      email: z.string().describe("Email address to validate"),
      checkMx: z.boolean().optional().describe("Whether to query DNS MX records for domain deliverability (default: true)"),
      txHash: z.string().optional().describe("Pre-paid Base transaction hash for X-PAYMENT header"),
      privateKey: z.string().optional().describe("Base private key to automatically sign & pay 0.25 USDC"),
      bypassSecret: z.string().optional().describe("Development test bypass secret for zero-gas test runs")
    },
    async ({ email, checkMx, txHash, privateKey, bypassSecret }) => {
      try {
        const result = await client.verifyEmail(
          { email, checkMx },
          { txHash, privateKey, bypassSecret }
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `x402 Email verification call failed: ${err.message}` }]
        };
      }
    }
  );

  // Tool 5: On-chain Payment Execution Helper
  server.tool(
    "x402_execute_payment",
    "Execute an on-chain transfer of USDC on Base Mainnet to the service payee wallet (0x3028C30B8c8985Bd54669BC313Fe7950fCeB1142) and return the transaction hash.",
    {
      endpoint: z.enum(["crossword", "email"]).describe("Endpoint to fund: 'crossword' (0.50 USDC) or 'email' (0.25 USDC)"),
      privateKey: z.string().optional().describe("Base private key to sign the transaction")
    },
    async ({ endpoint, privateKey }) => {
      try {
        const key = privateKey || client.privateKey;
        if (!key) {
          throw new Error("Missing privateKey. Provide 'privateKey' parameter or set BASE_PRIVATE_KEY environment variable.");
        }

        const amountUnits = endpoint === "crossword" ? "500000" : "250000";
        const challenge = {
          recipient: SERVICE_PAYEE_WALLET,
          tokenAddress: BASE_USDC_CONTRACT,
          amountUnits
        };

        const txHash = await client.executeOnChainPayment(challenge, key);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "CONFIRMED",
                network: "base",
                chainId: 8453,
                txHash,
                recipient: SERVICE_PAYEE_WALLET,
                amountUsdc: endpoint === "crossword" ? 0.50 : 0.25,
                usageInstructions: `Provide 'txHash: \"${txHash}\"' when calling x402_${endpoint === "crossword" ? "generate_crossword" : "verify_email"}.`
              }, null, 2)
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to execute Base payment: ${err.message}` }]
        };
      }
    }
  );

  return { server, client };
}

export async function runStdioServer() {
  const { server } = createX402McpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("x402 Agent MCP Server running on stdio (PID: " + process.pid + ")");
}
