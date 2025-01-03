import axios from "axios";
import { ethers } from "ethers";
import dotenv from "dotenv";

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

export const getLatestBlock = async () => {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        module: "proxy",
        action: "eth_blockNumber",
        apikey: API_KEY,
      },
    });
    return parseInt(response.data.result, 16);
  } catch (error) {
    console.error(`Error fetching latest block: ${error.message}`);
    return null;
  }
};

export const getTransactions = async (address, startBlock, endBlock) => {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        module: "account",
        action: "txlist",
        address: address,
        startblock: startBlock,
        endblock: endBlock,
        sort: "asc",
        apikey: API_KEY,
      },
    });

    if (response.data.status === "1") {
      return response.data.result;
    } else {
      console.error(`Error: ${response.data.message}`);
      return [];
    }
  } catch (error) {
    console.error(`Error fetching transactions: ${error.message}`);
    return [];
  }
};

export const decodeInputData = (transactions, startDate, endDate) => {
  return transactions
    .filter((tx) => isWithinDateRange(tx.timeStamp, startDate, endDate))
    .map((tx) => {
      try {
        if (tx.input && tx.input !== "0x") {
          const decodedData = iface.parseTransaction({ data: tx.input });
          return {
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: ethers.formatEther(tx.value),
            methodName: decodedData.name,
            arguments: decodedData.args,
            timestamp: new Date(tx.timeStamp * 1000).toISOString(),
            blockNumber: tx.blockNumber,
          };
        }
      } catch (error) {
        let decodedRawInput = "Unable to decode raw input as UTF-8";
        try {
          const hexString = tx.input.slice(2);
          const bytes = Buffer.from(hexString, "hex");
          decodedRawInput = bytes.toString("utf8");
        } catch (decodeError) {
          console.error(`Error decoding raw input: ${decodeError.message}`);
        }

        return {
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: ethers.formatEther(tx.value),
          rawInput: tx.input,
          decodedRawInput,
          timestamp: new Date(tx.timeStamp * 1000).toISOString(),
          blockNumber: tx.blockNumber,
        };
      }
      return null;
    })
    .filter((tx) => tx !== null);
};

const isWithinDateRange = (timestamp, startDate, endDate) => {
  const date = new Date(timestamp * 1000);
  return date >= startDate && date <= endDate;
};
