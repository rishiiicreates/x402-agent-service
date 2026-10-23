import app from './src/app.js';

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`x402 Agent Microservice running at http://localhost:${PORT}`);
  console.log(`Manifest: http://localhost:${PORT}/.well-known/x402`);
});
