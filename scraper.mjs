import { createServer } from "http";
import { initialize } from "./lib/init.mjs";
import { log, logError } from "./helpers.mjs";

const PORT = process.env.SCRAPER_PORT || 3000;

const args = process.argv.slice(2);
const once = args.includes("--once");
const bypassTnamValidation = args.includes("--bypass-tnam-validation"); // This will also consider 'once' to be set to 'true'

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
    await initialize({
      once: bypassTnamValidation || once,
      bypassTnamValidation,
      writeToEtherscanTable: bypassTnamValidation, // currently bypassTnamValidation will make sure we write to the etherscan_transactions_all table.
    });
  } catch (error) {
    logError("Failed to initialize scraper:", error);
  }
});
