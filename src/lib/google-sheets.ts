import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export async function appendToGoogleSheet(sheetId: string, rowData: any[]) {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  // Replace actual literal \n with newline characters for the private key format
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !key) {
    throw new Error('Missing Google Service Account credentials in .env');
  }

  // Initialize auth
  const serviceAccountAuth = new JWT({
    email: email,
    key: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  // Initialize the sheet
  const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);

  try {
    // Load document properties and worksheets
    await doc.loadInfo(); 
    
    // Get the first worksheet (index 0)
    const sheet = doc.sheetsByIndex[0];

    // Append the row
    await sheet.addRow(rowData);
    console.log(`Successfully appended row to Google Sheet: ${doc.title}`);
    return true;

  } catch (error) {
    console.error('Error writing to Google Sheet:', error);
    return false;
  }
}
