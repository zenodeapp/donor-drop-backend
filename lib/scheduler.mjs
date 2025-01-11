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
import { START_BLOCK, VERBOSE_LOGGING } from "../_variables.mjs";
import { log, logError } from "../helpers.mjs";
import { getBlockTransactions, addReceiptsTo } from "./infura.mjs";

let scheduler = { 
  busy: false,
  queryFinalized: false,
  defaultLastScrapedBlock: START_BLOCK,
  interval: 1
};

let schedulerFinalized = { 
  busy: false,
  queryFinalized: true,
  defaultLastScrapedBlock: START_BLOCK - 1, // since we don't perform an initial scrape for finalized blocks
  interval: 12
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
    if(VERBOSE_LOGGING)
      log(`Previous job ${(_scheduler.queryFinalized ? '(finalized) ' : '')}is still running, skipping this round.`);
    return;
  }

  _scheduler.busy = true;

  const { queryFinalized } = _scheduler;
  try {
    const lastScrapedBlock = parseInt(await getLatestScrapedBlock(queryFinalized)
      || _scheduler.defaultLastScrapedBlock);
    const startBlock = lastScrapedBlock + 1;

    const transactions = await getBlockTransactions(startBlock, queryFinalized);

    // No block found
    if(transactions === null) return;

    // Decode input data filters out transactions that don't have input data, as well as failed txs
    const filteredTransactions = decodeInputData(transactions).filter(
      tx => tx.decodedRawInput && extractNamadaKey(tx.decodedRawInput) !== ''
    );

    // Now add receipts. 4000 / 80 = 50 request per sec is the max for infura, but lowered it to play it safe.
    const transactionsWithReceipts = await addReceiptsTo(filteredTransactions, 30);

    // Filter receipts
    const filteredTransactionsWithReceipts = transactionsWithReceipts.filter(tx =>
      tx.txreceipt_status === '1' && tx.isError === '0');

    // Save filtered transactions to database in bulk
    if (filteredTransactionsWithReceipts.length > 0) await saveTransactions(filteredTransactionsWithReceipts, queryFinalized);

    log(`Block ${startBlock}: ${transactions.length} ${queryFinalized ? 'finalized ' : ""}transactions found, ${filteredTransactionsWithReceipts.length} saved.`);

    await markBlockAsScraped(
      startBlock,
      filteredTransactionsWithReceipts.length,
      queryFinalized
    );
  } catch (error) {
    logError('Error in cron job:', error);
  } finally {
    _scheduler.busy = false;
  }
}