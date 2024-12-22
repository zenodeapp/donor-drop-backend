import { google } from 'googleapis';

// Set your Google Sheets ID and range
const SPREADSHEET_ID = '1W1uP-hqV4--JGXChFSyhF0TUF5OwK1zIyiXjd_ESEH4';
const RANGE = 'Sheet1!A:H'; // Adjust the range as needed

const sheets = google.sheets('v4');

// Configure the Google Sheets API client
async function authenticate() {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'collegeproject-c9550-c919afa91c6b.json', // Path to your service account key file
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