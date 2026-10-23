/**
 * x402 Service Configuration
 * Base Mainnet (Chain ID: 8453)
 */

export const CONFIG = {
  serviceName: "x402 Agent Microservice",
  version: "0.1.0",
  description: "Production-ready x402-compliant API micro-service accepting USDC payments on Base Mainnet",
  
  // Blockchain Network
  network: "base",
  chainId: 8453,
  rpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",
  
  // Payment Asset
  tokenSymbol: "USDC",
  tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  tokenDecimals: 6,
  
  // Payee / Recipient Wallet
  payeeAddress: "0x3028C30B8c8985Bd54669BC313Fe7950fCeB1142",
  
  // Standard ERC20 Transfer(address,address,uint256) topic
  transferTopic: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
  
  // Endpoint Pricing Specs
  endpoints: {
    "/api/crossword/generate": {
      name: "Dynamic Crossword Generator",
      description: "Generates dynamic crossword grid layout with rebus & progressive clues",
      priceUsdc: 0.50,
      amountUnits: "500000",
      method: "POST"
    },
    "/api/verify/email": {
      name: "Fast Email & MAP Validator",
      description: "Fast MAP protocol & email schema validator with DNS MX lookup",
      priceUsdc: 0.25,
      amountUnits: "250000",
      method: "POST"
    }
  }
};
