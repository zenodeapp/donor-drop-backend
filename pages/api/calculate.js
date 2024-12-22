import { google } from 'googleapis';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const RANGE = 'Sheet1!A:H'; // Adjust the range as needed

const sheets = google.sheets('v4');

async function authenticate() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: 'service_account',
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Handle newline characters
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
      auth_uri: process.env.GOOGLE_AUTH_URI,
      token_uri: process.env.GOOGLE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_CERT_URL,
      client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return await auth.getClient();
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const authClient = await authenticate();
      const request = {
        spreadsheetId: SPREADSHEET_ID,
        range: RANGE,
        auth: authClient,
      };

      const response = await sheets.spreadsheets.values.get(request);
      console.log(response); // Log the full response to inspect its structure
      const rows = response.data.values || []; // Fallback to an empty array if undefined

      if (rows && rows.length > 0) {
        const columnCValues = rows.map(row => parseFloat(row[2])).filter(value => !isNaN(value));

        // Sum all values in column C
        const totalSum = columnCValues.reduce((acc, value) => acc + value, 0);

        res.status(200).json({ success: true, totalSum });
      } else {
        res.status(404).json({ success: false, message: 'No data found.' });
      }
    } catch (error) {
      console.error('Error fetching data from Google Sheets:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch data' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
