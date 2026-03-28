/**
 * XRPL NFT operations (XLS-20 standard)
 *
 * Provides helpers for minting, querying and burning NFTs that hold
 * Glass Wizard music metadata.
 */

import { Wallet, convertStringToHex } from "xrpl";
import type { NFTokenMint } from "xrpl";
import { getClient } from "./client";
import type { MusicNFTMetadata } from "../music/types";

// NFT flags
const NFT_FLAG_TRANSFERABLE = 8;

/**
 * Mint a new NFT on the XRPL that encodes the supplied music metadata.
 *
 * The metadata JSON is hex-encoded and stored in the NFT's URI field.
 * Returns the NFTokenID of the newly minted token.
 */
export async function mintMusicNFT(
  wallet: Wallet,
  metadata: MusicNFTMetadata,
  /** Optional royalty in units of 1/1000 of 1% (e.g. 1000 = 1%). Max 50000. */
  transferFee = 0,
): Promise<string> {
  const client = await getClient();

  const metadataJson = JSON.stringify(metadata);
  const uriHex = convertStringToHex(metadataJson);

  const tx: NFTokenMint = {
    TransactionType: "NFTokenMint",
    Account:         wallet.address,
    URI:             uriHex,
    Flags:           NFT_FLAG_TRANSFERABLE,
    TransferFee:     transferFee,
    NFTokenTaxon:    0, // Application-defined category; 0 = Glass Wizard Music
  };

  const response = await client.submitAndWait(tx, { wallet });

  // Extract the NFTokenID from the transaction metadata
  const meta = response.result.meta;
  if (typeof meta === "string" || !meta) {
    throw new Error("Unexpected transaction metadata format");
  }

  const nfTokenId = extractNFTokenID(meta);
  if (!nfTokenId) {
    throw new Error("Could not extract NFTokenID from transaction result");
  }
  return nfTokenId;
}

/**
 * Retrieve all NFTs owned by the given account address.
 * Returns raw NFT objects from the XRPL.
 */
export async function getAccountNFTs(address: string): Promise<NFTokenRecord[]> {
  const client = await getClient();
  const response = await client.request({
    command:      "account_nfts",
    account:      address,
    ledger_index: "validated",
  });

  return (response.result.account_nfts as unknown as RawNFT[]).map(parseNFT);
}

/**
 * Decode the URI of an NFT back to a MusicNFTMetadata object.
 * Returns null if the URI is absent or the JSON is not recognisable.
 */
export function decodeNFTMetadata(uriHex: string): MusicNFTMetadata | null {
  try {
    const json = Buffer.from(uriHex, "hex").toString("utf8");
    const parsed = JSON.parse(json) as MusicNFTMetadata;
    if (parsed.version !== "1" || !parsed.track) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internal types & helpers
// ---------------------------------------------------------------------------

export interface NFTokenRecord {
  nftTokenId: string;
  taxon:      number;
  flags:      number;
  transferFee: number;
  issuer:     string;
  uri:        string | null;
  metadata:   MusicNFTMetadata | null;
}

interface RawNFT {
  NFTokenID:   string;
  Taxon:       number;
  Flags:       number;
  TransferFee: number;
  Issuer:      string;
  URI?:        string;
}

function parseNFT(raw: RawNFT): NFTokenRecord {
  const uri = raw.URI ?? null;
  return {
    nftTokenId:  raw.NFTokenID,
    taxon:       raw.Taxon,
    flags:       raw.Flags,
    transferFee: raw.TransferFee ?? 0,
    issuer:      raw.Issuer,
    uri,
    metadata:    uri ? decodeNFTMetadata(uri) : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractNFTokenID(meta: Record<string, any>): string | null {
  const nodes: unknown[] = meta["AffectedNodes"] ?? [];
  for (const node of nodes) {
    if (typeof node !== "object" || node === null) continue;
    const created = (node as Record<string, unknown>)["CreatedNode"];
    if (
      typeof created === "object" &&
      created !== null &&
      (created as Record<string, unknown>)["LedgerEntryType"] === "NFTokenPage"
    ) {
      const newFields = (created as Record<string, unknown>)["NewFields"] as
        | Record<string, unknown>
        | undefined;
      const nfTokens = newFields?.["NFTokens"] as unknown[] | undefined;
      if (Array.isArray(nfTokens) && nfTokens.length > 0) {
        const first = nfTokens[nfTokens.length - 1] as Record<string, unknown>;
        const token = first["NFToken"] as Record<string, unknown> | undefined;
        if (token?.["NFTokenID"]) return token["NFTokenID"] as string;
      }
    }
  }
  return null;
}
