/**
 * Express application
 *
 * Configures middleware and all REST endpoints used by the Glass Wizard Music
 * NFT web UI.  This module is intentionally free of any `listen()` call so it
 * can be shared between the standalone server (src/server.ts) and the Vercel
 * serverless handler (api/index.ts).
 */

import express, { type Request, type Response } from "express";
import path from "path";
import { Wallet } from "xrpl";

import { generateTrack, serializeTrack, deserializeTrack } from "./music/generator";
import { buildScaleNotes } from "./music/scales";
import type { GeneratorOptions, MusicNFTMetadata } from "./music/types";
import { createAndFundWallet, walletFromSeed, getBalance } from "./xrpl/wallet";
import { mintMusicNFT, getAccountNFTs } from "./xrpl/nft";

const app = express();
app.use(express.json());
// Serve the static web UI when running as a standalone server (local dev /
// npm start).  On Vercel the public/ directory is served directly by the CDN,
// so this middleware is effectively a no-op in that environment.
app.use(express.static(path.join(__dirname, "..", "public")));

// ---------------------------------------------------------------------------
// Health check (used by monitoring tools and deployment pipelines)
// ---------------------------------------------------------------------------

/**
 * GET /api/health
 * Returns 200 with basic runtime information when the server is healthy.
 */
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    network: process.env["XRPL_NETWORK"] ?? "testnet",
  });
});

// ---------------------------------------------------------------------------
// Music generation
// ---------------------------------------------------------------------------

/**
 * POST /api/music/generate
 * Body: GeneratorOptions (all fields optional)
 * Returns: MusicTrack
 */
app.post("/api/music/generate", (req: Request, res: Response) => {
  try {
    const options: GeneratorOptions = req.body ?? {};
    const seed: number | undefined =
      typeof req.body?.seed === "number" ? req.body.seed : undefined;
    const track = generateTrack(options, seed);
    res.json({ success: true, track });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

/**
 * POST /api/music/serialize
 * Body: { track: MusicTrack }
 * Returns: { serialized: string }
 */
app.post("/api/music/serialize", (req: Request, res: Response) => {
  try {
    const serialized = serializeTrack(req.body.track);
    res.json({ success: true, serialized });
  } catch (err) {
    res.status(400).json({ success: false, error: String(err) });
  }
});

/**
 * POST /api/music/deserialize
 * Body: { serialized: string }
 * Returns: { track: MusicTrack }
 */
app.post("/api/music/deserialize", (req: Request, res: Response) => {
  try {
    const track = deserializeTrack(req.body.serialized);
    res.json({ success: true, track });
  } catch (err) {
    res.status(400).json({ success: false, error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

/**
 * POST /api/wallet/create
 * Creates and funds a new Testnet wallet.
 * Returns: WalletInfo
 */
app.post("/api/wallet/create", async (_req: Request, res: Response) => {
  try {
    const walletInfo = await createAndFundWallet();
    res.json({ success: true, wallet: walletInfo });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

/**
 * POST /api/wallet/from-seed
 * Body: { seed: string }
 * Returns: WalletInfo (no network call)
 */
app.post("/api/wallet/from-seed", (req: Request, res: Response) => {
  try {
    const info = walletFromSeed(req.body.seed);
    res.json({ success: true, wallet: info });
  } catch (err) {
    res.status(400).json({ success: false, error: String(err) });
  }
});

/**
 * GET /api/wallet/:address/balance
 * Returns: { balance: string } (in drops)
 */
app.get("/api/wallet/:address/balance", async (req: Request, res: Response) => {
  try {
    const balance = await getBalance(req.params["address"]);
    res.json({ success: true, balance });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// NFT
// ---------------------------------------------------------------------------

/**
 * POST /api/nft/mint
 * Body: { seed: string, track: MusicTrack, transferFee?: number }
 * Returns: { nftTokenId: string }
 */
app.post("/api/nft/mint", async (req: Request, res: Response) => {
  try {
    const { seed, track, transferFee } = req.body as {
      seed: string;
      track: ReturnType<typeof generateTrack>;
      transferFee?: number;
    };
    const wallet = Wallet.fromSeed(seed);
    const metadata: MusicNFTMetadata = {
      version: "1",
      track,
      creator: wallet.address,
    };
    const nftTokenId = await mintMusicNFT(wallet, metadata, transferFee ?? 0);
    res.json({ success: true, nftTokenId });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

/**
 * GET /api/nft/:address
 * Returns: { nfts: NFTokenRecord[] }
 */
app.get("/api/nft/:address", async (req: Request, res: Response) => {
  try {
    const nfts = await getAccountNFTs(req.params["address"]);
    res.json({ success: true, nfts });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// Scale data helper (used by the web UI piano roll)
// ---------------------------------------------------------------------------

/**
 * GET /api/scales/:name
 * Returns: { notes: number[] }
 */
app.get("/api/scales/:name", (req: Request, res: Response) => {
  const notes = buildScaleNotes(req.params["name"]);
  res.json({ success: true, notes });
});

export default app;
