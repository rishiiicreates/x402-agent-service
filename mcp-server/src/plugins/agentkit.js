/**
 * Coinbase AgentKit Action Provider for x402 Micropayment Services
 * Integrates with @coinbase/agentkit to allow autonomous onchain agents to purchase API services with USDC on Base.
 */

import { z } from 'zod';
import { X402AgentClient, DEFAULT_SERVICE_URL, SERVICE_PAYEE_WALLET, BASE_USDC_CONTRACT } from '../client.js';

export const CrosswordInputSchema = z.object({
  theme: z.string().optional().describe("Theme topic for the crossword puzzle"),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().describe("Difficulty level")
});

export const EmailVerifyInputSchema = z.object({
  email: z.string().describe("Target email address to validate syntax & DNS MX records"),
  checkMx: z.boolean().optional().default(true).describe("Whether to verify DNS MX records")
});

export class X402ActionProvider {
  /**
   * @param {Object} [config]
   * @param {string} [config.baseUrl]
   * @param {string} [config.privateKey]
   * @param {string} [config.bypassSecret]
   */
  constructor(config = {}) {
    this.name = "x402_agent_services";
    this.actionProviderUri = "https://x402-agent-service.vercel.app";
    this.client = new X402AgentClient(config);
  }

  /**
   * Returns list of actions available for Coinbase AgentKit
   */
  getActions(walletProvider) {
    return [
      {
        name: "generate_crossword",
        description: "Purchases and generates a dynamic crossword puzzle using 0.50 USDC on Base Mainnet. Settled to payee 0x3028C30B8c8985Bd54669BC313Fe7950fCeB1142.",
        schema: CrosswordInputSchema,
        invoke: async (args) => {
          let txHash = null;

          // If Coinbase AgentKit walletProvider is present and can transfer
          if (walletProvider && typeof walletProvider.sendTransaction === 'function') {
            // Can execute transfer directly using walletProvider
            try {
              txHash = await walletProvider.sendTransaction({
                to: BASE_USDC_CONTRACT,
                // Transfer 0.50 USDC (500000 units) to SERVICE_PAYEE_WALLET
                data: `0xa9059cbb000000000000000000000000${SERVICE_PAYEE_WALLET.replace('0x', '')}000000000000000000000000000000000000000000000000000000000007a120`
              });
            } catch (e) {
              // fallback to client internal key
            }
          }

          const result = await this.client.generateCrossword(args, { txHash });
          return JSON.stringify(result, null, 2);
        }
      },
      {
        name: "verify_email",
        description: "Validates an email address and checks live DNS MX records using 0.25 USDC on Base Mainnet. Settled to payee 0x3028C30B8c8985Bd54669BC313Fe7950fCeB1142.",
        schema: EmailVerifyInputSchema,
        invoke: async (args) => {
          let txHash = null;

          if (walletProvider && typeof walletProvider.sendTransaction === 'function') {
            try {
              txHash = await walletProvider.sendTransaction({
                to: BASE_USDC_CONTRACT,
                // Transfer 0.25 USDC (250000 units) to SERVICE_PAYEE_WALLET
                data: `0xa9059cbb000000000000000000000000${SERVICE_PAYEE_WALLET.replace('0x', '')}000000000000000000000000000000000000000000000000000000000003d090`
              });
            } catch (e) {
              // fallback to client internal key
            }
          }

          const result = await this.client.verifyEmail(args, { txHash });
          return JSON.stringify(result, null, 2);
        }
      }
    ];
  }

  supportsNetwork(network) {
    return network.protocolFamily === "evm" && (network.chainId === "8453" || network.networkId === "base-mainnet");
  }
}

export function x402ActionProvider(config) {
  return new X402ActionProvider(config);
}
