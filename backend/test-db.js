const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const res = await pool.query('SELECT id, url_path FROM bitacora_fotos ORDER BY id DESC LIMIT 5');
  console.log(res.rows);
  process.exit(0);
}
run();
