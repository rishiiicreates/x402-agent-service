import app from '../src/app.js';
import { resetRedeemedStore } from '../src/middleware/x402.js';

async function runTests() {
  resetRedeemedStore();
  const PORT = 3456;
  const server = app.listen(PORT);
  console.log(`Test server running on port ${PORT}...`);

  const BASE_URL = `http://localhost:${PORT}`;
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // Test 1: GET /
    console.log("\n--- Testing Root Endpoint ---");
    const rootRes = await fetch(`${BASE_URL}/`);
    const rootData = await rootRes.json();
    assert(rootRes.status === 200, "Root returns HTTP 200");
    assert(rootData.service === "x402 Agent Microservice", "Root contains service name");
    assert(rootData.payee === "0x3028C30B8c8985Bd54669BC313Fe7950fCeB1142", "Root payee matches spec");

    // Test 2: GET /.well-known/x402
    console.log("\n--- Testing x402 Manifest Endpoint ---");
    const manifestRes = await fetch(`${BASE_URL}/.well-known/x402`);
    const manifest = await manifestRes.json();
    assert(manifestRes.status === 200, "Manifest returns HTTP 200");
    assert(manifest.chainId === 8453, "Manifest chainId is 8453 (Base)");
    assert(manifest.network === "base", "Manifest network is 'base'");
    assert(manifest.token.address === "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USDC contract matches spec");
    assert(manifest.payee.address === "0x3028C30B8c8985Bd54669BC313Fe7950fCeB1142", "Payee matches spec");
    assert(Boolean(manifest.endpoints["/api/crossword/generate"]), "Declares crossword endpoint");
    assert(manifest.endpoints["/api/crossword/generate"].priceUsdc === 0.50, "Crossword price is 0.50 USDC");
    assert(Boolean(manifest.endpoints["/api/verify/email"]), "Declares email verify endpoint");
    assert(manifest.endpoints["/api/verify/email"].priceUsdc === 0.25, "Email verify price is 0.25 USDC");

    // Test 3: POST /api/crossword/generate without payment
    console.log("\n--- Testing Crossword Unpaid Access ---");
    const cwUnpaid = await fetch(`${BASE_URL}/api/crossword/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: "Decentralized Systems & AI" })
    });
    const cwUnpaidData = await cwUnpaid.json();
    assert(cwUnpaid.status === 402, "Unpaid crossword request returns HTTP 402");
    assert(cwUnpaidData.error === "Payment Required", "Returns standard Payment Required error");
    assert(cwUnpaidData.payment.priceUsdc === 0.50, "Challenge specifies 0.50 USDC");
    assert(cwUnpaidData.payment.recipient === "0x3028C30B8c8985Bd54669BC313Fe7950fCeB1142", "Challenge specifies recipient");

    // Test 4: POST /api/verify/email without payment
    console.log("\n--- Testing Email Verify Unpaid Access ---");
    const emailUnpaid = await fetch(`${BASE_URL}/api/verify/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" })
    });
    const emailUnpaidData = await emailUnpaid.json();
    assert(emailUnpaid.status === 402, "Unpaid email request returns HTTP 402");
    assert(emailUnpaidData.error === "Payment Required", "Returns standard Payment Required error");
    assert(emailUnpaidData.payment.priceUsdc === 0.25, "Challenge specifies 0.25 USDC");

    // Test 5: Malformed tx hash
    console.log("\n--- Testing Malformed Tx Hash ---");
    const malformed = await fetch(`${BASE_URL}/api/crossword/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PAYMENT": "not-a-valid-tx-hash"
      },
      body: JSON.stringify({})
    });
    assert(malformed.status === 402, "Malformed tx hash returns HTTP 402");

    // Test 6: Non-existent tx hash (queries Base RPC)
    console.log("\n--- Testing Non-Existent Tx Hash On Base RPC ---");
    const nonExistent = await fetch(`${BASE_URL}/api/crossword/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PAYMENT": "0x1111111111111111111111111111111111111111111111111111111111111111"
      },
      body: JSON.stringify({})
    });
    const nonExistentData = await nonExistent.json();
    assert(nonExistent.status === 402, "Non-existent tx returns HTTP 402");
    assert(nonExistentData.message.includes("not found on Base Mainnet"), "Reason explains tx not found");

    // Test 7: Real Base USDC payment verification
    console.log("\n--- Testing Real Base Mainnet USDC Payment Tx ---");
    const realTxHash = "0xe1b60b437e7b02be1ef6ce1f899792cb895d6efbff78bbcd03a306baa41aa8dc";
    const realPaymentRes = await fetch(`${BASE_URL}/api/crossword/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PAYMENT": realTxHash
      },
      body: JSON.stringify({ theme: "Decentralized Systems & AI", difficulty: "medium" })
    });
    const realPaymentData = await realPaymentRes.json();
    assert(realPaymentRes.status === 200, "Paid request with real Base USDC tx returns HTTP 200");
    assert(realPaymentData.success === true, "Payload success is true");
    assert(Boolean(realPaymentData.puzzle), "Generates crossword puzzle");
    assert(realPaymentData.puzzle.features.hasRebus === true, "Puzzle contains rebus cells");
    assert(realPaymentData.puzzle.features.hasProgressiveUnlocks === true, "Puzzle contains progressive clues");
    assert(realPaymentData.payment.verified === true, "Payment marked verified");
    assert(realPaymentData.payment.amountUsdc >= 0.50, "Transferred amount >= 0.50 USDC");

    // Test 8: Replay prevention check
    console.log("\n--- Testing Replay Prevention ---");
    const replayRes = await fetch(`${BASE_URL}/api/crossword/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PAYMENT": realTxHash
      },
      body: JSON.stringify({})
    });
    const replayData = await replayRes.json();
    assert(replayRes.status === 402, "Replayed tx returns HTTP 402");
    assert(replayData.message.includes("replay detected"), "Message identifies replay attack");

    // Test 9: Fast MAP Protocol & Email Validator (with test bypass header)
    console.log("\n--- Testing Email Verification Execution ---");
    const emailTestRes = await fetch(`${BASE_URL}/api/verify/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-TEST-PAYMENT-BYPASS": "x402-dev-test-key-2026"
      },
      body: JSON.stringify({ email: "rishiicreates@gmail.com", checkMx: true })
    });
    const emailTestData = await emailTestRes.json();
    assert(emailTestRes.status === 200, "Authorized email check returns HTTP 200");
    assert(emailTestData.validation.validSyntax === true, "Valid email syntax");
    assert(emailTestData.validation.checks.hasMxRecords === true, "Resolved Google MX records");
    assert(emailTestData.validation.deliverable === true, "Deliverable status confirmed");

    console.log(`\n========================================`);
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
