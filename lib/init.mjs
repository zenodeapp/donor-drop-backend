import { startScheduler } from "./scheduler.mjs";
import { getTransactions, decodeInputData } from "./etherscan.mjs";
import {
  saveTransactions,
  markBlockAsScraped,
  extractNamadaKey,
} from "./db.mjs";

const ADDRESS = process.env.SCRAPER_ADDRESS;
const STARTING_BLOCK = process.env.SCRAPER_START_BLOCK || 0;
let isInitialized = false;

async function performInitialScrape() {
  console.log("Starting initial blockchain scrape...");
  try {
    const transactions = await getTransactions(
      ADDRESS,
      STARTING_BLOCK,
      99999999
    );
    const decodedTransactions = decodeInputData(
      transactions,
    );
    const filteredTransactions = decodedTransactions.filter(
      (tx) => tx.decodedRawInput && extractNamadaKey(tx.decodedRawInput) !== ""
    );

    console.log(`Found ${filteredTransactions.length} historical transactions`);

    // Save transactions
    await saveTransactions(filteredTransactions);

    // Mark the last block as scraped with the total number of transactions found
    let lastBlock;
    if (decodedTransactions.length === 0) {
      lastBlock = parseInt(process.env.SCANNING_START_BLOCK) || 0;
    } else {
      lastBlock = Math.max(...decodedTransactions.map(tx => parseInt(tx.block_number)));
    }
    await markBlockAsScraped(lastBlock, filteredTransactions.length);

    console.log("Initial scrape complete");
    return filteredTransactions;
  } catch (error) {
    console.error("Error during initial scrape:", error);
    throw error;
  }
}

export async function initialize(skipInitialScrape = false) {
  if (isInitialized) {
    console.log('Server already initialized, skipping...');
    return;
  }

  console.log('Initializing server...');
  try {
    // Only perform initial scrape if not skipped
    if (!skipInitialScrape) {
      console.log('Performing initial scrape...');
      await performInitialScrape();
    } else {
      console.log('Skipping initial scrape...');
    }
    
    // Always start the scheduler
    console.log('Starting scheduler for ongoing updates...');
    startScheduler();
    
    isInitialized = true;
    console.log('Server initialization complete');
  } catch (error) {
    console.error('Error during server initialization:', error);
    throw error;
  }
}
