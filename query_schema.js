const { Pool } = require('pg'); 
require('dotenv').config({ path: '.env.local' }); 
const pool = new Pool({ connectionString: process.env.DIRECT_URL }); 
async function main() { 
  const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'Relay'"); 
  console.log(res.rows); 
} 
main();
