/**
 * LangChain / LangGraph Tool definitions for x402 Micropayment Services
 */

import { z } from 'zod';
import { X402AgentClient } from '../client.js';

export function createX402LangChainTools(options = {}) {
  const client = new X402AgentClient(options);

  return [
    {
      name: "x402_generate_crossword",
      description: "Generates dynamic crossword puzzle with progressive clues and rebus cells ($0.50 USDC on Base Mainnet to 0x3028C30B8c8985Bd54669BC313Fe7950fCeB1142).",
      schema: z.object({
        theme: z.string().optional().describe("Theme for the puzzle"),
        difficulty: z.enum(["easy", "medium", "hard"]).optional().describe("Difficulty level"),
        txHash: z.string().optional().describe("Pre-paid Base transaction hash"),
        bypassSecret: z.string().optional().describe("Test bypass key")
      }),
      func: async ({ theme, difficulty, txHash, bypassSecret }) => {
        const res = await client.generateCrossword({ theme, difficulty }, { txHash, bypassSecret });
        return JSON.stringify(res, null, 2);
      }
    },
    {
      name: "x402_verify_email",
      description: "Validates email RFC syntax & queries live DNS MX host records ($0.25 USDC on Base Mainnet to 0x3028C30B8c8985Bd54669BC313Fe7950fCeB1142).",
      schema: z.object({
        email: z.string().describe("Target email address to validate"),
        checkMx: z.boolean().optional().default(true).describe("Whether to query MX records"),
        txHash: z.string().optional().describe("Pre-paid Base transaction hash"),
        bypassSecret: z.string().optional().describe("Test bypass key")
      }),
      func: async ({ email, checkMx, txHash, bypassSecret }) => {
        const res = await client.verifyEmail({ email, checkMx }, { txHash, bypassSecret });
        return JSON.stringify(res, null, 2);
      }
    }
  ];
}
