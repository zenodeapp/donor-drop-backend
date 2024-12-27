import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { startScheduler } from './lib/scheduler';
import { getTransactions, decodeInputData } from './lib/etherscan';
import { saveTransaction } from './lib/db';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const ADDRESS = process.env.COINCENTER_ADDRESS;

async function initialScrape() {
  console.log('Performing initial blockchain scrape...');
  try {
    const transactions = await getTransactions(ADDRESS, 0, 99999999);
    const decodedTransactions = decodeInputData(transactions, new Date(0), new Date());
    const filteredTransactions = decodedTransactions.filter(tx =>
      tx.decodedRawInput && (tx.decodedRawInput.includes("NAMADA") || 
      tx.decodedRawInput.includes("tpknam") || 
      tx.decodedRawInput.includes("tnam"))
    );

    // Save filtered transactions to database
    const savePromises = filteredTransactions.map(tx => saveTransaction(tx));
    await Promise.all(savePromises);
    console.log(`Initial scrape complete. Found and saved ${filteredTransactions.length} transactions`);
  } catch (error) {
    console.error('Error during initial scrape:', error);
  }
}

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  }).listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
    
    // Perform initial scrape and start scheduler
    initialScrape().then(() => {
      console.log('Starting scheduler...');
      startScheduler();
    });
  });
}); 