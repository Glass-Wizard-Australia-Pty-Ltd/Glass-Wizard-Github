/**
 * Vercel serverless entry point
 *
 * Vercel's @vercel/node builder picks up this file and exposes it as a
 * serverless function.  All /api/* requests are rewritten here by vercel.json;
 * the Express app handles the internal routing.
 *
 * Static assets (public/*.html, public/*.css, public/*.js) are served
 * directly from Vercel's CDN – they never reach this function.
 */

import app from "../src/app";

export default app;
