# x402 Agent MCP Server & Client SDK

Model Context Protocol (MCP) server, programmatic client SDK, and agent integrations for the live **x402-agent-service** accepting USDC on Base Mainnet.

- **Base Service URL:** `https://x402-agent-service.vercel.app`
- **Protocol Manifest:** `https://x402-agent-service.vercel.app/.well-known/x402`
- **Settlement Wallet:** `0x3028C30B8c8985Bd54669BC313Fe7950fCeB1142`
- **Network:** Base Mainnet (`chainId: 8453`)
- **Asset:** USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)

---

## Exposed MCP Tools

1. **`x402_get_service_info`**
   - Returns protocol manifest, active pricing, payee wallet, and token specifications.
2. **`x402_simulate_challenge`**
   - Dry-runs an endpoint request to receive the exact HTTP 402 challenge, payee address, and payment instruction without spending funds.
3. **`x402_generate_crossword`** ($0.50 USDC)
   - Generates dynamic crossword puzzle with progressive clues and rebus cells.
   - Accepts optional `txHash` (pre-paid), `privateKey` (autonomous settlement), or `bypassSecret`.
4. **`x402_verify_email`** ($0.25 USDC)
   - Validates email syntax RFC 5322 & queries live DNS MX host records.
5. **`x402_execute_payment`**
   - Direct on-chain helper: transfers USDC on Base to `0x3028C30B8c8985Bd54669BC313Fe7950fCeB1142` and returns confirmed transaction hash.

---

## Installation & Setup

### 1. Claude Desktop / Cursor MCP Setup
Add this to your `claude_desktop_config.json` or Cursor settings:

```json
{
  "mcpServers": {
    "x402-agent-service": {
      "command": "node",
      "args": ["/Users/rishii/Projects/x402-agent-service/mcp-server/bin/mcp-server.js"],
      "env": {
        "X402_SERVICE_URL": "https://x402-agent-service.vercel.app",
        "BASE_RPC_URL": "https://mainnet.base.org"
      }
    }
  }
}
```

### 2. Autonomous Client SDK Usage

```javascript
import { X402AgentClient } from 'x402-agent-mcp/client';

const client = new X402AgentClient({
  baseUrl: 'https://x402-agent-service.vercel.app',
  privateKey: process.env.BASE_PRIVATE_KEY // Optional for autonomous Base USDC settlement
});

// Autonomous Crossword Call (Auto-pays 0.50 USDC if privateKey is configured)
const crossword = await client.generateCrossword({
  theme: 'Decentralized Systems & AI',
  difficulty: 'medium'
});
console.log(crossword.data.puzzle.title);

// Autonomous Email Validation Call (0.25 USDC)
const emailCheck = await client.verifyEmail({
  email: 'satoshi@gmx.com',
  checkMx: true
});
console.log(emailCheck.data.validation.deliverable);
```

### 3. ElizaOS Plugin Integration

```typescript
import { x402ServicePlugin } from 'x402-agent-mcp/plugins/elizaos';

export const character: Character = {
  name: "CommerceAgent",
  plugins: [x402ServicePlugin],
  settings: {
    secrets: {
      BASE_PRIVATE_KEY: "0x..."
    }
  }
};
```

### 4. Coinbase AgentKit Integration

```typescript
import { x402ActionProvider } from 'x402-agent-mcp/plugins/agentkit';
import { AgentKit } from '@coinbase/agentkit';

const agentKit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    x402ActionProvider()
  ]
});
```
