import {
  getLatestBlock,
  getTransactions,
  decodeInputData,
} from "./etherscan.mjs";
import {
  saveTransaction,
  isBlockScraped,
  markBlockAsScraped,
  getLastScrapedBlock,
  extractNamadaKey,
} from "./db.mjs";
import cron from "node-cron";

const ADDRESS = process.env.SCRAPER_ADDRESS;

export function startScheduler() {
  cron.schedule("*/13 * * * * *", async () => {
    try {
      const latestBlock = await getLatestBlock();
      if (!latestBlock) {
        console.error("Failed to fetch latest block");
        return;
      }

      const lastScrapedBlock = await getLastScrapedBlock();
      const startBlock = lastScrapedBlock + 1;

      // Don't proceed if we've already scraped up to the latest block
      if (startBlock > latestBlock) {
        console.log("No new blocks to scrape");
        return;
      }

      console.log(
        `Fetching transactions from blocks ${startBlock} to ${latestBlock}...`
      );

      // Process each block individually to ensure we don't miss any
      for (let blockNum = startBlock; blockNum <= latestBlock; blockNum++) {
        // Skip if block already scraped (extra safety check)
        if (await isBlockScraped(blockNum)) {
          continue;
        }

        const transactions = await getTransactions(ADDRESS, blockNum, blockNum);
        const decodedTransactions = decodeInputData(
          transactions,
          new Date(0),
          new Date()
        );
        const filteredTransactions = decodedTransactions.filter(
          (tx) =>
            tx.decodedRawInput && extractNamadaKey(tx.decodedRawInput) !== ""
        );

        // Save filtered transactions to database
        if (filteredTransactions.length > 0) {
          const savePromises = filteredTransactions.map((tx) =>
            saveTransaction(tx)
          );
          await Promise.all(savePromises);
          console.log(
            `Found and saved ${filteredTransactions.length} transactions in block ${blockNum}`
          );
        }

        // Mark block as scraped regardless of whether we found transactions
        await markBlockAsScraped(blockNum, filteredTransactions.length);
      }
    } catch (error) {
      console.error("Error in cron job:", error);
    }
  });
}
