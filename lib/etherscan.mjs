import axios from "axios";
import { ethers } from "ethers";
import { END_DATE, ETHERSCAN_API_KEY, ETHERSCAN_BASE_URL, START_DATE } from "../_variables.mjs";
import { log, logError } from "../helpers.mjs";

const CONTRACT_ABI = [
  {
    constant: false,
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [],
    type: "function",
  },
];

const iface = new ethers.Interface(CONTRACT_ABI);

export const getLatestBlock = async () => {
  try {
    const response = await axios.get(ETHERSCAN_BASE_URL, {
      params: {
        module: "proxy",
        action: "eth_blockNumber",
        apikey: ETHERSCAN_API_KEY,
      },
    });
    return parseInt(response.data.result, 16);
  } catch (error) {
    console.error(`Error fetching latest block: ${error.message}`);
    return null;
  }
};

export const getTransactions = async (address, startBlock, endBlock) => {
  const MAX_RESULTS = 10000;
  const BASE_TIMEOUT = 1000;
  const MAX_TIMEOUT = 120000; 
  const BASE_DELAY = 200;
  const MAX_RETRIES = 10; // Only for errors other than network or timeout errors

  let allTransactions = [];

  async function fetchBatch(currentStartBlock, retries = 0) {
    const timeout = Math.min(BASE_TIMEOUT * 2 ** retries, MAX_TIMEOUT);

    // Helper function for retrying inside fetchBatch
    const retryWithDelay = async (delay = BASE_DELAY) => {
      log(`Retrying (attempt ${retries + 1}) with timeout: ${timeout}ms`);
      
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, delay));
      await fetchBatch(currentStartBlock, retries + 1);
    }

    try {
      const response = await axios.get(ETHERSCAN_BASE_URL, {
        params: {
          module: 'account',
          action: 'txlist',
          address: address,
          startblock: currentStartBlock,
          endblock: endBlock,
          sort: 'asc',
          apikey: ETHERSCAN_API_KEY,
        },
        timeout
      });

      if (response.data.status === '1') {
        const transactions = response.data.result;
        allTransactions = allTransactions.concat(transactions);

        // If we got MAX_RESULTS, we need to fetch the next batch
        if (transactions.length === MAX_RESULTS) {
          // Get the last block number from this batch and add 1
          const lastBlockNumber = parseInt(transactions[transactions.length - 1].blockNumber);
          log(`Fetched ${MAX_RESULTS} transactions, continuing from block ${lastBlockNumber + 1}`);
          
          // Add delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, BASE_DELAY));
          
          // Fetch next batch
          await fetchBatch(lastBlockNumber + 1);
        }
      } else {
        logError(`${response.data.message}`);
      }
    } catch (error) {
      logError('Error fetching transactions: ', error.message);

      // Retry indefinitely on network or timeout errors
      if (error.code === 'ECONNABORTED' || error.response === undefined) {
        await retryWithDelay();
      } else {
        // Only retry for a max amount of times when other errors occur
        if (retries < MAX_RETRIES) {
          await retryWithDelay(1000);
        } else {
          logError('Max retries reached.');
          throw error;
        }
      }
    }
  }

  // Start the recursive fetching process
  await fetchBatch(startBlock);
  return allTransactions;
};

export const decodeInputData = (transactions) => {
  return transactions
    .filter((tx) => isWithinDateRange(tx.timeStamp))
    .map((tx) => {
      try {
        // First check if input exists and isn't '0x'
        if (!tx.input || tx.input === '0x') {
          return {
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: ethers.formatEther(tx.value),
            decodedRawInput: '', // Empty string for no input
            timestamp: new Date(tx.timeStamp * 1000).toISOString(),
            block_number: tx.blockNumber,
            tx_index: tx.transactionIndex,
          };
        }

        // Try to decode as contract interaction
        // TODO: not sure why this is present, I assume this could be removed - leaving it in here for now (comment by ZEN).
        // If you remove this, make sure to also move the catch portion below.
        const decodedData = iface.parseTransaction({ data: tx.input });
        return {
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: ethers.formatEther(tx.value),
          methodName: decodedData.name,
          arguments: decodedData.args,
          timestamp: new Date(tx.timeStamp * 1000).toISOString(),
          block_number: tx.blockNumber,
          tx_index: tx.transactionIndex,
        };
      } catch (error) {
        const decodeRawInput = (input, maxIterations = 10) => {
          let currentInput = input;
        
          for (let i = 0; i < maxIterations; i++) {
            try {
              // First trim spaces then remove '0x'- or '0X'-prefix(es).
              currentInput = currentInput.trim().replace(/^(0x)+/i, '');

              const bytes = Buffer.from(currentInput, 'hex');
              const decoded = bytes.toString('utf8');
              
              // If we're not a hex value anymore, return it.
              if (!/^[0-9a-fA-F]+$/.test(decoded)) return decoded;

              // Continue if we're still a hex value
              currentInput = decoded;
            } catch (error) {
              logError(`Error decoding raw input: ${error.message}`);
              break;
            }
          }
          
          // Decoding failed if we got to this point.
          return null;
        };

        return {
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: ethers.formatEther(tx.value),
          rawInput: tx.input,
          decodedRawInput: decodeRawInput(tx.input) || 'Unable to decode raw input as UTF-8',
          timestamp: new Date(tx.timeStamp * 1000).toISOString(),
          block_number: tx.blockNumber,
          tx_index: tx.transactionIndex,
        };
      }
    })
    .filter((tx) => tx !== null);
};

const isWithinDateRange = (timestamp) => {
  const date = new Date(timestamp * 1000);
  return date >= START_DATE && date <= END_DATE;
};