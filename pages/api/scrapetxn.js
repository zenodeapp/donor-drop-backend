
import axios from 'axios';
import { ethers } from 'ethers';

// Setup
const API_KEY = 'U42S46F9HAIY1NV5U2P186USKB6N89KEQP'; 
const ADDRESS = '0x15322B546e31F5Bfe144C4ae133A9Db6F0059fe3'; 
const BASE_URL = 'https://api.etherscan.io/api';

// Example contract ABI (replace this with the actual contract ABI if known)
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
  const date = new Date(timestamp * 1000); // Convert UNIX timestamp to milliseconds
  return date >= startDate && date <= endDate;
};

// Fetch transactions for the address
const getTransactions = async (address) => {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        module: 'account',
        action: 'txlist',
        address: address,
        startblock: 0,
        endblock: 99999999,
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

// API route handler
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method === 'GET') {
    console.log('Fetching transactions...');
    const transactions = await getTransactions(ADDRESS);

    const startDate = new Date('2024-12-21T00:00:00Z');
    const endDate = new Date('2024-12-29T23:59:59Z');

    console.log(`Filtering and decoding transactions from ${startDate} to ${endDate}...`);
    const decodedTransactions = decodeInputData(transactions, startDate, endDate);

    // Filter for transactions that contain the keyword "NAMADA"
    const filteredTransactions = decodedTransactions.filter(tx => 
      tx.decodedRawInput && tx.decodedRawInput.includes("NAMADA")
    );

    // Respond with the filtered transactions
    res.status(200).json(filteredTransactions);
  } else {
    // Respond with a 405 Method Not Allowed error
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
