# Directory & Registry Indexing Guide for x402 Agent Service

This document contains step-by-step instructions and registration manifests to index **x402-agent-service** across the major autonomous agent networks, directories, and registries.

---

## 1. Coinbase x402 Bazaar (CDP Discovery Layer)

The **x402 Bazaar** dynamically indexes payment-gated resources using the x402 v2 discovery protocol. 

### Current Status: Ready & Live
- **Protocol Manifest:** `https://x402-agent-service.vercel.app/.well-known/x402`
- **Bazaar Extension:** Embedded inside `extensions.bazaar` on the manifest and within every HTTP 402 challenge envelope.
- **Payee Wallet:** `0x3028C30B8c8985Bd54669BC313Fe7950fCeB1142`
- **Payment Asset:** Base Mainnet USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)

### How Crawlers & Facilitators Index:
1. When any CDP agent or autonomous crawler queries `GET https://x402-agent-service.vercel.app/.well-known/x402`, it parses the `resources` / `endpoints` schema.
2. When the first paid settlement transaction is processed through a CDP facilitator, the facilitator automatically publishes the resource to the decentralized Bazaar index.
3. For immediate manual registration, submit the manifest `registries/x402-bazaar.json` to the x402 Foundation registry repository at [github.com/x402-foundation/x402](https://github.com/x402-foundation/x402).

---

## 2. Smithery.ai MCP Registry

Smithery is the premier registry for Model Context Protocol servers used by Claude Desktop, Cursor, and Windsurf.

### Files Prepared:
- `mcp-server/smithery.yaml`

### Indexing Steps:
1. Push repository changes to GitHub (`rishiicreates/x402-agent-service`).
2. Navigate to [https://smithery.ai/new](https://smithery.ai/new).
3. Connect repository: `rishiicreates/x402-agent-service` (pointing to subdirectory `mcp-server` or root).
4. Smithery will validate `smithery.yaml` and publish the server as `@rishiicreates/x402-agent-service`.
5. External users can immediately install via:
   ```bash
   npx -y @smithery/cli@latest install x402-agent-service --client claude
   ```

---

## 3. Glama.ai MCP Registry

Glama hosts a verified catalog of MCP tools for autonomous agents.

### Files Prepared:
- `registries/glama.json`

### Indexing Steps:
1. Go to [https://glama.ai/mcp/servers](https://glama.ai/mcp/servers).
2. Click **Submit a Server**.
3. Provide repository URL: `https://github.com/rishiicreates/x402-agent-service`.
4. Glama automatically ingests `glama.json` and lists the 5 exposed tools:
   - `x402_get_service_info`
   - `x402_simulate_challenge`
   - `x402_generate_crossword`
   - `x402_verify_email`
   - `x402_execute_payment`

---

## 4. ElizaOS Agent Marketplace

ElizaOS agents use community plugins to interact with on-chain protocols.

### Files Prepared:
- `mcp-server/src/plugins/elizaos.js`

### Integration / PR Details:
Submit a PR to [github.com/elizaos/eliza](https://github.com/elizaos/eliza) under `packages/plugin-x402-service` or publish as an independent npm package:
```bash
npm publish --access public
```
Agents include the plugin in `character.json`:
```json
{
  "name": "DeFiAnalyst",
  "plugins": ["@rishiicreates/x402-service-plugin"],
  "settings": {
    "secrets": {
      "BASE_PRIVATE_KEY": "0x..."
    }
  }
}
```

---

## 5. Coinbase AgentKit Ecosystem

Coinbase AgentKit connects AI agents to Base wallets.

### Files Prepared:
- `mcp-server/src/plugins/agentkit.js`

### Registration:
1. Submit an action provider extension to the Coinbase AgentKit repository (`coinbase/agentkit`):
   ```typescript
   import { x402ActionProvider } from '@rishiicreates/x402-agent-mcp/plugins/agentkit';
   
   const agentKit = await AgentKit.from({
     walletProvider,
     actionProviders: [x402ActionProvider()]
   });
   ```
2. Any AgentKit agent can now autonomously call `generate_crossword` and `verify_email`, paying USDC on Base directly from its CDP wallet.

---

## 6. Awesome MCP Servers & OpenTools

Submit a pull request to community curated lists:
- `punkpeye/awesome-mcp-servers`:
  ```markdown
  - [x402 Agent Service](https://github.com/rishiicreates/x402-agent-service) - Autonomous x402 payment-gated microservices on Base Mainnet ($0.50 Crossword Generator & $0.25 Email/MAP Validator).
  ```
- `wong2/awesome-mcp-servers`
- `mcp.so` directory
