/**
 * migrate-suppliers.js
 * מחיקה מלאה + הסבה מחדש של ספקים מהטבלאות הישנות
 *
 * מקורות:
 *   A_SAPAKIM          — 650 ספקים (אנגלית)
 *   A_SAPAKIM_NEW      —   8 ספקים (עברית+אנגלית, מדינה כ-ID)
 *   A_ANSHEY_KESHER_SAPAKIM — אנשי קשר (email)
 *
 * יעדים:
 *   tblSuppliers / tblAddresses / tblEntityAddresses / tblEntityContactMethods
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { sql, getPool } = require('../db');

const ENTITY_TYPE_SUPPLIER = 1;
const ISRAEL_ID = 81;

// מיפוי שמות מדינה → CountryID (טיפול בשגיאות כתיב + שמות חלופיים)
const COUNTRY_ALIASES = {
  'HOLLAND':         'Netherlands',
  'UAE':             'United Arab Emirates',
  'BRASIL':          'Brazil',
  'GERMENY':         'Germany',
  'CZECK REPUBLIC':  'Czech Republic',
  'CZECH REBUBLIC':  'Czech Republic',
  'WEST MALAYSIA':   'Malaysia',
  'IVORY COST':      "Côte d'Ivoire",
  'KOREA':           'Korea, Republic of',
  'UNITED KINGDOM':  'United Kingdom',
  'USA':             'United States',
  'RUSSIA':          'Russian Federation',
};

function cleanStr(s) {
  return s ? s.trim().replace(/\s+/g, ' ') || null : null;
}

async function run() {
  const pool = await getPool();

  // ── 1. בנה מפת מדינות ─────────────────────────────────────────────
  const cRows = await pool.request().query(`SELECT CountryID, NameEN FROM tblCountries WHERE IsActive=1`);
  const countryMap = new Map(); // NameEN.toUpperCase() → CountryID
  for (const c of cRows.recordset) {
    if (c.NameEN) countryMap.set(c.NameEN.toUpperCase(), c.CountryID);
  }
  // הוסף aliases
  for (const [alias, canonical] of Object.entries(COUNTRY_ALIASES)) {
    const id = countryMap.get(canonical.toUpperCase());
    if (id) countryMap.set(alias.toUpperCase(), id);
  }

  function resolveCountry(eretz) {
    if (!eretz || !eretz.trim()) return null;
    return countryMap.get(eretz.trim().toUpperCase()) || null;
  }

  // ── 2. שלוף נתונים מישנים ─────────────────────────────────────────
  const [sapakim, sapakimNew, ansheyKesher] = await Promise.all([
    pool.request().query(`SELECT * FROM A_SAPAKIM`),
    pool.request().query(`SELECT * FROM A_SAPAKIM_NEW`),
    pool.request().query(`
      SELECT MISPAR_SAPAK, MIN(RTRIM(EMAIL)) AS EMAIL
      FROM A_ANSHEY_KESHER_SAPAKIM
      WHERE RTRIM(EMAIL) <> ''
      GROUP BY MISPAR_SAPAK
    `),
  ]);

  // אינדקסים מהירים
  const newMap  = new Map(sapakimNew.recordset.map(r => [r.KOD_SAPAK, r]));
  const emailMap = new Map(ansheyKesher.recordset.map(r => [r.MISPAR_SAPAK, r.EMAIL.trim()]));

  console.log(`📦 A_SAPAKIM: ${sapakim.recordset.length} rows`);
  console.log(`📦 A_SAPAKIM_NEW: ${sapakimNew.recordset.length} rows (overrides)`);
  console.log(`📦 Emails from ANSHEY_KESHER: ${emailMap.size}`);

  // ── 3. מחיקה בתוך transaction ─────────────────────────────────────
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    console.log('\n🗑  Deleting existing supplier data...');

    // שמור AddressIDs לפני מחיקת EntityAddresses
    const addrIDs = await new sql.Request(transaction)
      .input('et', sql.SmallInt, ENTITY_TYPE_SUPPLIER)
      .query(`SELECT AddressID FROM tblEntityAddresses WHERE EntityTypeID=@et`);
    const addrIDList = addrIDs.recordset.map(r => r.AddressID);

    await new sql.Request(transaction)
      .input('et', sql.SmallInt, ENTITY_TYPE_SUPPLIER)
      .query(`DELETE FROM tblEntityContactMethods WHERE EntityTypeID=@et`);

    await new sql.Request(transaction)
      .input('et', sql.SmallInt, ENTITY_TYPE_SUPPLIER)
      .query(`DELETE FROM tblEntityAddresses WHERE EntityTypeID=@et`);

    if (addrIDList.length) {
      const ids = addrIDList.join(',');
      await new sql.Request(transaction)
        .query(`DELETE FROM tblAddresses WHERE AddressID IN (${ids})`);
    }

    await new sql.Request(transaction)
      .query(`DELETE FROM tblSuppliers`);

    console.log('✅ Deleted');

    // ── 4. הכנס ספקים ────────────────────────────────────────────────
    console.log('\n➕ Inserting suppliers...');
    let suppCount = 0, addrCount = 0, contactCount = 0;

    for (const row of sapakim.recordset) {
      const n = newMap.get(row.KOD_SAPAK); // override מ-NEW אם קיים

      const shortNameEN = cleanStr(n ? n.SHEM_SAPAK_ENG : row.SHEM_SAPAK_MEKUTZAR);
      const fullNameEN  = cleanStr(n ? n.SHEM_SAPAK_ENG : row.SHEM_SAPAK_MALE);
      const shortNameHE = cleanStr(n?.SHEM_SAPAK_HEB) || null;
      const fullNameHE  = cleanStr(n?.SHEM_SAPAK_HEB) || null;
      const vatNumber   = cleanStr(row.VAT_NO);
      const psnPrefix   = cleanStr(row.SUP_PSN_Prefix);
      const psnNum      = row.SUP_PSN_Auto_Numerator || null;
      const payBankID   = row.KOD_BANK_LETASHLUM_ARACHIM || null;
      const suppTypeID  = n?.Sug_Sapak || null;
      const notes       = cleanStr(n?.Remarks);

      await new sql.Request(transaction)
        .input('id',       sql.Int,           row.KOD_SAPAK)
        .input('snEN',     sql.NVarChar(30),  shortNameEN)
        .input('snHE',     sql.NVarChar(30),  shortNameHE)
        .input('fnEN',     sql.NVarChar(80),  fullNameEN)
        .input('fnHE',     sql.NVarChar(80),  fullNameHE)
        .input('vat',      sql.NVarChar(20),  vatNumber)
        .input('sType',    sql.SmallInt,       suppTypeID)
        .input('bank',     sql.SmallInt,       payBankID)
        .input('psnP',     sql.NVarChar(10),  psnPrefix)
        .input('psnN',     sql.Int,            psnNum)
        .input('notes',    sql.NVarChar(500), notes)
        .query(`
          INSERT INTO tblSuppliers
            (SupplierID, ShortNameEN, ShortNameHE, FullNameEN, FullNameHE,
             VATNumber, SupplierTypeID, PaymentBankID, PSNPrefix, PSNNumerator, Notes, IsActive)
          VALUES
            (@id, @snEN, @snHE, @fnEN, @fnHE,
             @vat, @sType, @bank, @psnP, @psnN, @notes, 1)
        `);
      suppCount++;

      // ── כתובת ─────────────────────────────────────────────────────
      const line1    = cleanStr(n ? n.KTOVET1 : row.KTOVET1);
      const line2    = cleanStr(n ? n.KTOVET2 : row.KTOVET2);
      const cityFree = cleanStr(n ? n.IR      : row.IR);
      const zipCode  = cleanStr(n ? n.MIKUD   : row.MIKUD);
      const eretz    = n ? null : cleanStr(row.ERETZ);   // NEW has Country as int
      const countryID = n ? (n.Country || ISRAEL_ID) : (resolveCountry(eretz) || ISRAEL_ID);

      if (line1 || cityFree || zipCode) {
        const ar = await new sql.Request(transaction)
          .input('l1',  sql.NVarChar(100), line1)
          .input('l2',  sql.NVarChar(100), line2)
          .input('cf',  sql.NVarChar(80),  cityFree)
          .input('zip', sql.NVarChar(20),  zipCode)
          .input('cid', sql.Int,           countryID)
          .query(`
            INSERT INTO tblAddresses (Line1, Line2, CityFree, ZipCode, CountryID)
            VALUES (@l1, @l2, @cf, @zip, @cid);
            SELECT SCOPE_IDENTITY() AS AddressID;
          `);
        const newAddrID = ar.recordset[0].AddressID;

        await new sql.Request(transaction)
          .input('et',  sql.SmallInt, ENTITY_TYPE_SUPPLIER)
          .input('eid', sql.Int,      row.KOD_SAPAK)
          .input('aid', sql.BigInt,   newAddrID)
          .query(`
            INSERT INTO tblEntityAddresses (EntityTypeID, EntityID, AddressID, AddressTypeID, IsPrimary)
            VALUES (@et, @eid, @aid, 1, 1)
          `);
        addrCount++;
      }

      // ── פרטי התקשרות ──────────────────────────────────────────────
      const srcRow = n || row;
      const tel1  = cleanStr(srcRow.TEL1);
      const tel2  = cleanStr(srcRow.TEL2);
      const fax   = cleanStr(srcRow.FAX);
      const email = emailMap.get(row.KOD_SAPAK) || null;

      const contacts = [
        tel1  && { methodTypeID: 1,  value: tel1,  dialID: ISRAEL_ID, isPrimary: true  },
        tel2  && { methodTypeID: 3,  value: tel2,  dialID: ISRAEL_ID, isPrimary: false },
        fax   && { methodTypeID: 4,  value: fax,   dialID: ISRAEL_ID, isPrimary: false },
        email && { methodTypeID: 10, value: email, dialID: null,      isPrimary: true  },
      ].filter(Boolean);

      for (const c of contacts) {
        await new sql.Request(transaction)
          .input('et',   sql.SmallInt,     ENTITY_TYPE_SUPPLIER)
          .input('eid',  sql.Int,          row.KOD_SAPAK)
          .input('mt',   sql.SmallInt,     c.methodTypeID)
          .input('dial', sql.Int,          c.dialID)
          .input('val',  sql.NVarChar(200), c.value)
          .input('pri',  sql.Bit,          c.isPrimary ? 1 : 0)
          .query(`
            INSERT INTO tblEntityContactMethods
              (EntityTypeID, EntityID, MethodTypeID, DialCountryID, Value, IsPrimary)
            VALUES (@et, @eid, @mt, @dial, @val, @pri)
          `);
        contactCount++;
      }
    }

    await transaction.commit();
    console.log(`\n✅ Migration complete:`);
    console.log(`   Suppliers : ${suppCount}`);
    console.log(`   Addresses : ${addrCount}`);
    console.log(`   Contacts  : ${contactCount}`);

  } catch (e) {
    await transaction.rollback();
    console.error('❌ Migration failed, rolled back:', e.message);
    process.exit(1);
  }

  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
