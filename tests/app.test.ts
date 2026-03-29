/**
 * Integration tests for the Express app routes (no live network calls)
 */

import request from "supertest";
import app from "../src/app";

// ── GET /api/health ──────────────────────────────────────────────────────────

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("includes a valid ISO timestamp", async () => {
    const res = await request(app).get("/api/health");
    expect(typeof res.body.timestamp).toBe("string");
    expect(Number.isNaN(new Date(res.body.timestamp).getTime())).toBe(false);
  });

  it("includes the network field", async () => {
    const res = await request(app).get("/api/health");
    expect(typeof res.body.network).toBe("string");
    expect(res.body.network.length).toBeGreaterThan(0);
  });

  it("defaults network to 'testnet' when XRPL_NETWORK is not set", async () => {
    const saved = process.env["XRPL_NETWORK"];
    delete process.env["XRPL_NETWORK"];

    const res = await request(app).get("/api/health");
    expect(res.body.network).toBe("testnet");

    if (saved !== undefined) process.env["XRPL_NETWORK"] = saved;
  });
});
