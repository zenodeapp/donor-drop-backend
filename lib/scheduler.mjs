import {
  getLatestBlock,
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
import { ADDRESS, START_BLOCK } from "../_variables.mjs";

export function startScheduler() {
  cron.schedule('*/12 * * * * *', async () => {
    try {
      const latestBlock = parseInt(await getLatestBlock());
      if (!latestBlock) {
        console.error('Failed to fetch latest block');
        return;
      }

      const lastScrapedBlock = parseInt(await getLastScrapedBlock() || START_BLOCK);
      const startBlock = lastScrapedBlock + 1;

      // Don't proceed if we've already scraped up to the latest block
      if (startBlock > latestBlock) {
        console.log(`No new blocks to scrape: startBlock (${startBlock}) > latestBlock (${latestBlock}). Last scraped block was ${lastScrapedBlock}`);
        return;
      }

      console.log(`Fetching transactions from blocks ${startBlock} to ${latestBlock}...`);
      
      // Get all transactions in one call
      const transactions = await getTransactions(ADDRESS, startBlock, latestBlock);
      // Decode input data filters out transactions that don't have input data, as well as failed txs
      const decodedTransactions = decodeInputData(transactions);
      const filteredTransactions = decodedTransactions.filter(tx =>
        tx.decodedRawInput && 
        extractNamadaKey(tx.decodedRawInput) !== ''
      );

      // Save filtered transactions to database in bulk
      if (filteredTransactions.length > 0) {
        await saveTransactions(filteredTransactions);
        console.log(`Found and saved ${filteredTransactions.length} transactions between blocks ${startBlock}-${latestBlock}`);
      }
      
       // Only mark the latest block where a transaction was found as scraped
      if (decodedTransactions.length > 0) {
        await markBlockAsScraped(
          Math.max(
            ...decodedTransactions.map((tx) => parseInt(tx.block_number))
          ),
          filteredTransactions.length
        );
      }
    } catch (error) {
      console.error('Error in cron job:', error);
    }
  });
}
