#!/usr/bin/env node
/*
 * Downloads the 1024x1024 App Store artwork used for the entertainment tiles.
 *
 * These images are trademarks of their respective owners and are NOT
 * distributed with this repository. They are fetched locally, only to
 * identify apps installed on the owner's own TV, and are verified against
 * the SHA-256 hashes in tools/icons.json.
 *
 * Usage: node tools/fetch-icons.js
 * Requires Node.js 18 or newer (no dependencies).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const MANIFEST = path.join(__dirname, "icons.json");
const OUT_DIR = path.join(ROOT, "app", "assets", "icons", "ios");

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function download(url, redirects) {
  redirects = redirects || 0;
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "Atelier-icon-fetch/1.0",
          Accept: "image/png,image/*;q=0.8"
        }
      },
      (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume();
          if (redirects >= 5) {
            reject(new Error("too many redirects"));
            return;
          }
          const next = new URL(res.headers.location, url).toString();
          resolve(download(next, redirects + 1));
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error("HTTP " + res.statusCode));
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("timed out")));
  });
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let fetched = 0;
  let verified = 0;
  const failures = [];

  for (const icon of manifest.icons) {
    const dest = path.join(ROOT, "app", icon.file);
    const expected = String(icon.sha256).toLowerCase();

    try {
      if (fs.existsSync(dest)) {
        const existing = fs.readFileSync(dest);
        if (sha256(existing) === expected) {
          verified++;
          continue;
        }
      }

      process.stdout.write("Fetching " + icon.name + " ... ");
      const body = await download(icon.url);
      const actual = sha256(body);
      if (actual !== expected) {
        throw new Error(
          "SHA-256 mismatch (expected " +
            expected +
            ", got " +
            actual +
            ")"
        );
      }
      if (icon.bytes && body.length !== icon.bytes) {
        throw new Error(
          "size mismatch (expected " + icon.bytes + ", got " + body.length + ")"
        );
      }

      const tmp = dest + ".part";
      fs.writeFileSync(tmp, body);
      fs.renameSync(tmp, dest);
      fetched++;
      console.log("ok (" + body.length + " bytes)");
    } catch (err) {
      console.log("FAILED: " + err.message);
      failures.push(icon.name + ": " + err.message);
    }
  }

  console.log("");
  console.log(
    "Icons: " +
      fetched +
      " downloaded, " +
      verified +
      " already present and verified, " +
      failures.length +
      " failed."
  );

  if (failures.length) {
    for (const failure of failures) {
      console.error("  " + failure);
    }
    console.error(
      "\nThe URLs are Apple's public artwork CDN and can change over time. " +
        "If a download fails, the app still builds, but that tile will show a " +
        "missing icon; you can replace it with your own PNG of the same name."
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
