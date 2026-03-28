/**
 * XRPL Wallet utilities
 *
 * Provides helpers for creating / loading wallets and funding them via the
 * Testnet faucet.  On Mainnet you must supply a funded wallet yourself.
 */

import { Wallet } from "xrpl";
import { getClient } from "./client";

export interface WalletInfo {
  address: string;
  publicKey: string;
  /** The private seed – store securely; NEVER log in production. */
  seed: string;
}

/**
 * Create a new random XRPL wallet and request Testnet funds from the faucet.
 * Returns the wallet details once the account is funded.
 */
export async function createAndFundWallet(): Promise<WalletInfo> {
  const client = await getClient();
  const { wallet } = await client.fundWallet();
  return {
    address:   wallet.address,
    publicKey: wallet.publicKey,
    seed:      wallet.seed ?? "",
  };
}

/**
 * Restore a wallet from its seed (family-seed / "s…" format).
 * No network call is required for this operation.
 */
export function walletFromSeed(seed: string): WalletInfo {
  const wallet = Wallet.fromSeed(seed);
  return {
    address:   wallet.address,
    publicKey: wallet.publicKey,
    seed,
  };
}

/**
 * Look up the XRP balance (in drops) of an account on the ledger.
 * Returns 0 if the account does not yet exist.
 */
export async function getBalance(address: string): Promise<string> {
  const client = await getClient();
  try {
    const response = await client.request({
      command: "account_info",
      account: address,
      ledger_index: "validated",
    });
    return response.result.account_data.Balance;
  } catch {
    return "0";
  }
}
