const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_JWT_SECRET;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!secret) { console.error("No secret"); process.exit(1); }

async function testToken() {
  const firebaseUid = '3uN33ZAdSXVOGIQtDz8ENAl82qO2'; // From the test above
  const prismaId = '21c3e41b-69ed-45d4-ae61-ac77b961f4a9'; // From the test above

  const token = jwt.sign({
    aud: 'authenticated',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: 'f1683e1b-9c29-4c12-be87-4c713d2daf52',
    firebase_uid: firebaseUid,
    role: 'authenticated',
    iss: 'supabase'
  }, secret);

  const supabase = createClient(url, anonKey);
  supabase.realtime.setAuth(token);

  return new Promise((resolve) => {
    const channel = supabase.channel('scan:' + prismaId, { config: { private: true } });
    channel.subscribe((status, err) => {
      console.log("status:", status, err || '');
      if (status === 'SUBSCRIBED') {
        setTimeout(() => {
          console.log("survived 2 seconds!");
          supabase.removeChannel(channel).then(resolve);
        }, 2000);
      }
      if (status === 'CLOSED') {
        resolve();
      }
    });
  });
}

testToken().then(() => process.exit(0));
