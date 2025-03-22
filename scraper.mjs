import { createServer } from "http";
import { initialize } from "./lib/init.mjs";
import { log, logError } from "./helpers.mjs";

const PORT = process.env.SCRAPER_PORT || 3000;

// Gets all given arguments if there are any.
const args = process.argv.slice(2);

// --once will only scrape a single time, without running any schedulers.
const once = args.includes("--once");

// --all-etherscan-txs will make sure we skip tnam validation, only scrape using etherscan, write to the etherscan_transactions_all table and considers '--once' to be set.
const allEtherscanTxs = args.includes("--all-etherscan-txs");

// --bypass-tnam-validation will skip tnam validation in both the scheduler and initial scrape.
// WARNING: NOT adviced to use due to incompatibilities with the database!
const bypassTnamValidation = args.includes("--bypass-tnam-validation");

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
      once: allEtherscanTxs || once,
      allEtherscanTxs,
      bypassTnamValidation: allEtherscanTxs || bypassTnamValidation,
    });
  } catch (error) {
    logError("Failed to initialize scraper:", error);
  }
});
