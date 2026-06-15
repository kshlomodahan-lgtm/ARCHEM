require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { sql, getPool } = require('../db');

async function run() {
  const pool = await getPool();

  // 1. Rename טלפון ישיר → טלפון נוסף
  await pool.request().query(`
    UPDATE tblContactMethodTypes SET NameHE = N'טלפון נוסף', NameEN = 'Additional Phone'
    WHERE MethodTypeID = 3
  `);
  console.log('✅ Updated MethodTypeID=3 to טלפון נוסף');

  // 2. Add נייד נוסף if not exists (check by NameHE)
  const existing = await pool.request().query(`
    SELECT MethodTypeID FROM tblContactMethodTypes WHERE NameHE = N'נייד נוסף'
  `);
  if (!existing.recordset.length) {
    const maxRes = await pool.request().query(`SELECT MAX(MethodTypeID)+1 AS NextID FROM tblContactMethodTypes`);
    const nextID = maxRes.recordset[0].NextID;
    await pool.request()
      .input('id', sql.SmallInt, nextID)
      .query(`
        INSERT INTO tblContactMethodTypes (MethodTypeID, NameHE, NameEN, Category, ValueFormat, Icon, DefaultOrder, IsActive)
        VALUES (@id, N'נייד נוסף', 'Additional Mobile', 'MOBILE', 'PHONE', 'phone_android', 3, 1)
      `);
    console.log(`✅ Added נייד נוסף (MethodTypeID=${nextID})`);
  } else {
    console.log('ℹ️  נייד נוסף already exists');
  }

  // Show current list
  const all = await pool.request().query(`
    SELECT MethodTypeID, NameHE, Category, ValueFormat, DefaultOrder
    FROM tblContactMethodTypes WHERE IsActive=1 ORDER BY DefaultOrder
  `);
  console.log('\nCurrent types:');
  all.recordset.forEach(r => console.log(`  [${r.MethodTypeID}] ${r.NameHE} (${r.Category}/${r.ValueFormat}) order=${r.DefaultOrder}`));

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
