import 'dotenv/config';
import { getCashfreeBaseUrl, getCashfreeSignature } from './src/lib/cashfree';

async function main() {
  const clientId = process.env.CASHFREE_VERIFICATION_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_VERIFICATION_CLIENT_SECRET;

  const url = getCashfreeBaseUrl();
  console.log('URL:', url);

  const sig = getCashfreeSignature(clientId!);
  console.log('Signature:', sig ? 'Generated' : 'Failed');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': clientId!,
        'x-client-secret': clientSecret!,
        ...(sig ? { 'x-cf-signature': sig } : {})
      },
      body: JSON.stringify({
        verification_id: `TEST_${Date.now()}`,
        redirect_url: 'https://www.focusx.in/student/profile',
        name: 'Student',
        document_requested: ["AADHAAR"]
      })
    });

    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Data:', JSON.stringify(data, null, 2));
  } catch(e) {
    console.error('Fetch error:', e);
  }
}

main();
