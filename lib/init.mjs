import { startScheduler, startSchedulerFinalized } from "./scheduler.mjs";
import {
  getTransactions,
  decodeInputData,
  getLatestBlock,
} from "./etherscan.mjs";
import {
  saveTransactions,
  markBlockAsScraped,
  extractNamadaKey,
} from "./db.mjs";
import {
  ADDRESS,
  ETHERSCAN_BASE_URL,
  INFURA_BASE_URL,
  START_BLOCK,
} from "../_variables.mjs";
import { log, logError } from "../helpers.mjs";
import {
  addReceiptsTo,
  getFinalizedTransactions,
  getLatestFinalizedBlock,
} from "./infura.mjs";

// Lag between Etherscan and Infura should never exceed 50 blocks. Else our scraper will miss blocks.
const SAFETY_LAG = 50;
// TODO: likely this can be removed in the current setting.
let isInitialized = false;

async function performInitialScrape() {
  try {
    const latestBlock = (await getLatestBlock()) || 1;
    if (latestBlock < START_BLOCK) {
      log(
        "The latest block is lower than the start block, no initial scrape needed."
      );
      return;
    }

    log(`Starting initial blockchain scrape...`);
    log(`Using API endpoint: ${ETHERSCAN_BASE_URL}.`);

    const transactions = await getTransactions(
      ADDRESS,
      START_BLOCK,
      latestBlock
    );

    const { filteredTransactions, lastSeenBlock } =
      await processAndSaveTransactions(transactions);

    // The block to mark should either be the last block with a valid transaction or the latest block
    // minus a margin. This to make sure we don't miss any transactions due to now using multiple endpoints.
    let blockToMark = Math.max(
      lastSeenBlock,
      Math.max(latestBlock - SAFETY_LAG, 1)
    );

    // Mark the block scraped with the amount of transactions found.
    await markBlockAsScraped(blockToMark, filteredTransactions.length);
  } catch (error) {
    logError("Error during initial scrape:", error);
    throw error;
  }
}

async function performInitialFinalizedScrape() {
  try {
    const latestBlock = (await getLatestFinalizedBlock()) || 1;
    if (latestBlock < START_BLOCK) {
      log(
        "The latest block is lower than the start block, no initial scrape for finalized blocks needed."
      );
      return;
    }

    log(`Starting initial finalized blockchain scrape...`);
    log(`Using API endpoint: ${ETHERSCAN_BASE_URL}.`);

    // We'll count all transactions found to eventually mark one block with this amount
    let transactionCount = 0;

    // Compensating lag between Etherscan and Infura
    const latestBlockSafe = Math.max(latestBlock - SAFETY_LAG, 1);

    const transactions = await getTransactions(
      ADDRESS,
      START_BLOCK,
      latestBlockSafe
    );

    const { filteredTransactions } = await processAndSaveTransactions(
      transactions,
      true
    );

    transactionCount = transactionCount + filteredTransactions.length;

    log(
      `Scraping remaining finalized blocks with API endpoint: ${INFURA_BASE_URL}.`
    );

    const batchSize = 30;
    let startBlock = latestBlockSafe;
    while (startBlock <= latestBlock) {
      const endBlock = Math.min(startBlock + batchSize - 1, latestBlock);

      const { transactions, lastSuccessfulBlock } =
        await getFinalizedTransactions(startBlock, endBlock);

      const { filteredTransactions } = await processAndSaveTransactions(
        transactions,
        true,
        true
      );

      transactionCount = transactionCount + filteredTransactions.length;

      startBlock = lastSuccessfulBlock + 1;

      if (startBlock <= latestBlock)
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    await markBlockAsScraped(latestBlock, transactionCount, true);
  } catch (error) {
    logError("Error during initial scrape (finalized):", error);
    throw error;
  }
}

async function processAndSaveTransactions(
  transactions,
  finalized = false,
  addReceipts = false
) {
  const decodedTransactions = decodeInputData(transactions);
  let filteredTransactions = decodedTransactions.filter(
    (tx) => tx.decodedRawInput && extractNamadaKey(tx.decodedRawInput) !== ""
  );

  // Receipts get added in batches. 4000 credits / 80 per call = 50 request per sec as the max for Infura.
  if (addReceipts) {
    filteredTransactions = await addReceiptsTo(filteredTransactions, 30);
  }

  filteredTransactions.filter(
    (tx) => tx.txreceipt_status === "1" && tx.isError === "0"
  );

  if (filteredTransactions.length > 0) {
    await saveTransactions(filteredTransactions, finalized);
  }

  log(
    `Found ${filteredTransactions.length} historical ${
      finalized ? "finalized " : ""
    }transactions.`
  );

  return {
    filteredTransactions,
    lastSeenBlock: Math.max(
      ...decodedTransactions.map((tx) => parseInt(tx.block_number))
    ),
  };
}

export async function initialize(skipInitialScrape = false) {
  if (isInitialized) {
    log("Server already initialized, skipping...");
    return;
  }

  log("Initializing server...");
  log(`Address configured to: ${ADDRESS}`);
  log(`Start block: ${START_BLOCK}`);
  try {
    // Only perform initial scrape if not skipped
    if (!skipInitialScrape) {
      log("Performing initial scrape...");
      await performInitialScrape();
      console.log();
      await performInitialFinalizedScrape();
      log("Initial scrape complete!");
      console.log();
    } else {
      log("Skipping initial scrape...");
    }

    // Always start the scheduler
    log("Starting schedulers for ongoing updates...");
    log(`Using API endpoint: ${INFURA_BASE_URL}.`);

    startScheduler();
    startSchedulerFinalized();

    isInitialized = true;
    log("Server initialization complete.");
    console.log();
  } catch (error) {
    logError("Error during server initialization:", error);
    throw error;
  }
}