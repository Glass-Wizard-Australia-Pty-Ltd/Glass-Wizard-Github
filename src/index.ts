/**
 * Glass Wizard Music NFT – CLI entry point
 *
 * Quick demonstration that exercises the music generator and shows
 * how to interact with the XRPL.  Run with:
 *   npm run dev   (ts-node src/index.ts)
 */

import { generateTrack, serializeTrack } from "./music/generator";
import { disconnectClient } from "./xrpl/client";

async function main() {
  console.log("=== Glass Wizard – Digital Music AI + XRPL NFT ===\n");

  // 1. Generate a sample track
  console.log("Generating AI music track...");
  const track = generateTrack({ style: "electronic", bars: 8 }, 42);
  console.log(`  Name   : ${track.name}`);
  console.log(`  Style  : ${track.style}`);
  console.log(`  Scale  : ${track.scale}`);
  console.log(`  Tempo  : ${track.tempo} BPM`);
  console.log(`  Notes  : ${track.notes.length}`);
  console.log(`  Duration: ${track.totalBeats} beats`);

  // 2. Serialise (shows what gets stored in NFT URI)
  const serialized = serializeTrack(track);
  console.log(`\nSerialized track length: ${serialized.length} chars`);
  console.log("First 120 chars of serialized track:");
  console.log(" ", serialized.slice(0, 120) + "…");

  // 3. Wallet / NFT example (Testnet only)
  if (process.env["DEMO_XRPL"] === "true") {
    const { createAndFundWallet } = await import("./xrpl/wallet");
    const { mintMusicNFT } = await import("./xrpl/nft");
    const { Wallet } = await import("xrpl");

    console.log("\nFunding a new Testnet wallet (this may take ~30s)…");
    const walletInfo = await createAndFundWallet();
    console.log(`  Address: ${walletInfo.address}`);
    console.log(`  Balance: check https://testnet.xrpl.org/accounts/${walletInfo.address}`);

    console.log("\nMinting music as NFT on Testnet…");
    const wallet = Wallet.fromSeed(walletInfo.seed);
    const nftId = await mintMusicNFT(wallet, {
      version: "1",
      track,
      creator: walletInfo.address,
    });
    console.log(`  NFT minted! TokenID: ${nftId}`);
    console.log(`  View at: https://testnet.xrpl.org/nft/${nftId}`);
  } else {
    console.log("\n(Skipping XRPL demo – set DEMO_XRPL=true to enable)");
  }

  await disconnectClient();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
