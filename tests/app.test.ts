import request from "supertest";
import app from "../src/app";

describe("GET /api/health", () => {
  let originalNetwork: string | undefined;

  beforeEach(() => {
    originalNetwork = process.env["XRPL_NETWORK"];
  });

  afterEach(() => {
    if (originalNetwork === undefined) {
      delete process.env["XRPL_NETWORK"];
    } else {
      process.env["XRPL_NETWORK"] = originalNetwork;
    }
  });

  it("returns HTTP 200", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
  });

  it("returns status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.body.status).toBe("ok");
  });

  it("returns a valid ISO timestamp", async () => {
    const res = await request(app).get("/api/health");
    expect(() => new Date(res.body.timestamp)).not.toThrow();
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });

  it("returns the XRPL network (defaults to testnet)", async () => {
    delete process.env["XRPL_NETWORK"];
    const res = await request(app).get("/api/health");
    expect(res.body.network).toBe("testnet");
  });
});
