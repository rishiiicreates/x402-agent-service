import express from 'express';
import cors from 'cors';
import { CONFIG } from './config.js';
import { requirePayment } from './middleware/x402.js';
import { generateCrosswordPuzzle } from './services/crosswordGenerator.js';
import { validateEmail } from './services/emailValidator.js';

const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Normalize rewritten paths from Vercel if needed
app.use((req, res, next) => {
  const matchedPath = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'];
  if (matchedPath && !req.url.startsWith('/.well-known') && !req.url.startsWith('/api')) {
    req.url = matchedPath;
  }
  next();
});

/**
 * Manifest payload for x402
 */
function getManifest() {
  return {
    x402Version: CONFIG.version,
    name: CONFIG.serviceName,
    description: CONFIG.description,
    protocol: "x402",
    network: CONFIG.network,
    chainId: CONFIG.chainId,
    token: {
      symbol: CONFIG.tokenSymbol,
      address: CONFIG.tokenAddress,
      decimals: CONFIG.tokenDecimals
    },
    payee: {
      address: CONFIG.payeeAddress,
      network: CONFIG.network,
      chainId: CONFIG.chainId
    },
    rpcUrl: CONFIG.rpcUrl,
    endpoints: {
      "/api/crossword/generate": {
        method: "POST",
        name: CONFIG.endpoints["/api/crossword/generate"].name,
        description: CONFIG.endpoints["/api/crossword/generate"].description,
        priceUsdc: CONFIG.endpoints["/api/crossword/generate"].priceUsdc,
        amountUnits: CONFIG.endpoints["/api/crossword/generate"].amountUnits,
        currency: CONFIG.tokenSymbol,
        tokenAddress: CONFIG.tokenAddress,
        headers: {
          "X-PAYMENT": "<base_usdc_transaction_hash>"
        },
        sampleBody: {
          theme: "Decentralized Systems & AI",
          difficulty: "medium"
        },
        extensions: {
          bazaar: {
            info: {
              name: CONFIG.endpoints["/api/crossword/generate"].name,
              description: CONFIG.endpoints["/api/crossword/generate"].description,
              input: {
                type: "http",
                method: "POST",
                routeTemplate: "/api/crossword/generate",
                bodySchema: {
                  type: "object",
                  properties: {
                    theme: { type: "string", description: "Crossword theme topic or genre" },
                    difficulty: { type: "string", enum: ["easy", "medium", "hard"], default: "medium" }
                  }
                }
              },
              output: {
                format: "json"
              }
            }
          }
        }
      },
      "/api/verify/email": {
        method: "POST",
        name: CONFIG.endpoints["/api/verify/email"].name,
        description: CONFIG.endpoints["/api/verify/email"].description,
        priceUsdc: CONFIG.endpoints["/api/verify/email"].priceUsdc,
        amountUnits: CONFIG.endpoints["/api/verify/email"].amountUnits,
        currency: CONFIG.tokenSymbol,
        tokenAddress: CONFIG.tokenAddress,
        headers: {
          "X-PAYMENT": "<base_usdc_transaction_hash>"
        },
        sampleBody: {
          email: "satoshinakamoto@gmx.com",
          checkMx: true
        },
        extensions: {
          bazaar: {
            info: {
              name: CONFIG.endpoints["/api/verify/email"].name,
              description: CONFIG.endpoints["/api/verify/email"].description,
              input: {
                type: "http",
                method: "POST",
                routeTemplate: "/api/verify/email",
                bodySchema: {
                  type: "object",
                  properties: {
                    email: { type: "string", format: "email", description: "Email address to validate" },
                    checkMx: { type: "boolean", default: true, description: "Whether to query live DNS MX host records" }
                  },
                  required: ["email"]
                }
              },
              output: {
                format: "json"
              }
            }
          }
        }
      }
    },
    extensions: {
      bazaar: {
        version: "0.2.0",
        provider: "x402 Agent Microservice",
        settlementNetwork: "base",
        settlementAsset: "USDC"
      }
    },
    docs: "https://x402.org",
    spec: "https://github.com/coinbase/x402"
  };
}

// 1. x402 Manifest Endpoint
app.get('/.well-known/x402', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json(getManifest());
});

// Also alias /api/manifest for direct routing
app.get('/api/manifest', (req, res) => {
  res.json(getManifest());
});

// 2. Health & Status
app.get('/api/health', (req, res) => {
  res.json({
    status: "ok",
    service: CONFIG.serviceName,
    version: CONFIG.version,
    network: CONFIG.network,
    chainId: CONFIG.chainId,
    token: CONFIG.tokenSymbol,
    payee: CONFIG.payeeAddress,
    timestamp: new Date().toISOString()
  });
});

// 3. Root landing page / API overview
app.get('/', (req, res) => {
  res.json({
    service: CONFIG.serviceName,
    version: CONFIG.version,
    description: CONFIG.description,
    status: "online",
    network: `${CONFIG.network} (Chain ID: ${CONFIG.chainId})`,
    payee: CONFIG.payeeAddress,
    token: `${CONFIG.tokenSymbol} (${CONFIG.tokenAddress})`,
    manifest: "/.well-known/x402",
    health: "/api/health",
    endpoints: {
      crossword: {
        path: "/api/crossword/generate",
        method: "POST",
        price: "$0.50 USDC",
        description: "Dynamic crossword grid layout with rebus & progressive clues"
      },
      emailVerify: {
        path: "/api/verify/email",
        method: "POST",
        price: "$0.25 USDC",
        description: "Fast MAP protocol & RFC email schema validator with DNS MX check"
      }
    }
  });
});

// 4. Dynamic Crossword Generator ($0.50 USDC)
app.post(
  '/api/crossword/generate',
  requirePayment(CONFIG.endpoints["/api/crossword/generate"].priceUsdc, '/api/crossword/generate'),
  (req, res) => {
    try {
      const puzzle = generateCrosswordPuzzle(req.body || {});
      res.json({
        success: true,
        puzzle,
        payment: req.x402Payment
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to generate crossword puzzle", details: err.message });
    }
  }
);

// 5. Fast MAP Protocol & Email Validator ($0.25 USDC)
app.post(
  '/api/verify/email',
  requirePayment(CONFIG.endpoints["/api/verify/email"].priceUsdc, '/api/verify/email'),
  async (req, res) => {
    try {
      const email = req.body && req.body.email;
      if (!email) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Missing 'email' field in JSON request body"
        });
      }

      const validation = await validateEmail(email, req.body);
      res.json({
        success: true,
        validation,
        payment: req.x402Payment
      });
    } catch (err) {
      res.status(500).json({ error: "Email validation error", details: err.message });
    }
  }
);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    path: req.originalUrl || req.url,
    manifest: "/.well-known/x402"
  });
});

export default app;
