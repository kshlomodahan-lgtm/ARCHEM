require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { sql, getPool } = require('../db');
async function run() {
  const pool = await getPool();
  const r = await pool.request().query('SELECT TOP 1 * FROM tblSuppliers');
  const keys = Object.keys(r.recordset[0]);
  console.log('Keys from mssql:', keys.join(', '));
  console.log('IsActive:', r.recordset[0].IsActive, '| isActive:', r.recordset[0].isActive);
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
