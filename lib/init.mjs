import { startScheduler, startSchedulerFinalized } from "./scheduler.mjs";
import { getTransactions, decodeInputData, getLatestBlock } from "./etherscan.mjs";
import {
  saveTransactions,
  markBlockAsScraped,
  extractNamadaKey,
  getLatestScrapedBlock,
} from "./db.mjs";
import { ADDRESS, ETHERSCAN_BASE_URL, INFURA_BASE_URL, START_BLOCK } from "../_variables.mjs";
import { log, logError } from "../helpers.mjs";
import { addReceiptsTo, getFinalizedTransactions, getLatestFinalizedBlock } from "./infura.mjs";

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

// IMPORTANT: this is not a historical scrape, because it continues from the latest scraped block.
// Changing the START_BLOCK env after the database was initialized won't change anything.
async function performInitialFinalizedScrape() {
  log(`Starting initial blockchain scrape for ${ADDRESS} (finalized)...`);
  log(`Using API endpoint: ${INFURA_BASE_URL}.`);

  try {
    const latestFinalizedBlock = await getLatestFinalizedBlock() || 1;
    const batchSize = 30;

    let startBlock = parseInt(await getLatestScrapedBlock(true) || START_BLOCK);

    while (startBlock <= latestFinalizedBlock) {
      const endBlock = Math.min(startBlock + batchSize - 1, latestFinalizedBlock);

      const { transactions, lastSuccessfulBlock } = await getFinalizedTransactions(
        startBlock,
        endBlock,
      );

      const filteredTransactions = decodeInputData(transactions).filter(
        (tx) => tx.decodedRawInput && extractNamadaKey(tx.decodedRawInput) !== ""
      );

      // Now add receipts. 4000 / 80 = 50 request per sec is the max for infura, but lowered it to play it safe.
      const transactionsWithReceipts = await addReceiptsTo(filteredTransactions, 30);

      // Filter receipts
      const filteredTransactionsWithReceipts = transactionsWithReceipts.filter(tx =>
        tx.txreceipt_status === '1' && tx.isError === '0');

      // Save transactions
      if (filteredTransactionsWithReceipts.length > 0)
        await saveTransactions(filteredTransactionsWithReceipts, true);

      log(`Found ${filteredTransactionsWithReceipts.length} transactions (finalized).`);

      // Mark the block scraped with the amount of transactions found.
      await markBlockAsScraped(lastSuccessfulBlock, filteredTransactionsWithReceipts.length, true);

      startBlock = lastSuccessfulBlock + 1; 

      // Delay between batches to avoid hitting the rate limit
      if (startBlock <= latestFinalizedBlock) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    log("Initial scrape complete (finalized)");
    console.log();
  } catch (error) {
    logError("Error during initial scrape (finalized):", error);
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
      await performInitialFinalizedScrape();
      // TODO: initial scrape method for finalized blocks perhaps?
    } else {
      log('Skipping initial scrape...');
    }
    
    // Always start the scheduler
    log('Starting schedulers for ongoing updates...');
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
