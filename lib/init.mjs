import { startScheduler, startSchedulerFinalized } from "./scheduler.mjs";
import { getTransactions, decodeInputData, getLatestBlock } from "./etherscan.mjs";
import {
  saveTransactions,
  markBlockAsScraped,
  extractNamadaKey,
} from "./db.mjs";
import { ADDRESS, ETHERSCAN_BASE_URL, INFURA_BASE_URL, START_BLOCK } from "../_variables.mjs";
import { log, logError } from "../helpers.mjs";

let isInitialized = false;

const SAFETY_LAG = 50;

async function performInitialScrape() {
  log(`Starting initial blockchain scrape for ${ADDRESS}...`);
  log(`Using API endpoint: ${ETHERSCAN_BASE_URL}.`);

  try {
    const latestBlock = await getLatestBlock() || 1;

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

    log(`Found ${filteredTransactions.length} historical transactions.`);

    // Save transactions
    await saveTransactions(filteredTransactions);

    // The block to mark should either be the last block with a valid transaction or the latest block 
    // minus a margin. This to make sure we don't miss any transactions due to now using multiple endpoints.
    let blockToMark = Math.max(...decodedTransactions.map(tx => parseInt(tx.block_number)), 
      (Math.max(1, latestBlock - SAFETY_LAG)));
    
    // Mark the block scraped with the amount of transactions found.
    await markBlockAsScraped(blockToMark, filteredTransactions.length);

    log("Initial scrape complete");
    console.log();
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
    log(`Using API endpoint: ${INFURA_BASE_URL}.`);

    startScheduler();
    startSchedulerFinalized();
    
    isInitialized = true;
    log('Server initialization complete');
    console.log();
  } catch (error) {
    logError('Error during server initialization:', error);
    throw error;
  }
}
