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

const ADDRESS = process.env.SCRAPER_ADDRESS;

export function startScheduler() {
  cron.schedule('*/12 * * * * *', async () => {
    try {
      const latestBlock = parseInt(await getLatestBlock());
      if (!latestBlock) {
        console.error('Failed to fetch latest block');
        return;
      }

      const lastScrapedBlock = parseInt(await getLastScrapedBlock() || process.env.SCANNING_START_BLOCK || 0);
      const startBlock = lastScrapedBlock + 1;

      // Don't proceed if we've already scraped up to the latest block
      if (startBlock > latestBlock) {
        console.log(`No new blocks to scrape: startBlock (${startBlock}) > latestBlock (${latestBlock}). Last scraped block was ${lastScrapedBlock}`);
        return;
      }

      console.log(`Fetching transactions from blocks ${startBlock - 1} to ${latestBlock}...`);
      
      // Get all transactions in one call
      const transactions = await getTransactions(ADDRESS, startBlock - 1, latestBlock);
      // Decode input data filters out transactions that don't have input data, as well as failed txs
      const decodedTransactions = decodeInputData(transactions, new Date(0), new Date());
      const filteredTransactions = decodedTransactions.filter(tx =>
        tx.decodedRawInput && 
        extractNamadaKey(tx.decodedRawInput) !== ''
      );

      // Save filtered transactions to database in bulk
      if (filteredTransactions.length > 0) {
        await saveTransactions(filteredTransactions);
        console.log(`Found and saved ${filteredTransactions.length} transactions between blocks ${startBlock}-${latestBlock}`);
      }
      // Mark the latest block as scraped with the number of transactions found
      await markBlockAsScraped(latestBlock, filteredTransactions.length);

    } catch (error) {
      console.error('Error in cron job:', error);
    }
  });
}
