import { google } from 'googleapis';
import dotenv from 'dotenv';

// Load environment variables from the .env file
dotenv.config();

// Set the SPREADSHEET_ID from the .env file
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const RANGE = 'Sheet1!A:H'; // Adjust the range as needed

const sheets = google.sheets('v4');

// Configure the Google Sheets API client
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
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'], // Read-only scope
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
      const rows = response.data.values;

      if (rows.length) {
        res.status(200).json({ success: true, data: rows });
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
