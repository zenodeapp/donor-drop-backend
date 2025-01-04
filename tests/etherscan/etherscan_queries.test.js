const axios = require('axios');
const cron = require('node-cron');
require('dotenv').config();

const BASE_URL = process.env.ETHERSCAN_BASE_URL;
const API_KEY = process.env.ETHERSCAN_API_KEY;

const getLatestBlock = async () => {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        module: 'proxy',
        action: 'eth_blockNumber',
        apikey: API_KEY,
      },
    });
    return parseInt(response.data.result, 16);
  } catch (error) {
    console.error(`Error fetching latest block: ${error.message}`);
    return null;
  }
};

const getTransactions = async (address, startBlock, endBlock) => {
  const MAX_RESULTS = 10000;
  let allTransactions = [];

  async function fetchBatch(currentStartBlock) {
    try {
      const response = await axios.get(BASE_URL, {
        params: {
          module: 'account',
          action: 'txlist',
          address: address,
          startblock: currentStartBlock,
          endblock: endBlock,
          sort: 'asc',
          apikey: API_KEY,
        },
      });

      if (response.data.status === '1') {
        const transactions = response.data.result;
        allTransactions = allTransactions.concat(transactions);

        if (transactions.length === MAX_RESULTS) {
          const lastBlockNumber = parseInt(transactions[transactions.length - 1].blockNumber);
          console.log(`Fetched ${MAX_RESULTS} transactions, continuing from block ${lastBlockNumber + 1}`);
          await new Promise(resolve => setTimeout(resolve, 200));
          await fetchBatch(lastBlockNumber + 1);
        }
      } else {
        console.error(`Error: ${response.data.message}`);
      }
    } catch (error) {
      console.error(`Error fetching transactions: ${error.message}`);
    }
  }

  await fetchBatch(startBlock);
  return allTransactions;
};

const startScheduler = (initialBlock, testAddress) => {
  let currentBlock = initialBlock;
  
  const job = cron.schedule('*/12 * * * * *', async () => {
    try {
      const latestBlock = await getLatestBlock();
      if (!latestBlock) {
        console.error('Failed to fetch latest block');
        return;
      }

      if (currentBlock > latestBlock) {
        console.log('No new blocks to scrape');
        return;
      }

      console.log(`Fetching transactions from blocks ${currentBlock} to ${latestBlock}...`);
      
      const transactions = await getTransactions(testAddress, currentBlock, latestBlock);
      if (transactions.length > 0) {
        console.log(`Found ${transactions.length} transactions`);
      }
      
      currentBlock = latestBlock + 1;
      return transactions;
    } catch (error) {
      console.error('Error in cron job:', error);
    }
  });

  return {
    stop: () => job.stop()
  };
};

describe('Scheduler', () => {
  it('should detect new transactions in subsequent blocks', async () => {
    const TEST_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
    
    const initialBlock = await getLatestBlock();
    console.log(`Starting test at block ${initialBlock}`);

    let newTransactionsFound = false;
    const scheduler = startScheduler(initialBlock, TEST_ADDRESS);

    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        scheduler.stop();
        resolve();
      }, 120000);

      const interval = setInterval(() => {
        if (newTransactionsFound) {
          clearTimeout(timeout);
          clearInterval(interval);
          scheduler.stop();
          resolve();
        }
      }, 1000);
    });

    const finalBlock = await getLatestBlock();
    console.log(`Test ended at block ${finalBlock}`);

    expect(finalBlock).toBeGreaterThan(initialBlock);
    expect(newTransactionsFound).toBe(true);
  }, 180000);
}); 