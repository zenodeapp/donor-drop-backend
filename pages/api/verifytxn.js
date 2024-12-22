import axios from 'axios';

const ETHERSCAN_API_KEY = 'U42S46F9HAIY1NV5U2P186USKB6N89KEQP';


const toAddress = '0x15322B546e31F5Bfe144C4ae133A9Db6F0059fe3';
const startDate = new Date('2024-12-22');
const endDate = new Date('2024-12-29');
endDate.setHours(23, 59, 59, 999); // Set end date to the end of the day

async function getTransactions(address) {
    const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
    
    try {
        const response = await axios.get(url);
        
        // Check if the response is successful
        if (response.data.status === '1') {
            return response.data.result; // Return the list of transactions
        } else {
            console.error("Error fetching transactions:", response.data.message);
            return [];
        }
    } catch (error) {
        console.error("Error:", error);
        return [];
    }
}

// Function to filter transactions that match the from and to addresses within the date range
function filterTransactions(transactions, fromAddress) {
    return transactions.filter(tx => 
        tx.from.toLowerCase() === fromAddress.toLowerCase() &&
        tx.to.toLowerCase() === toAddress.toLowerCase() &&
        // Check if the transaction timestamp is within the start and end dates
        new Date(tx.timeStamp * 1000) >= startDate && new Date(tx.timeStamp * 1000) <= endDate
    );
}

// Function to convert Wei to Ether
function weiToEth(wei) {
    return wei / 1e18; // 1 Ether = 10^18 Wei
}

// Next.js API route handler
export default async function handler(req, res) {
    const { fromAddress } = req.query;

    // Validate input
    if (!fromAddress) {
        return res.status(400).json({ error: 'Missing required query parameter: fromAddress.' });
    }

    const transactions = await getTransactions(fromAddress);
    
    // Filter transactions from the specified from address to the hardcoded to address within the date range
    const filteredTransactions = filterTransactions(transactions, fromAddress);
    
    // Initialize total donation, last timestamp, and an array to hold transaction hashes
    let totalDonation = 0;
    let lastTimestamp = 0; // Initialize lastTimestamp
    const transactionHashes = [];

    // Process filtered transactions
    if (filteredTransactions.length > 0) {
        filteredTransactions.forEach(tx => {
            const valueInEth = weiToEth(tx.value); // Convert Wei to Ether
            totalDonation += valueInEth; // Sum up the donations
            lastTimestamp = Math.max(lastTimestamp, tx.timeStamp); // Update lastTimestamp
            transactionHashes.push(tx.hash); // Store the transaction hash
        });

        // Send response with last donation timestamp
        res.status(200).json({
            transactionHashes,
            totalDonation,
            lastDonationTimestamp: new Date(lastTimestamp * 1000).toISOString(), // Format the last timestamp
            fromAddress,
            toAddress
        });
    } else {
        res.status(404).json({ message: 'No transactions found from the specified address to the hardcoded address within the date range.' });
    }
}