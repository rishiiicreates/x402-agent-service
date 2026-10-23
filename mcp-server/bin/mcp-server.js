#!/usr/bin/env node

/**
 * CLI launcher for x402 Agent MCP Server
 */

import { runStdioServer } from '../src/server.js';

runStdioServer().catch(err => {
  console.error("Fatal error starting x402 MCP server:", err);
  process.exit(1);
});
