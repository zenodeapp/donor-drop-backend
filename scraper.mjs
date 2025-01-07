import { createServer } from "http";
import { initialize } from "./lib/init.mjs";
import { log, logError } from "./helpers.mjs";

const PORT = process.env.SCRAPER_PORT || 3000;

createServer(async (req, res) => {
  res.statusCode = 200;
  res.end();
}).listen(PORT, async (err) => {
  if (err) {
    logError("Error starting scraper:", err);
    return;
  }
  log(`Scraper running on http://localhost:${PORT}`);

  // Initialize server
  try {
    await initialize();
  } catch (error) {
    logError("Failed to initialize scraper:", error);
  }
});
