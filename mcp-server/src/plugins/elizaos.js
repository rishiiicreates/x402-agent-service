/**
 * ElizaOS Plugin for x402 Micropayment Services
 * Integrates x402 Base USDC services into ElizaOS agent runtime.
 */

import { X402AgentClient, DEFAULT_SERVICE_URL, SERVICE_PAYEE_WALLET, BASE_USDC_CONTRACT } from '../client.js';

export const x402ServiceContextProvider = {
  get: async (runtime, message, state) => {
    return `
=== x402 ON-CHAIN MICROPAYMENT SERVICES (BASE MAINNET) ===
Network: Base Mainnet (Chain ID 8453)
Settlement Asset: USDC (${BASE_USDC_CONTRACT})
Payee Recipient: ${SERVICE_PAYEE_WALLET}
Endpoints Available:
- Dynamic Crossword Generator: 0.50 USDC (/api/crossword/generate)
- Fast Email & MAP Validator: 0.25 USDC (/api/verify/email)
Manifest: ${DEFAULT_SERVICE_URL}/.well-known/x402
Instructions: If calling paid endpoints, the agent automatically signs and submits a USDC transfer on Base or passes pre-paid X-PAYMENT header.
`;
  }
};

export const generateCrosswordAction = {
  name: "GENERATE_CROSSWORD",
  similes: ["CREATE_CROSSWORD", "SOLVE_CROSSWORD", "MAKE_PUZZLE", "X402_CROSSWORD"],
  description: "Generates dynamic crossword grid layout with rebus & progressive clues via x402 microservice (0.50 USDC on Base).",
  validate: async (runtime, message) => {
    const text = message.content?.text?.toLowerCase() || "";
    return text.includes("crossword") || text.includes("puzzle");
  },
  handler: async (runtime, message, state, options, callback) => {
    try {
      const privateKey = runtime.getSetting?.("BASE_PRIVATE_KEY") || process.env.BASE_PRIVATE_KEY;
      const bypassSecret = runtime.getSetting?.("X402_TEST_BYPASS_SECRET") || process.env.X402_TEST_BYPASS_SECRET;
      const client = new X402AgentClient({ privateKey, bypassSecret });

      const text = message.content?.text || "";
      const theme = text.includes("theme:") ? text.split("theme:")[1].trim() : "Decentralized Systems & AI";

      const response = await client.generateCrossword({ theme, difficulty: "medium" });

      if (callback) {
        callback({
          text: `Generated Crossword Puzzle: "${response.data.puzzle.title}" (${response.data.puzzle.dimensions.rows}x${response.data.puzzle.dimensions.cols}). Features: ${response.data.puzzle.features.hasRebus ? "Rebus Cells" : "Standard"}, ${response.data.puzzle.features.unlockTriggerCount} Progressive Unlock Triggers. Settled via x402 USDC on Base.`,
          content: response.data
        });
      }
      return true;
    } catch (err) {
      if (callback) {
        callback({ text: `Failed to generate crossword: ${err.message}`, error: true });
      }
      return false;
    }
  },
  examples: [
    [
      { user: "{{user1}}", content: { text: "Generate a crossword about AI and cryptography." } },
      { user: "{{agentName}}", content: { text: "I have generated the crossword puzzle titled 'The Consensus Matrix' using our x402 service." } }
    ]
  ]
};

export const verifyEmailAction = {
  name: "VERIFY_EMAIL",
  similes: ["CHECK_EMAIL", "VALIDATE_EMAIL", "EMAIL_LOOKUP", "X402_VERIFY_EMAIL"],
  description: "Validates email syntax RFC 5322 & queries live DNS MX host records via x402 microservice (0.25 USDC on Base).",
  validate: async (runtime, message) => {
    const text = message.content?.text?.toLowerCase() || "";
    return text.includes("verify") || text.includes("email") || text.includes("mx");
  },
  handler: async (runtime, message, state, options, callback) => {
    try {
      const privateKey = runtime.getSetting?.("BASE_PRIVATE_KEY") || process.env.BASE_PRIVATE_KEY;
      const bypassSecret = runtime.getSetting?.("X402_TEST_BYPASS_SECRET") || process.env.X402_TEST_BYPASS_SECRET;
      const client = new X402AgentClient({ privateKey, bypassSecret });

      const text = message.content?.text || "";
      const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const email = emailMatch ? emailMatch[0] : null;

      if (!email) {
        if (callback) callback({ text: "Please provide a valid email address to verify." });
        return false;
      }

      const response = await client.verifyEmail({ email, checkMx: true });
      const val = response.data.validation;

      if (callback) {
        callback({
          text: `Email Verification for ${email}: Valid: ${val.validSyntax}, Deliverable: ${val.deliverable}, Risk: ${val.risk}, MX Records: ${val.checks.hasMxRecords ? val.checks.mxHosts.length + " hosts" : "none"}. Settled via 0.25 USDC on Base.`,
          content: response.data
        });
      }
      return true;
    } catch (err) {
      if (callback) {
        callback({ text: `Email validation failed: ${err.message}`, error: true });
      }
      return false;
    }
  },
  examples: [
    [
      { user: "{{user1}}", content: { text: "Can you verify if satoshi@gmx.com is deliverable?" } },
      { user: "{{agentName}}", content: { text: "Verified satoshi@gmx.com: Syntax valid, deliverable: true, risk: LOW, MX hosts confirmed." } }
    ]
  ]
};

export const x402ServicePlugin = {
  name: "x402-service-plugin",
  description: "Provides autonomous agent access to paid x402 Base Mainnet services (Crossword Generator & Email/MAP Validator)",
  actions: [generateCrosswordAction, verifyEmailAction],
  providers: [x402ServiceContextProvider],
  evaluators: []
};

export default x402ServicePlugin;
