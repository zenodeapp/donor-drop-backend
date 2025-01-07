import {
  decodeInputData,
} from "./etherscan.mjs";
import {
  saveTransactions,
  markBlockAsScraped,
  getLastScrapedBlock,
  extractNamadaKey,
} from "./db.mjs";
import cron from "node-cron";
import { START_BLOCK } from "../_variables.mjs";
import { log, logError } from "../helpers.mjs";
import { getBlockTransactions } from "./infura.mjs";

let isRunning = false;

export function startScheduler() {
  cron.schedule('*/3 * * * * *', async () => {
    if(isRunning) {
      log('Previous job is still running, skipping this round.');
      return;
    }

    isRunning = true;

    try {
      const lastScrapedBlock = parseInt(await getLastScrapedBlock() || START_BLOCK);
      const startBlock = lastScrapedBlock + 1;

      const transactions = await getBlockTransactions(startBlock);

      if(transactions !== null) {
        // Decode input data filters out transactions that don't have input data, as well as failed txs
        const decodedTransactions = decodeInputData(transactions);
        const filteredTransactions = decodedTransactions.filter(tx =>
          tx.decodedRawInput && 
          extractNamadaKey(tx.decodedRawInput) !== ''
        );

        log(`Found ${filteredTransactions.length} valid transactions.`);

        // Save filtered transactions to database in bulk
        if (filteredTransactions.length > 0) {
          await saveTransactions(filteredTransactions);
          log(`Saved ${filteredTransactions.length} valid transactions.`);
        }

        await markBlockAsScraped(
          startBlock,
          filteredTransactions.length
        );
      }
    } catch (error) {
      logError('Error in cron job:', error);
    } finally {
      isRunning = false;
    }
  });
}
