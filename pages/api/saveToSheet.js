import { google } from 'googleapis';

// Set your Google Sheets ID and range
const SPREADSHEET_ID = '1W1uP-hqV4--JGXChFSyhF0TUF5OwK1zIyiXjd_ESEH4';
const RANGE = 'Sheet1!A:E'; // Adjust the range to include column E

const sheets = google.sheets('v4');

async function authenticate() {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'collegeproject-c9550-c919afa91c6b.json', // Path to your service account key file
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