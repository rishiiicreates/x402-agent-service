# x402-agent-service

Production-ready x402-compliant API micro-service that accepts USDC payments on Base Mainnet (Chain ID 8453).

## Specifications

- **Payout Recipient Wallet:** `0x3028C30B8c8985Bd54669BC313Fe7950fCeB1142`
- **Network:** Base Mainnet (`https://mainnet.base.org`, Chain ID: `8453`)
- **Payment Asset:** USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, 6 decimals)

## Endpoints

### 1. `GET /.well-known/x402`
Returns the machine-readable x402 JSON manifest declaring supported endpoints, prices in USDC, accepted network (Base 8453), token address, and payee address.

### 2. `POST /api/crossword/generate`
Generates dynamic crossword grid layout with rebus & progressive clues.
- **Price:** $0.50 USDC (500,000 atomic units)
- **Protected by:** x402 payment middleware

### 3. `POST /api/verify/email`
Fast MAP protocol & RFC 5322 email schema validator with live DNS MX record verification.
- **Price:** $0.25 USDC (250,000 atomic units)
- **Protected by:** x402 payment middleware

## x402 Payment Middleware

1. **Unpaid Request:**
   If incoming request lacks `X-PAYMENT` (or `Payment-Signature` / `Authorization`) header, the service responds with `HTTP 402 Payment Required` with response headers and a JSON challenge containing price, token, network, payee, and payment instructions.

2. **Payment Verification:**
   When `X-PAYMENT: <txHash>` is provided:
   - Queries Base JSON-RPC (`https://mainnet.base.org`) via `eth_getTransactionReceipt`
   - Confirms execution status is `0x1` (success)
   - Parses logs for ERC20 `Transfer(address,address,uint256)` emitted by Base USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
   - Verifies the recipient is `0x3028C30B8c8985Bd54669BC313Fe7950fCeB1142`
   - Verifies the transferred amount meets or exceeds the required price (e.g. 500,000 for $0.50, 250,000 for $0.25)
   - Protects against replay attacks by tracking redeemed transaction hashes.

## Verification & Quick Testing

```bash
# Run unit & on-chain integration tests
npm test

# Start local server
npm start
```
