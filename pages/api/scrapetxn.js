import axios from 'axios';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { Pool } from 'pg';

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

// Create the pool connection (you can move this to a separate db.js file)
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: 'localhost',
  port: 5434,
  database: process.env.POSTGRES_DB
});

// Add a function to save transaction
async function saveTransaction(tx) {
  const query = `
    INSERT INTO donations 
    (transaction_hash, from_address, amount_eth, namada_key, input_message, timestamp)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (transaction_hash) DO NOTHING
    RETURNING *
  `;

  const values = [
    tx.hash,
    tx.from,
    tx.value,
    extractNamadaKey(tx.decodedRawInput),
    tx.decodedRawInput,
    new Date(tx.timestamp)
  ];

  return pool.query(query, values);
}

// Split into two API endpoints
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const { mode } = req.query;

  try {
    if (mode === 'initial') {
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

      // Save filtered transactions to database
      const savePromises = filteredTransactions.map(tx => saveTransaction(tx));
      await Promise.all(savePromises);

      return res.status(200).json(filteredTransactions);

    } else if (mode === 'recent') {
      const latestBlock = await getLatestBlock();
      if (!latestBlock) {
        return res.status(500).json({ message: 'Failed to fetch latest block' });
      }

      const startBlock = latestBlock - 1;
      console.log(`Fetching recent transactions from blocks ${startBlock} to ${latestBlock}...`);
      
      const transactions = await getTransactions(ADDRESS, startBlock, latestBlock);
      const decodedTransactions = decodeInputData(transactions, new Date(0), new Date());
      const filteredTransactions = decodedTransactions.filter(tx =>
        tx.decodedRawInput && (tx.decodedRawInput.includes("NAMADA") || 
        tx.decodedRawInput.includes("tpknam") || 
        tx.decodedRawInput.includes("tnam"))
      );

      // Save filtered transactions to database
      const savePromises = filteredTransactions.map(tx => saveTransaction(tx));
      await Promise.all(savePromises);

      return res.status(200).json(filteredTransactions);

    } else {
      return res.status(400).json({ message: 'Invalid mode specified. Use "initial" or "recent".' });
    }
  } catch (error) {
    console.error('Error processing transactions:', error);
    return res.status(500).json({ 
      error: 'Error processing transactions', 
      details: error.message 
    });
  }
}

function extractNamadaKey(message) {
  const match = message.match(/t(pk)?nam[a-zA-Z0-9]+/);
  return match ? match[0] : '';
}
