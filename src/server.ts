/**
 * Standalone Express server entry point
 *
 * Imports the fully-configured Express application from src/app.ts and starts
 * an HTTP server on the configured PORT.
 *
 * For Vercel deployments the serverless handler in api/index.ts is used
 * instead – it imports the same app without ever calling listen().
 */

import app from "./app";
import { disconnectClient } from "./xrpl/client";

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const PORT = Number(process.env["PORT"] ?? 3000);

export const server = app.listen(PORT, () => {
  console.log(`Glass Wizard Music NFT server running on http://localhost:${PORT}`);
});

process.on("SIGTERM", async () => {
  await disconnectClient();
  server.close();
});

export default app;
