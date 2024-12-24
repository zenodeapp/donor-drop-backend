import axios from 'axios';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.ETHERSCAN_API_KEY; 
const ADDRESS = process.env.COINCENTER_ADDRESS; 
const BASE_URL = process.env.ETHERSCAN_BASE_URL;
const START_DATE_STRING = process.env.SCRAPING_START_DATE;
const END_DATE_STRING = process.env.SCRAPING_END_DATE;

const CONTRACT_ABI = [
  {
    constant: false,
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [],
    type: 'function',
  },
];

const iface = new ethers.Interface(CONTRACT_ABI); 

// Date filter helper
const isWithinDateRange = (timestamp, startDate, endDate) => {
  const date = new Date(timestamp * 1000); 
  return date >= startDate && date <= endDate;
};

// New function to get the latest block number
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

// Modified to accept block range
const getTransactions = async (address, startBlock, endBlock) => {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        module: 'account',
        action: 'txlist',
        address: address,
        startblock: startBlock,
        endblock: endBlock,
        sort: 'asc',
        apikey: API_KEY,
      },
    });

    if (response.data.status === '1') {
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

// Decode input data for transactions
const decodeInputData = (transactions, startDate, endDate) => {
  return transactions
    .filter((tx) => isWithinDateRange(tx.timeStamp, startDate, endDate))
    .map((tx) => {
      try {
        if (tx.input && tx.input !== '0x') {
          const decodedData = iface.parseTransaction({ data: tx.input });
          return {
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: ethers.formatEther(tx.value),
            methodName: decodedData.name,
            arguments: decodedData.args,
            timestamp: new Date(tx.timeStamp * 1000).toISOString(),
          };
        }
      } catch (error) {
        // Decode the raw input to UTF-8
        let decodedRawInput = 'Unable to decode raw input as UTF-8';
        try {
          const hexString = tx.input.slice(2); // Remove '0x'
          const bytes = Buffer.from(hexString, 'hex'); // Convert hex to bytes
          decodedRawInput = bytes.toString('utf8'); // Convert bytes to UTF-8
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
        };
      }
      return null;
    })
    .filter((tx) => tx !== null); // Filter out null entries
};

// Split into two API endpoints
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const { mode } = req.query;

  if (mode === 'initial') {
    // Initial scraping of all historical transactions
    console.log('Fetching all historical transactions...');
    const transactions = await getTransactions(ADDRESS, 0, 99999999);
    const startDate = new Date(START_DATE_STRING);
    const endDate = new Date(END_DATE_STRING);

    console.log(`Filtering and decoding transactions from ${startDate} to ${endDate}...`);
    const decodedTransactions = decodeInputData(transactions, startDate, endDate);
    const filteredTransactions = decodedTransactions.filter(tx =>
      tx.decodedRawInput && (tx.decodedRawInput.includes("NAMADA") || 
      tx.decodedRawInput.includes("tpknam") || 
      tx.decodedRawInput.includes("tnam"))
    );

    return res.status(200).json(filteredTransactions);

  } else if (mode === 'recent') {
    // Scraping only recent blocks
    const latestBlock = await getLatestBlock();
    if (!latestBlock) {
      return res.status(500).json({ message: 'Failed to fetch latest block' });
    }

    // Look back ~13 seconds worth of blocks (assume ~1 block per 13 seconds)
    const startBlock = latestBlock - 1;
    console.log(`Fetching recent transactions from blocks ${startBlock} to ${latestBlock}...`);
    
    const transactions = await getTransactions(ADDRESS, startBlock, latestBlock);
    const decodedTransactions = decodeInputData(transactions, new Date(0), new Date());
    const filteredTransactions = decodedTransactions.filter(tx =>
      tx.decodedRawInput && (tx.decodedRawInput.includes("NAMADA") || 
      tx.decodedRawInput.includes("tpknam") || 
      tx.decodedRawInput.includes("tnam"))
    );

    return res.status(200).json(filteredTransactions);

  } else {
    return res.status(400).json({ message: 'Invalid mode specified. Use "initial" or "recent".' });
  }
}
