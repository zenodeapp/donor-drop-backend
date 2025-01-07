import { startScheduler } from "./scheduler.mjs";
import { getTransactions, decodeInputData } from "./etherscan.mjs";
import {
  saveTransactions,
  markBlockAsScraped,
  extractNamadaKey,
} from "./db.mjs";
import { ADDRESS, START_BLOCK } from "../_variables.mjs";
import { log, logError } from "../helpers.mjs";

let isInitialized = false;

async function performInitialScrape() {
  log("Starting initial blockchain scrape...");
  try {
    const transactions = await getTransactions(
      ADDRESS,
      START_BLOCK,
      99999999
    );
    const decodedTransactions = decodeInputData(
      transactions,
    );
    const filteredTransactions = decodedTransactions.filter(
      (tx) => tx.decodedRawInput && extractNamadaKey(tx.decodedRawInput) !== ""
    );

    log(`Found ${filteredTransactions.length} historical transactions`);

    // Save transactions
    await saveTransactions(filteredTransactions);

    // Mark the last block as scraped with the total number of transactions found
    let lastBlock;
    if (decodedTransactions.length === 0) {
      lastBlock = parseInt(START_BLOCK);
    } else {
      lastBlock = Math.max(...decodedTransactions.map(tx => parseInt(tx.block_number)));
    }
    await markBlockAsScraped(lastBlock, filteredTransactions.length);

    log("Initial scrape complete");
    return filteredTransactions;
  } catch (error) {
    logError("Error during initial scrape:", error);
    throw error;
  }
}

export async function initialize(skipInitialScrape = false) {
  if (isInitialized) {
    log('Server already initialized, skipping...');
    return;
  }

  log('Initializing server...');
  try {
    // Only perform initial scrape if not skipped
    if (!skipInitialScrape) {
      log('Performing initial scrape...');
      await performInitialScrape();
    } else {
      log('Skipping initial scrape...');
    }
    
    // Always start the scheduler
    log('Starting scheduler for ongoing updates...');
    startScheduler();
    
    isInitialized = true;
    log('Server initialization complete');
  } catch (error) {
    logError('Error during server initialization:', error);
    throw error;
  }
}
