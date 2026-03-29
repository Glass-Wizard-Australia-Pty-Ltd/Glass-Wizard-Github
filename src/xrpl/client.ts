/**
 * XRPL Client
 *
 * Manages a single shared connection to the XRP Ledger.
 * Defaults to the XRPL Testnet – change XRPL_NETWORK in your environment
 * to connect to Mainnet or Devnet.
 */

import { Client } from "xrpl";

export const NETWORK_URLS: Record<string, string> = {
  testnet: "wss://s.altnet.rippletest.net:51233",
  devnet:  "wss://s.devnet.rippletest.net:51233",
  mainnet: "wss://xrplcluster.com",
};

let sharedClient: Client | null = null;
let sharedClientUrl: string | null = null;

/**
 * Return (and lazily create) the shared XRPL client.
 * The client is automatically connected on first use.
 * If the requested network differs from the active connection, the old
 * connection is closed and a new one is established.
 */
export async function getClient(network?: string): Promise<Client> {
  const net = network ?? process.env["XRPL_NETWORK"] ?? "testnet";
  const url = NETWORK_URLS[net] ?? net; // allow passing a raw WSS URL

  if (sharedClient?.isConnected() && sharedClientUrl === url) {
    return sharedClient;
  }

  // Disconnect if pointing at a different URL
  if (sharedClient?.isConnected()) {
    await sharedClient.disconnect();
  }

  sharedClient = new Client(url);
  sharedClientUrl = url;
  await sharedClient.connect();
  return sharedClient;
}

/** Disconnect and discard the shared client (call on graceful shutdown). */
export async function disconnectClient(): Promise<void> {
  if (sharedClient?.isConnected()) {
    await sharedClient.disconnect();
  }
  sharedClient = null;
  sharedClientUrl = null;
}
