const { Client } = require('pg'); 
require('dotenv').config(); 
const client = new Client({ connectionString: process.env.DATABASE_URL }); 
client.connect()
  .then(() => client.query('SELECT "libraryId", COUNT(*) FROM "StandaloneLocker" GROUP BY "libraryId"'))
  .then(res => { console.log(res.rows); client.end(); })
  .catch(console.error);
