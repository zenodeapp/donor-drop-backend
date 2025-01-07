import axios from "axios";
import { ADDRESS, INFURA_API_KEY, INFURA_BASE_URL } from "../_variables.mjs";
import { log, logError } from "../helpers.mjs";

function formatTransaction(tx, receipt, timestamp) {
  return {
    blockNumber: BigInt(tx.blockNumber).toString(),
    timeStamp: parseInt(timestamp, 16),
    hash: tx.hash,
    transactionIndex: parseInt(tx.transactionIndex, 16).toString(),
    from: tx.from,
    to: tx.to,
    value: BigInt(tx.value).toString(), 
    isError: receipt?.status === "0x0" ? "1" : "0",
    txreceipt_status: receipt?.status === "0x1" ? "1" : "0",
    input: tx.input,
  };
}

async function getTransactionReceipt(txHash) {
  try {
    const response = await axios.post(`${INFURA_BASE_URL}/${INFURA_API_KEY}`, {
      jsonrpc: "2.0",
      method: "eth_getTransactionReceipt",
      params: [txHash],
      id: 1,
    });
    return response.data.result;
  } catch (error) {
    logError(`Error fetching receipt for tx ${txHash}: ${error.message}`);
    throw error;
    // TODO: if this fails we should propagate an error
  }
}

export const getBlockTransactions = async (blockNumber) => {
  try {
    const response = await axios.post(`${INFURA_BASE_URL}/${INFURA_API_KEY}`, {
      jsonrpc: "2.0",
      method: "eth_getBlockByNumber",
      params: [`0x${blockNumber.toString(16)}`, true],
      id: 1,
    });

    const block = response.data.result;
    if (!block) {
      log(`Block ${blockNumber}: doesn't exist.`);
      return null;
    }

    const transactions = await Promise.all(
      block.transactions
        .filter((tx) => tx.to?.toLowerCase() === ADDRESS.toLowerCase())
        .map(async (tx) => {
          const receipt = await getTransactionReceipt(tx.hash);
          return formatTransaction(tx, receipt, block.timestamp);
        })
    );

    return transactions;
  } catch (error) {
    logError(`Error processing block ${blockNumber}:`, error);
    return null;
  }
};