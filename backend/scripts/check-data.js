require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { sql, getPool } = require('../db');

async function run() {
  const pool = await getPool();

  const tables = [
    'tblSuppliers',
    'tblEntityAddresses',
    'tblAddresses',
    'tblEntityContactMethods',
  ];

  for (const t of tables) {
    try {
      const r = await pool.request().query(`SELECT COUNT(*) AS cnt FROM ${t}`);
      console.log(`${t}: ${r.recordset[0].cnt} rows`);
    } catch(e) { console.log(`${t}: ERROR - ${e.message}`); }
  }

  // Check for old/source tables
  const oldTables = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE='BASE TABLE'
    ORDER BY TABLE_NAME
  `);
  console.log('\nAll tables in DB:');
  oldTables.recordset.forEach(r => console.log(' ', r.TABLE_NAME));

  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
