/**
 * End-to-End Verification Test for x402 MCP Server and Client SDK
 * Tests live production service endpoints, 402 challenge flow, bypass execution, and MCP tools.
 */

import { X402AgentClient, BASE_USDC_CONTRACT, SERVICE_PAYEE_WALLET, DEFAULT_SERVICE_URL } from './src/client.js';
import { createX402McpServer } from './src/server.js';

async function runVerification() {
  console.log("=================================================");
  console.log("x402 MCP SERVER & AUTONOMOUS CLIENT TEST SUITE");
  console.log("=================================================");
  console.log(`Target Service: ${DEFAULT_SERVICE_URL}`);
  console.log(`Payee Recipient: ${SERVICE_PAYEE_WALLET}`);
  console.log(`USDC Contract: ${BASE_USDC_CONTRACT}\n`);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  const client = new X402AgentClient({
    baseUrl: DEFAULT_SERVICE_URL,
    bypassSecret: "x402-dev-test-key-2026"
  });

  try {
    // 1. Fetch Protocol Manifest
    console.log("--- 1. Testing Protocol Manifest Discovery ---");
    const manifest = await client.getManifest();
    assert(manifest.protocol === "x402", "Protocol is x402");
    assert(manifest.chainId === 8453, "Chain ID is 8453 (Base Mainnet)");
    assert(manifest.payee.address.toLowerCase() === SERVICE_PAYEE_WALLET.toLowerCase(), "Payee matches recipient wallet");
    assert(manifest.token.address.toLowerCase() === BASE_USDC_CONTRACT.toLowerCase(), "Token matches Base USDC");
    assert(Boolean(manifest.endpoints["/api/crossword/generate"]), "Manifest exposes crossword endpoint");
    assert(Boolean(manifest.endpoints["/api/verify/email"]), "Manifest exposes email endpoint");
    assert(Boolean(manifest.endpoints["/api/crossword/generate"].extensions?.bazaar), "Crossword has Bazaar v2 discovery extension");
    assert(Boolean(manifest.endpoints["/api/verify/email"].extensions?.bazaar), "Email has Bazaar v2 discovery extension");

    // 2. Test 402 Challenge Simulation (Crossword)
    console.log("\n--- 2. Testing 402 Challenge Simulation (Crossword) ---");
    const cwSim = await client.callWithX402('/api/crossword/generate', {}, { simulateOnly: true });
    assert(cwSim.status === 402, "Simulation returns status 402");
    assert(cwSim.simulated === true, "Simulated flag is true");
    assert(cwSim.challenge.priceUsdc === 0.50, "Challenge specifies 0.50 USDC");
    assert(cwSim.challenge.amountUnits === "500000", "Challenge specifies 500,000 atomic units");
    assert(cwSim.challenge.recipient.toLowerCase() === SERVICE_PAYEE_WALLET.toLowerCase(), "Challenge specifies payee wallet");

    // 3. Test 402 Challenge Simulation (Email)
    console.log("\n--- 3. Testing 402 Challenge Simulation (Email) ---");
    const emailSim = await client.callWithX402('/api/verify/email', { email: "test@example.com" }, { simulateOnly: true });
    assert(emailSim.status === 402, "Simulation returns status 402");
    assert(emailSim.challenge.priceUsdc === 0.25, "Challenge specifies 0.25 USDC");
    assert(emailSim.challenge.amountUnits === "250000", "Challenge specifies 250,000 atomic units");

    // 4. Test Crossword Generation Execution (with bypass authentication)
    console.log("\n--- 4. Testing Crossword Generation Execution ---");
    const cwResult = await client.generateCrossword({
      theme: "Decentralized Autonomous Agents",
      difficulty: "medium"
    });
    assert(cwResult.status === 200, "Crossword endpoint returns HTTP 200");
    assert(cwResult.fulfilled === true, "Request was fulfilled");
    assert(Boolean(cwResult.data.puzzle.grid), "Puzzle contains generated grid");
    assert(cwResult.data.puzzle.features.hasRebus === true, "Puzzle features dynamic rebus cell");
    assert(cwResult.data.puzzle.features.hasProgressiveUnlocks === true, "Puzzle features progressive clue unlocks");
    assert(cwResult.data.payment.verified === true, "Payment marked verified");

    // 5. Test Email & MAP Verification Execution (with bypass authentication)
    console.log("\n--- 5. Testing Email & MAP Verification Execution ---");
    const emailResult = await client.verifyEmail({
      email: "vitalik@ethereum.org",
      checkMx: true
    });
    assert(emailResult.status === 200, "Email endpoint returns HTTP 200");
    assert(emailResult.data.validation.validSyntax === true, "Valid email syntax");
    assert(emailResult.data.validation.deliverable === true, "Email marked deliverable");
    assert(emailResult.data.validation.checks.hasMxRecords === true, "DNS MX records resolved");
    assert(emailResult.data.validation.checks.mxHosts.length > 0, "MX hosts list populated");

    // 6. Test MCP Server Tool Registry
    console.log("\n--- 6. Testing MCP Server Tool Registration & Calls ---");
    const { server } = createX402McpServer({
      bypassSecret: "x402-dev-test-key-2026"
    });

    // Check registered tools count
    const tools = server._registeredTools; // Map of registered tools
    const toolNames = Object.keys(tools);
    assert(toolNames.includes("x402_get_service_info"), "Registered tool: x402_get_service_info");
    assert(toolNames.includes("x402_simulate_challenge"), "Registered tool: x402_simulate_challenge");
    assert(toolNames.includes("x402_generate_crossword"), "Registered tool: x402_generate_crossword");
    assert(toolNames.includes("x402_verify_email"), "Registered tool: x402_verify_email");
    assert(toolNames.includes("x402_execute_payment"), "Registered tool: x402_execute_payment");

    // Execute x402_get_service_info via MCP handler
    const infoHandler = tools["x402_get_service_info"].handler;
    const infoResponse = await infoHandler({});
    const infoPayload = JSON.parse(infoResponse.content[0].text);
    assert(infoPayload.chainId === 8453, "MCP tool returns chainId 8453");
    assert(infoPayload.payeeWallet.toLowerCase() === SERVICE_PAYEE_WALLET.toLowerCase(), "MCP tool returns correct payee");

    // Execute x402_simulate_challenge via MCP handler
    const simHandler = tools["x402_simulate_challenge"].handler;
    const simCrossword = await simHandler({ endpoint: "crossword" });
    const simCrosswordPayload = JSON.parse(simCrossword.content[0].text);
    assert(simCrosswordPayload.status === 402, "MCP challenge simulation returns 402 status");
    assert(simCrosswordPayload.challenge.priceUsdc === 0.50, "MCP challenge simulation specifies 0.50 USDC");

    // Execute x402_verify_email via MCP handler
    const emailToolHandler = tools["x402_verify_email"].handler;
    const emailToolRes = await emailToolHandler({
      email: "satoshinakamoto@gmx.com",
      checkMx: true,
      bypassSecret: "x402-dev-test-key-2026"
    });
    const emailToolData = JSON.parse(emailToolRes.content[0].text);
    assert(emailToolData.status === 200, "MCP email tool executed successfully with 200");
    assert(emailToolData.data.validation.validSyntax === true, "MCP email tool returned valid syntax");

  } catch (err) {
    console.error("Unexpected test exception:", err);
    failed++;
  }

  console.log("\n=================================================");
  console.log(`MCP & CLIENT TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification();
