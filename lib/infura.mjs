import axios from "axios";
import { ADDRESS, INFURA_API_KEY, INFURA_BASE_URL } from "../_variables.mjs";
import { log, logError } from "../helpers.mjs";

function formatTransaction(tx, timestamp) {
  return {
    blockNumber: BigInt(tx.blockNumber).toString(),
    timeStamp: parseInt(timestamp, 16),
    hash: tx.hash,
    transactionIndex: parseInt(tx.transactionIndex, 16).toString(),
    from: tx.from,
    to: tx.to,
    value: BigInt(tx.value).toString(), 
    input: tx.input,
  };
}

export function addReceipt(tx, receipt) {
  return {
    ...tx,
    isError: receipt?.status === "0x0" ? "1" : "0",
    txreceipt_status: receipt?.status === "0x1" ? "1" : "0",
  };
}

const MAX_RETRIES = 5;
const BASE_DELAY = 1000; // Start with 1 second delay

export async function getTransactionReceipt(txHash, retryCount = 0) {
  try {
    const response = await axios.post(`${INFURA_BASE_URL}/${INFURA_API_KEY}`, {
      jsonrpc: "2.0",
      method: "eth_getTransactionReceipt",
      params: [txHash],
      id: 1,
    });
    return response.data.result;
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      const delay = BASE_DELAY * Math.pow(2, retryCount); // Exponential backoff
      logError(`Attempt ${retryCount + 1}/${MAX_RETRIES} failed for tx ${txHash}. Retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return getTransactionReceipt(txHash, retryCount + 1);
    }

    logError(`Failed to fetch receipt for tx ${txHash} after ${MAX_RETRIES} attempts: ${error.message}`);
    throw error;
  }
}

export const getBlockTransactions = async (blockNumber, finalized = false) => {
  try {
    const parameterOne = finalized ? "finalized" : `0x${blockNumber.toString(16)}`;
    const response = await axios.post(`${INFURA_BASE_URL}/${INFURA_API_KEY}`, {
      jsonrpc: "2.0",
      method: "eth_getBlockByNumber",
      params: [parameterOne, true],
      id: 1,
    });

    const block = response.data.result;
    if (!block) {
      log(`Block ${blockNumber}: doesn't exist.`);
      return null;
    }

    if (finalized && block.number > blockNumber) {
      // If the block number is greater than the block number of the latest block, it means that we missed a block, so call the function again with the latest block number.
      return await getBlockTransactions(blockNumber, false);
    }

    const transactions = block.transactions
      .filter((tx) => tx.to?.toLowerCase() === ADDRESS.toLowerCase())
      .map(tx => formatTransaction(tx, block.timestamp));

    return transactions;
  } catch (error) {
    logError(`Error processing block ${blockNumber}:`, error);
    return null;
  }
};