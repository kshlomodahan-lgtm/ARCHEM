require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { sql, getPool } = require('../db');

async function cols(pool, table) {
  try {
    const r = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${table}' ORDER BY ORDINAL_POSITION
    `);
    return r.recordset;
  } catch(e) { return []; }
}

async function sample(pool, table, n=3) {
  try {
    const r = await pool.request().query(`SELECT TOP ${n} * FROM ${table}`);
    return r.recordset;
  } catch(e) { return []; }
}

async function run() {
  const pool = await getPool();

  for (const t of ['A_SAPAKIM', 'A_SAPAKIM_NEW', 'A_ANSHEY_KESHER_SAPAKIM', 'A_ANSHEY_KESHER_SAPAKIM_NEW']) {
    const c = await cols(pool, t);
    if (!c.length) { console.log(`\n${t}: NOT FOUND`); continue; }
    const cnt = await pool.request().query(`SELECT COUNT(*) AS n FROM ${t}`);
    console.log(`\n=== ${t} (${cnt.recordset[0].n} rows) ===`);
    c.forEach(col => console.log(`  ${col.COLUMN_NAME} (${col.DATA_TYPE}${col.CHARACTER_MAXIMUM_LENGTH ? '('+col.CHARACTER_MAXIMUM_LENGTH+')' : ''})`));
    const rows = await sample(pool, t, 2);
    if (rows.length) { console.log('  Sample:', JSON.stringify(rows[0]).substring(0,300)); }
  }

  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
