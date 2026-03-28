/**
 * Unit tests for XRPL NFT utilities (mocked – no live network calls)
 */

import { decodeNFTMetadata } from "../src/xrpl/nft";
import { walletFromSeed } from "../src/xrpl/wallet";
import type { MusicNFTMetadata } from "../src/music/types";
import { generateTrack } from "../src/music/generator";

// ── decodeNFTMetadata ────────────────────────────────────────────────────────

describe("decodeNFTMetadata", () => {
  function encodeMetadata(meta: unknown): string {
    return Buffer.from(JSON.stringify(meta)).toString("hex");
  }

  it("decodes a valid MusicNFTMetadata from hex URI", () => {
    const track = generateTrack({ bars: 4 }, 7);
    const meta: MusicNFTMetadata = { version: "1", track, creator: "rTestAddress" };
    const hex = encodeMetadata(meta);
    const result = decodeNFTMetadata(hex);
    expect(result).not.toBeNull();
    expect(result!.version).toBe("1");
    expect(result!.creator).toBe("rTestAddress");
    expect(result!.track.name).toBe(track.name);
    expect(result!.track.notes).toEqual(track.notes);
  });

  it("returns null for invalid hex", () => {
    expect(decodeNFTMetadata("notvalidhex!!")).toBeNull();
  });

  it("returns null if JSON is missing the track field", () => {
    const hex = encodeMetadata({ version: "1", creator: "rX" });
    expect(decodeNFTMetadata(hex)).toBeNull();
  });

  it("returns null for a wrong version value", () => {
    const track = generateTrack({ bars: 2 }, 1);
    const hex = encodeMetadata({ version: "2", track, creator: "rX" });
    expect(decodeNFTMetadata(hex)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(decodeNFTMetadata("")).toBeNull();
  });

  it("roundtrips metadata through hex encoding", () => {
    const track = generateTrack({ bars: 4, style: "ambient" }, 42);
    const originalMeta: MusicNFTMetadata = {
      version: "1",
      track,
      creator: "rSomeCreatorAddress123",
    };
    const hex = encodeMetadata(originalMeta);
    const decoded = decodeNFTMetadata(hex);
    expect(decoded).not.toBeNull();
    expect(decoded!.track.tempo).toBe(track.tempo);
    expect(decoded!.track.scale).toBe(track.scale);
    expect(decoded!.track.style).toBe(track.style);
  });
});

// ── walletFromSeed ────────────────────────────────────────────────────────────

describe("walletFromSeed", () => {
  // Generate a valid seed via the Wallet class itself for portability
  let TEST_SEED: string;
  beforeAll(() => {
    const { Wallet } = require("xrpl");
    const w = Wallet.generate();
    TEST_SEED = w.seed as string;
  });

  it("returns a WalletInfo with address, publicKey, and seed", () => {
    const info = walletFromSeed(TEST_SEED);
    expect(info).toHaveProperty("address");
    expect(info).toHaveProperty("publicKey");
    expect(info).toHaveProperty("seed");
  });

  it("returned address starts with r (XRPL classic address prefix)", () => {
    const info = walletFromSeed(TEST_SEED);
    expect(info.address).toMatch(/^r/);
  });

  it("returned seed matches the input seed", () => {
    const info = walletFromSeed(TEST_SEED);
    expect(info.seed).toBe(TEST_SEED);
  });

  it("is deterministic – same seed always yields the same address", () => {
    const a = walletFromSeed(TEST_SEED);
    const b = walletFromSeed(TEST_SEED);
    expect(a.address).toBe(b.address);
    expect(a.publicKey).toBe(b.publicKey);
  });

  it("throws on invalid seed string", () => {
    expect(() => walletFromSeed("not-a-valid-seed")).toThrow();
  });
});

// ── MusicNFTMetadata shape ────────────────────────────────────────────────────

describe("MusicNFTMetadata structure", () => {
  it("version field is always the string '1'", () => {
    const track = generateTrack({ bars: 2 }, 5);
    const meta: MusicNFTMetadata = { version: "1", track, creator: "rAddr" };
    expect(meta.version).toBe("1");
  });

  it("creator is preserved through encode/decode", () => {
    const track = generateTrack({ bars: 2 }, 5);
    const creator = "rN7n3473SaZBCG4dFL83w7PB5AMmFfGQH";
    const meta: MusicNFTMetadata = { version: "1", track, creator };
    const hex = Buffer.from(JSON.stringify(meta)).toString("hex");
    const decoded = decodeNFTMetadata(hex);
    expect(decoded!.creator).toBe(creator);
  });
});
