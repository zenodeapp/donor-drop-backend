import axios from "axios";
import { ADDRESS, INFURA_API_KEY, INFURA_BASE_URL, VERBOSE_LOGGING } from "../_variables.mjs";
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

export async function getTransactionReceipt(txHash, retryCount = 0) {
  const BASE_DELAY = 1000;
  const MAX_RETRIES = 10;
  
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
    const response = await axios.post(`${INFURA_BASE_URL}/${INFURA_API_KEY}`, {
      jsonrpc: "2.0",
      method: "eth_getBlockByNumber",
      params: [finalized ? "finalized" : `0x${blockNumber.toString(16)}`, true],
      id: 1,
    });

    const block = response.data.result;
    
    if (!block) {
      if(VERBOSE_LOGGING) log(`Block ${blockNumber}: doesn't exist.`);
      return null;
    }

    if(finalized) {
      const finalizedBlock = parseInt(block.number);

      if (finalizedBlock > blockNumber) {
        // If the finalized block is greater than the latest polled block, it means that we missed this block, so call the function again with the latest block number.
        return await getBlockTransactions(blockNumber, false);
      }

      if(blockNumber > finalizedBlock) {
        // If the polled block is greater than the finalized block, we should not continue.
        if(VERBOSE_LOGGING) log(`Block ${blockNumber}: not finalized yet.`);
        return null;
      }
    } 

    const transactions = block.transactions
      .filter((tx) => tx.to?.toLowerCase() === ADDRESS.toLowerCase())
      .map(tx => formatTransaction(tx, block.timestamp));

    return transactions;
  } catch (error) {
    logError(`Error processing block ${blockNumber}:`, error.response.data);
    return null;
  }
};

export async function addReceiptsTo(transactions, batchSize = 50) {
  // Left this here in case we want to return to this approach without batching.
  // return await Promise.all(
  //   filteredTransactions
  //     .map(async (tx) => {
  //       const receipt = await getTransactionReceipt(tx.hash);
  //       return addReceipt(tx, receipt);
  //     })
  // );

  const result = [];

  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);

    const receipts = await Promise.all(
      batch.map(async (tx) => {
        const receipt = await getTransactionReceipt(tx.hash);
        return addReceipt(tx, receipt);
      })
    );

    result.push(...receipts);

    if (i + batchSize < transactions.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return result;
}

export async function getFinalizedTransactions(startBlock, endBlock) {
  const result = { transactions: [], lastSuccessfulBlock: null };
  log(`Processing block ${startBlock} - ${endBlock}...`);

  const batchResults = await Promise.all(
    [...Array(endBlock - startBlock + 1)].map((_, i) =>
      getBlockTransactions(startBlock + i, false)
    )
  );

  // Find the first `null` and slice off the elements after it
  const firstNullIndex = batchResults.findIndex((txs) => txs === null);

  // if a null is found, we should stop, cause a block failed to retrieve values
  if (firstNullIndex !== -1) {
    batchResults.slice(0, firstNullIndex).forEach((txs) => {
      result.transactions.push(...txs);
    });

    result.lastSuccessfulBlock = startBlock + firstNullIndex - 1; 

    return result;
  }

  // Add all transactions from the batch if they all succeeded
  batchResults.forEach((txs) => {
    result.transactions.push(...txs);
  });

  result.lastSuccessfulBlock = endBlock;

  return result;
}

export const getLatestFinalizedBlock = async () => {
  try {
    const response = await axios.post(`${INFURA_BASE_URL}/${INFURA_API_KEY}`, {
      jsonrpc: "2.0",
      method: "eth_getBlockByNumber",
      params: ["finalized", true],
      id: 1,
    });

    const block = response.data.result;

    if (!block) {
      logError(`Error getting last finalized block.`);
      throw new Error("Error getting last finalized block.");
    }

    return block.number;
  } catch (error) {
    logError(`Error getting last finalized block:`, error);
    throw error;
  }
}
