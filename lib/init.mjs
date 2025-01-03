import { startScheduler } from "./scheduler.mjs";
import { getTransactions, decodeInputData } from "./etherscan.mjs";
import {
  saveTransaction,
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
      new Date(0),
      new Date()
    );
    const filteredTransactions = decodedTransactions.filter(
      (tx) => tx.decodedRawInput && extractNamadaKey(tx.decodedRawInput) !== ""
    );

    console.log(`Found ${filteredTransactions.length} historical transactions`);

    // Save transactions and mark blocks as scraped
    for (const tx of filteredTransactions) {
      await saveTransaction(tx);
      // Extract block number from transaction and mark it as scraped
      const blockNumber = tx.blockNumber; // Make sure this field exists in your transaction object
      await markBlockAsScraped(blockNumber, 1);
    }

    console.log("Initial scrape complete");
    return filteredTransactions;
  } catch (error) {
    console.error("Error during initial scrape:", error);
    throw error;
  }
}

export async function initialize() {
  if (isInitialized) {
    console.log("Server already initialized, skipping...");
    return;
  }

  console.log("Initializing server...");
  try {
    // First perform the initial scrape
    await performInitialScrape();

    // Then start the scheduler for ongoing updates
    console.log("Starting scheduler for ongoing updates...");
    startScheduler();

    isInitialized = true;
    console.log("Server initialization complete");
  } catch (error) {
    console.error("Error during server initialization:", error);
    throw error;
  }
}
