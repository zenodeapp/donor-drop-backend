import axios from "axios";
import { ADDRESS, INFURA } from "../_variables.mjs";
import { log, logError } from "../helpers.mjs";

function formatTransaction(tx, receipt) {
  return {
    blockNumber: parseInt(tx.blockNumber, 16).toString(),
    timeStamp: Date.now().toString().slice(0, 10), // Replace with actual timestamp if available
    hash: tx.hash,
    transactionIndex: parseInt(tx.transactionIndex, 16).toString(),
    from: tx.from,
    to: tx.to,
    value: parseInt(tx.value, 16).toString(), // Convert from hex to decimal (in wei)
    gas: parseInt(tx.gas, 16).toString(),
    gasPrice: parseInt(tx.gasPrice, 16).toString(),
    isError: receipt?.status === "0x0" ? "1" : "0", // Use receipt status to determine error
    txreceipt_status: receipt?.status === "0x1" ? "1" : "0", // Use receipt status to determine success
    input: tx.input,
    contractAddress: receipt?.contractAddress || "",
    cumulativeGasUsed: receipt?.cumulativeGasUsed,
    gasUsed: receipt?.gasUsed,
    logs: receipt?.logs || [],
  };
}

async function getTransactionReceipt(txHash) {
  try {
    const response = await axios.post(INFURA, {
      jsonrpc: "2.0",
      method: "eth_getTransactionReceipt",
      params: [txHash],
      id: 1,
    });
    return response.data.result;
  } catch (error) {
    logError(`Error fetching receipt for tx ${txHash}: ${error.message}`);
    return null;
  }
}

export const getBlockTransactions = async (blockNumber) => {
  // log(`Fetching block: ${blockNumber}...`);
  try {
    const response = await axios.post(INFURA, {
      jsonrpc: "2.0",
      method: "eth_getBlockByNumber",
      params: [`0x${blockNumber.toString(16)}`, true],
      id: 1,
    });
    const block = response.data.result;

    if (!block) {
      log(`Block ${blockNumber} not found.`);
      return null;
    }

    const transactions = await Promise.all(
      block.transactions
        .filter((tx) => tx.to?.toLowerCase() === ADDRESS.toLowerCase())
        .map(async (tx) => {
          const receipt = await getTransactionReceipt(tx.hash);
          console.log(receipt);
          return formatTransaction(tx, receipt);
        })
    );

    log(`Found ${transactions.length} transactions to ${ADDRESS} in block ${blockNumber}.`);
    return transactions;
  } catch (error) {
    logError(`Error processing block ${blockNumber}:`, error);
    return null;
  }
};