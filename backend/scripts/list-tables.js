const { getPool } = require('../db');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function run() {
  const pool = await getPool();

  // All tables
  const allTables = await pool.request().query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME`
  );
  console.log('\n=== ALL TABLES ===');
  allTables.recordset.forEach(t => console.log(t.TABLE_NAME));

  // Look for Item/SKU/Order/Catalog related
  const relevant = allTables.recordset.filter(t =>
    /item|sku|product|catalog|link|orderline|order_line/i.test(t.TABLE_NAME)
  );
  if (relevant.length) {
    console.log('\n=== RELEVANT TABLES ===');
    relevant.forEach(t => console.log(t.TABLE_NAME));

    // Get columns for each relevant table
    for (const t of relevant) {
      const cols = await pool.request()
        .input('TBL', require('mssql').NVarChar(200), t.TABLE_NAME)
        .query(`SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
                FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=@TBL ORDER BY ORDINAL_POSITION`);
      console.log(`\n-- ${t.TABLE_NAME} --`);
      cols.recordset.forEach(c => console.log(`  ${c.COLUMN_NAME}  ${c.DATA_TYPE}${c.CHARACTER_MAXIMUM_LENGTH ? '('+c.CHARACTER_MAXIMUM_LENGTH+')' : ''}  ${c.IS_NULLABLE==='NO'?'NOT NULL':''}`));
    }
  }

  // Also check tblOrders and OrderLines specifically
  const orderLines = await pool.request().query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%Order%'`
  );
  console.log('\n=== ORDER TABLES ===');
  orderLines.recordset.forEach(t => console.log(t.TABLE_NAME));

  for (const t of orderLines.recordset) {
    const cols = await pool.request()
      .input('TBL', require('mssql').NVarChar(200), t.TABLE_NAME)
      .query(`SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
              FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=@TBL ORDER BY ORDINAL_POSITION`);
    console.log(`\n-- ${t.TABLE_NAME} --`);
    cols.recordset.forEach(c => console.log(`  ${c.COLUMN_NAME}  ${c.DATA_TYPE}${c.CHARACTER_MAXIMUM_LENGTH ? '('+c.CHARACTER_MAXIMUM_LENGTH+')' : ''}`));
  }

  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
