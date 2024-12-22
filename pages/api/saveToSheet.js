import { google } from 'googleapis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Set your Google Sheets ID and range from environment variables
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const RANGE = process.env.SHEET_RANGE || 'Sheet1!A:E'; // Default range if not specified

const sheets = google.sheets('v4');

async function authenticate() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY, // Path to your service account key from .env
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return await auth.getClient();
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { message, recognizedAmount, namadaAddress, ethAddress } = req.body;

    try {
      const authClient = await authenticate();

      // Check if the ETH address already exists
      const existingValuesResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: RANGE,
        auth: authClient,
      });

      const existingValues = existingValuesResponse.data.values || [];

      // Check if the ETH address already exists in column E (index 4)
      const addressExists = existingValues.some(row => row[4] === ethAddress); // Adjust index based on your range

      if (addressExists) {
        return res.status(400).json({ success: false, message: 'ETH address already exists' });
      }

      // Append the new row since the address does not exist
      const request = {
        spreadsheetId: SPREADSHEET_ID,
        range: RANGE,
        valueInputOption: 'RAW',
        resource: {
          values: [[new Date().toISOString(), message, recognizedAmount, namadaAddress, ethAddress]],
        },
        auth: authClient,
      };

      const response = await sheets.spreadsheets.values.append(request);
      res.status(200).json({ success: true, response });
    } catch (error) {
      console.error('Error saving data to Google Sheets:', error);
      res.status(500).json({ success: false, message: 'Failed to save data' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
