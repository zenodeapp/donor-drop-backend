import {
  decodeInputData,
} from "./etherscan.mjs";
import {
  saveTransactions,
  markBlockAsScraped,
  getLatestScrapedBlock,
  extractNamadaKey,
} from "./db.mjs";
import cron from "node-cron";
import { START_BLOCK } from "../_variables.mjs";
import { log, logError } from "../helpers.mjs";
import { getBlockTransactions, getTransactionReceipt, addReceipt } from "./infura.mjs";

let scheduler = { 
  busy: false,
  onlyFinalized: false,
  defaultLastScrapedBlock: START_BLOCK,
  interval: 1
};

let schedulerFinalized = { 
  busy: false,
  onlyFinalized: true,
  defaultLastScrapedBlock: START_BLOCK - 1, // since we don't perform an initial scrape for finalized blocks
  interval: 4
};

export function startScheduler() {
  cron.schedule(`*/${scheduler.interval} * * * * *`, async () => {
    await scrapeBlockchain(scheduler);
  });
}

export function startSchedulerFinalized() {
  cron.schedule(`*/${schedulerFinalized.interval} * * * * *`, async () => {
    await scrapeBlockchain(schedulerFinalized);
  });
}


async function scrapeBlockchain(_scheduler) {
  if(_scheduler.busy) {
    log('Previous job is still running, skipping this round.');
    return;
  }

  _scheduler.busy = true;

  const { finalized } = _scheduler;
  try {
    const lastScrapedBlock = parseInt(await getLatestScrapedBlock(finalized)
      || _scheduler.defaultLastScrapedBlock);
    const startBlock = lastScrapedBlock + 1;

    const transactions = await getBlockTransactions(startBlock, finalized);

    // No block found
    if(transactions === null) return;

    // Decode input data filters out transactions that don't have input data, as well as failed txs
    const filteredTransactions = decodeInputData(transactions).filter(tx =>
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

    const filteredTransactionsWithReceipts = transactionsWithReceipts.filter(tx =>
      tx.txreceipt_status === '1' && tx.isError === '0');

    // Save filtered transactions to database in bulk
    if (filteredTransactionsWithReceipts.length > 0) {
      await saveTransactions(filteredTransactionsWithReceipts, finalized);
    }

    log(`Block ${startBlock}: ${transactions.length} ${finalized ? 'finalized ' : ""}transactions found, ${filteredTransactionsWithReceipts.length} saved.`);

    await markBlockAsScraped(
      startBlock,
      filteredTransactionsWithReceipts.length,
      finalized
    );
  } catch (error) {
    logError('Error in cron job:', error);
  } finally {
    _scheduler.busy = false;
  }
}