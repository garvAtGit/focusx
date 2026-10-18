
const { Client } = require("pg");
const client = new Client({ connectionString: "postgresql://postgres:password@localhost:5432/localdb" });
async function main() {
    await client.connect();
    const res = await client.query("SELECT id, \"bleReaderId\", \"lastSync\" FROM \"Relay\"");
    console.log(res.rows);
    await client.end();
}
main().catch(console.error);

