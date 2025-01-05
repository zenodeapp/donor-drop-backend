import {
  getTransactions,
  decodeInputData,
} from "./etherscan.mjs";
import {
  saveTransactions,
  markBlockAsScraped,
  getLastScrapedBlock,
  extractNamadaKey,
} from "./db.mjs";
import cron from "node-cron";

const ADDRESS = process.env.SCRAPER_ADDRESS;

export function startScheduler() {
  cron.schedule('*/1 * * * * *', async () => {
    try {

      const lastScrapedBlock = parseInt(await getLastScrapedBlock() || process.env.SCANNING_START_BLOCK || 0);
      const startBlock = lastScrapedBlock + 1;

      // Don't proceed if we've already scraped up to the latest block
      console.log(`Fetching transactions from blocks ${startBlock} to 99999999...`);
      
      // Get all transactions in one call
      const transactions = await getTransactions(ADDRESS, startBlock, 99999999);
      // Decode input data filters out transactions that don't have input data, as well as failed txs
      const decodedTransactions = decodeInputData(transactions);
      const filteredTransactions = decodedTransactions.filter(tx =>
        tx.decodedRawInput && 
        extractNamadaKey(tx.decodedRawInput) !== ''
      );

      // Save filtered transactions to database in bulk
      if (filteredTransactions.length > 0) {
        await saveTransactions(filteredTransactions);
        console.log(`Found and saved ${filteredTransactions.length} transactions between blocks ${startBlock}-99999999`);
      }
      
       // Only mark the latest block where a transaction was found as scraped
      if (transactions.length > 0) {
        await markBlockAsScraped(
          Math.max(
            ...transactions.map((tx) => parseInt(tx.blockNumber))
          ),
          filteredTransactions.length
        );
      }
    } catch (error) {
      console.error('Error in cron job:', error);
    }
  });
}
