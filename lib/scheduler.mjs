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
import { getBlockTransactions, addReceipt } from "./infura.mjs";

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

        // Now add receipts
        const transactionsWithReceipts = await Promise.all(
          filteredTransactions
            .map(async (tx) => {
              const receipt = await getTransactionReceipt(tx.hash);
              return addReceipt(tx, receipt);
            })
        );

        const filteredTransactionsWithReceipts = transactionsWithReceipts.filter(tx => tx.txreceipt_status === '1' && tx.isError === '0');

        // Save filtered transactions to database in bulk
        if (filteredTransactionsWithReceipts.length > 0) {
          await saveTransactions(filteredTransactionsWithReceipts);
        }

        log(`Block ${startBlock}: ${transactions.length} transactions found, ${filteredTransactionsWithReceipts.length} saved.`);

        await markBlockAsScraped(
          startBlock,
          filteredTransactionsWithReceipts.length
        );
      }
    } catch (error) {
      logError('Error in cron job:', error);
    } finally {
      isRunning = false;
    }
  });
}

let isRunningFinalized = false;

export function startSchedulerFinalized() {
  cron.schedule('*/12 * * * * *', async () => {
    if(isRunning) {
      log('Previous job is still running, skipping this round.');
      return;
    }

    isRunning = true;

    try {
      const lastScrapedBlock = parseInt(await getLastScrapedBlock(true) || START_BLOCK);
      const startBlock = lastScrapedBlock + 1;

      const transactions = await getBlockTransactions(startBlock, true);

      if(transactions !== null) {
        // Decode input data filters out transactions that don't have input data, as well as failed txs
        const decodedTransactions = decodeInputData(transactions);
        const filteredTransactions = decodedTransactions.filter(tx =>
          tx.decodedRawInput && 
          extractNamadaKey(tx.decodedRawInput) !== ''
        );

        // Now add receipts
        const transactionsWithReceipts = await Promise.all(
          filteredTransactions
            .map(async (tx) => {
              const receipt = await getTransactionReceipt(tx.hash);
              return addReceipt(tx, receipt);
            })
        );

        const filteredTransactionsWithReceipts = transactionsWithReceipts.filter(tx => tx.txreceipt_status === '1' && tx.isError === '0');

        // Save filtered transactions to database in bulk
        if (filteredTransactionsWithReceipts.length > 0) {
          await saveTransactions(filteredTransactionsWithReceipts, true);
        }

        log(`Block ${startBlock}: ${transactions.length} finalized transactions found, ${filteredTransactionsWithReceipts.length} saved.`);

        await markBlockAsScraped(
          startBlock,
          filteredTransactionsWithReceipts.length,
          true
        );
      }
    } catch (error) {
      logError('Error in cron job:', error);
    } finally {
      isRunning = false;
    }
  });
}