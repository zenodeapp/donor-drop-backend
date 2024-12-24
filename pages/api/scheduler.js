import cron from 'node-cron';
import axios from 'axios';

// Run every 13 seconds
cron.schedule('*/13 * * * * *', async () => {
  try {
    const response = await axios.get('/api/scrapetxn?mode=recent');
    if (response.data.length > 0) {
      console.log('New transactions found:', response.data);
      // Handle new transactions (e.g., store in database)
    }
  } catch (error) {
    console.error('Error in cron job:', error);
  }
});