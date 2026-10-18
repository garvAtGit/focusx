import * as dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local" });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`
    SELECT "libraryId", "name", count(*) 
    FROM "Seat" 
    GROUP BY "libraryId", "name" 
    HAVING count(*) > 1
  `);
  
  console.log('Duplicate seat names in DB:', res.rows);

  const res2 = await client.query(`
    SELECT "name", "gridX", "gridY", "type", "hasLocker" 
    FROM "Seat" 
    WHERE "name" = '6'
  `);
  console.log('Details of seats named 6:', res2.rows);

  await client.end();
}

main().catch(console.error);
