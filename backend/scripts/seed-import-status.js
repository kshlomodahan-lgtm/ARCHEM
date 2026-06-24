const sql = require('mssql');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: { encrypt: false, trustServerCertificate: true },
};

const statuses = [
  { id: 1,  status: 'הגשת הזמנה',   total: 5  },
  { id: 2,  status: 'אישור ספק',     total: 3  },
  { id: 3,  status: 'ייצור / הכנה', total: 2  },
  { id: 4,  status: 'משלוח מהספק',  total: 8  },
  { id: 5,  status: 'עמילות מכס',   total: 12 },
  { id: 6,  status: 'שחרור ממכס',   total: 6  },
  { id: 7,  status: 'הגעה למחסן',   total: 4  },
  { id: 8,  status: 'פריקה ובדיקה', total: 5  },
  { id: 9,  status: 'אחסון',         total: 2  },
  { id: 10, status: 'הזמנה סגורה',  total: 1  },
];

async function run() {
  const pool = await sql.connect(config);

  // Alter column to NVARCHAR if needed
  await pool.request().query(`
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_NAME='tblImportProcessStatus' AND COLUMN_NAME='IPS_Status' AND DATA_TYPE='varchar')
    BEGIN
      ALTER TABLE tblImportProcessStatus ALTER COLUMN IPS_Status NVARCHAR(100)
    END
  `);
  console.log('Column type verified/fixed');

  // Clear existing
  await pool.request().query(`TRUNCATE TABLE tblImportProcessStatus`);
  console.log('Table cleared');

  // Insert all statuses
  for (const s of statuses) {
    await pool.request()
      .input('ID', sql.Int, s.id)
      .input('S', sql.NVarChar(100), s.status)
      .input('T', sql.Float, s.total)
      .query(`INSERT INTO tblImportProcessStatus(IPS_ID,IPS_Status,IPS_TotalDataToFillIn,IPS_isActive) VALUES(@ID,@S,@T,1)`);
    console.log(`  Added: ${s.id} — ${s.status}`);
  }

  const r = await pool.request().query(`SELECT COUNT(*) AS cnt FROM tblImportProcessStatus`);
  console.log(`Done. Total: ${r.recordset[0].cnt} records`);
  await pool.close();
}

run().catch(e => { console.error(e.message); process.exit(1); });
