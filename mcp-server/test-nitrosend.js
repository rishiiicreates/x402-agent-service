/**
 * Test & Integration Verification for Nitrosend MCP Client
 * Validates connection, JSON-RPC protocol, tool inventory, and account status.
 */

import https from 'node:https';

const NITROSEND_MCP_URL = "https://api.nitrosend.com/mcp";
const NITROSEND_API_KEY = process.env.NITROSEND_API_KEY || "nskey_live_1424b94df72518fecbe67cf1304054bc";

function sendJsonRpc(method, params = {}, id = 1) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params
    });

    const req = https.request(NITROSEND_MCP_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NITROSEND_API_KEY}`,
        "Content-Type": "application/json"
      }
    }, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          if (json.error) {
            reject(new Error(`JSON-RPC Error [${json.error.code}]: ${json.error.message}`));
          } else {
            resolve(json.result);
          }
        } catch (err) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log("=================================================");
  console.log("NITROSEND MCP CLIENT & ENDPOINT VERIFICATION");
  console.log("=================================================");
  console.log("Endpoint URL:", NITROSEND_MCP_URL);

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

  try {
    // 1. Initialize
    console.log("\n--- 1. Initializing JSON-RPC Session ---");
    const initRes = await sendJsonRpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "x402-distribution-test", version: "1.0.0" }
    }, 1);

    assert(initRes.serverInfo?.name === "nitro", `Server name is nitro (${initRes.serverInfo?.name})`);
    assert(initRes.protocolVersion === "2024-11-05", `Protocol version matched (${initRes.protocolVersion})`);

    // 2. Tools List
    console.log("\n--- 2. Inspecting Available Tools ---");
    const toolsRes = await sendJsonRpc("tools/list", {}, 2);
    const tools = toolsRes.tools || [];
    assert(tools.length > 0, `Discovered ${tools.length} Nitrosend tools`);

    const expectedTools = [
      "nitro_get_status",
      "nitro_send_message",
      "nitro_manage_audience",
      "nitro_manage_domains",
      "nitro_get_insights"
    ];
    for (const toolName of expectedTools) {
      const exists = tools.some(t => t.name === toolName);
      assert(exists, `Expected tool registered: ${toolName}`);
    }

    // 3. Call nitro_get_status
    console.log("\n--- 3. Calling nitro_get_status ---");
    const statusRes = await sendJsonRpc("tools/call", {
      name: "nitro_get_status",
      arguments: {}
    }, 3);

    assert(statusRes.content && statusRes.content.length > 0, "Tool call returned content block");
    const statusData = JSON.parse(statusRes.content[0].text);
    const result = statusData.result;

    assert(result.account?.tier === "free", `Account tier is free (${result.account?.tier})`);
    assert(result.sender?.effective_sending_domain === "shiro-agy.nitrosend.net", `Sending domain is ${result.sender?.effective_sending_domain}`);
    assert(result.brand_subdomain?.status === "ready", "Brand subdomain status is ready");
    assert(result.billing?.resources?.email?.budget > 0, `Email allowance available: ${result.billing?.resources?.email?.budget - result.billing?.resources?.email?.used}/${result.billing?.resources?.email?.budget}`);

    console.log("\n=================================================");
    console.log(`NITROSEND VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
    console.log("=================================================");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("Test failed with error:", err.message);
    process.exit(1);
  }
}

run();
