const fs = require("fs");
const path = require("path");

console.log("Générateur multi-chaînes démarré...");

const ROOT_DIR = path.resolve(__dirname, "..");
const CONFIG_FILE = path.join(ROOT_DIR, "config", "channels.json");
const OUTPUT_DIR = path.join(ROOT_DIR, "pages", "players");
const LOG_FILE = path.join(ROOT_DIR, "log.txt");
const BASE_DOMAIN = "https://livewatch.top";

function writeLog(message) {
  const line = "[" + new Date().toLocaleString() + "] " + message + "\n";
  fs.appendFileSync(LOG_FILE, line, "utf8");
}

function normalizeUrl(url) {
  const cleanUrl = String(url || "").trim();

  if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
    return cleanUrl;
  }

  if (cleanUrl.startsWith("/")) {
    return BASE_DOMAIN + cleanUrl;
  }

  return BASE_DOMAIN + "/" + cleanUrl;
}

function findStreamUrl(data) {
  if (typeof data === "string") {
    if (data.includes(".m3u8") || data.includes("api/proxy")) {
      return data;
    }
    return null;
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findStreamUrl(item);
      if (found) return found;
    }
  }

  if (data && typeof data === "object") {
    for (const value of Object.values(data)) {
      const found = findStreamUrl(value);
      if (found) return found;
    }
  }

  return null;
}

function sanitizeSlug(slug) {
  return String(slug || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}