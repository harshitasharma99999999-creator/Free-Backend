const pg = require('pg');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, 'init-db.sql'), 'utf8');
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    await client.connect();
    console.log('Connected');
    await client.query(sql);
    console.log('Migration complete');
    const res = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
    );
    console.log('Tables:', res.rows.map(r => r.table_name).join(', '));
  } catch (err) {
    console.error('Error:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
