import fetch from 'node-fetch';

async function main() {
  const res = await fetch('http://localhost:3000/api/mobile/attendance/ble', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test'
    },
    body: JSON.stringify({
      action: 'CHECK_IN',
      eventId: 'manual',
      readerId: '87b99b2c-90fd-11e9-bc42-526af7764f64:1:1'
    })
  });
  const text = await res.text();
  console.log(res.status, text);
}
main();
