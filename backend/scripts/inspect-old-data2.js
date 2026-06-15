require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { sql, getPool } = require('../db');

async function run() {
  const pool = await getPool();

  // Is SupplierID an IDENTITY column?
  const idInfo = await pool.request().query(`
    SELECT COLUMNPROPERTY(OBJECT_ID('tblSuppliers'), 'SupplierID', 'IsIdentity') AS IsIdentity
  `);
  console.log('tblSuppliers.SupplierID IsIdentity:', idInfo.recordset[0].IsIdentity);

  // Check ERETZ (country) values in old table
  const eretz = await pool.request().query(`
    SELECT RTRIM(ERETZ) AS ERETZ, COUNT(*) AS cnt FROM A_SAPAKIM
    GROUP BY RTRIM(ERETZ) ORDER BY cnt DESC
  `);
  console.log('\nERETZ values in A_SAPAKIM:');
  eretz.recordset.forEach(r => console.log(`  "${r.ERETZ}" x${r.cnt}`));

  // Does tblCountries have DialCode data? spot check
  const countries = await pool.request().query(`
    SELECT TOP 5 CountryID, NameHE, NameEN FROM tblCountries WHERE IsActive=1
  `);
  console.log('\nSample countries:');
  countries.recordset.forEach(r => console.log(`  [${r.CountryID}] ${r.NameHE} / ${r.NameEN}`));

  // Israel CountryID?
  const il = await pool.request().query(`SELECT CountryID FROM tblCountries WHERE NameEN LIKE '%Israel%' OR NameHE LIKE '%ישראל%'`);
  console.log('\nIsrael CountryID:', il.recordset[0]?.CountryID);

  // A_ANSHEY_KESHER_SAPAKIM — how many suppliers have email?
  const emailCnt = await pool.request().query(`
    SELECT COUNT(DISTINCT MISPAR_SAPAK) AS suppliersWithEmail
    FROM A_ANSHEY_KESHER_SAPAKIM WHERE RTRIM(EMAIL) <> ''
  `);
  console.log('\nSuppliers with email in A_ANSHEY_KESHER_SAPAKIM:', emailCnt.recordset[0].suppliersWithEmail);

  // Check if tblOrders/other tables reference SupplierID
  const fkCheck = await pool.request().query(`
    SELECT fk.name AS FK_Name, tp.name AS Parent_Table, cp.name AS Parent_Col
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
    JOIN sys.tables tp ON fk.parent_object_id = tp.object_id
    JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
    JOIN sys.tables tr ON fk.referenced_object_id = tr.object_id
    WHERE tr.name = 'tblSuppliers'
  `);
  console.log('\nFK references to tblSuppliers:');
  if (fkCheck.recordset.length) fkCheck.recordset.forEach(r => console.log(`  ${r.Parent_Table}.${r.Parent_Col} (${r.FK_Name})`));
  else console.log('  None found (no FK constraints)');

  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
