import axios from "axios";
import { ethers } from "ethers";
import dotenv from "dotenv";
import { END_DATE, START_DATE } from "../_variables.mjs";
import { log, logError } from "../helpers.mjs";

dotenv.config();

const API_KEY = process.env.ETHERSCAN_API_KEY;
const BASE_URL = process.env.ETHERSCAN_BASE_URL;

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

export const getTransactions = async (address, startBlock, endBlock) => {
  const MAX_RESULTS = 10000;
  const BASE_TIMEOUT = 1000;
  const MAX_TIMEOUT = 120000; 
  const BASE_DELAY = 200;
  // const MAX_DELAY = 5000;

  let allTransactions = [];
  
  async function fetchBatch(currentStartBlock, retries = 0) {
    const timeout = Math.min(BASE_TIMEOUT * 2 ** retries, MAX_TIMEOUT);
    // const delay = Math.min(BASE_DELAY * 2 ** retries, MAX_DELAY);

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
      logError(`Error fetching transactions: ${error.message}`);
      
      // Retry only on network or timeout errors
      if (error.code === 'ECONNABORTED' || error.response === undefined) {
        log(`Retrying (attempt ${retries + 1}) with timeout: ${timeout}ms`);
        
        // Also here we add a delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, BASE_DELAY));
        await fetchBatch(currentStartBlock, retries + 1);
      } else {
        // TODO: should we propagate the error?
        // throw error;
      }
    }
  }

  // Start the recursive fetching process
  await fetchBatch(startBlock);
  return allTransactions;
};

export const decodeInputData = (transactions) => {
  return transactions
    .filter((tx) => tx.isError === '0' && tx.txreceipt_status === '1' && isWithinDateRange(tx.timeStamp))
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
        // Try to decode as UTF-8 if contract parsing fails
        let decodedRawInput = 'Unable to decode raw input as UTF-8';
        try {
          const hexString = tx.input.slice(2);
          const bytes = Buffer.from(hexString, 'hex');
          decodedRawInput = bytes.toString('utf8');
        } catch (decodeError) {
          logError(`Error decoding raw input: ${decodeError.message}`);
        }

        return {
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: ethers.formatEther(tx.value),
          rawInput: tx.input,
          decodedRawInput,
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