const { Client } = require('pg'); 
require('dotenv').config(); 
const client = new Client({ connectionString: process.env.DATABASE_URL }); 
client.connect()
  .then(() => client.query('SELECT id, name FROM "Library"'))
  .then(res => { console.log(res.rows); client.end(); })
  .catch(console.error);
