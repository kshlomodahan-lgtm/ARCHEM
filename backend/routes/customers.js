const express     = require('express');
const router      = express.Router();
const { sql, getPool } = require('../db');
const requireAuth = require('../middleware/auth');

const CUSTOMER_ENTITY_TYPE = 2;

const toCamel    = obj => { if (!obj || typeof obj !== 'object') return obj; const r = {}; for (const k of Object.keys(obj)) r[k.charAt(0).toLowerCase() + k.slice(1)] = obj[k]; return r; };
const rowsToCamel = arr => arr.map(toCamel);

// ── GET /api/customers  (list) ─────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const pool  = await getPool();
    const { search = '' } = req.query;

    const r = await pool.request()
      .input('search', sql.NVarChar, `%${search}%`)
      .query(`
        SELECT
          c.CustomerID,
          ISNULL(NULLIF(RTRIM(c.ShortNameEN),''), RTRIM(c.FullNameEN)) AS ShortNameEN,
          c.ShortNameHE,
          c.FullNameEN,
          c.FullNameHE,
          c.VATRate,
          c.CompanyRegNo,
          c.StatusID,
          c.DefaultCurrencyID,
          c.IsActive,
          c.CreatedAt,
          -- Primary phone
          (SELECT TOP 1 ecm.Value
           FROM tblEntityContactMethods ecm
           JOIN tblContactMethodTypes mt ON mt.MethodTypeID = ecm.MethodTypeID
           WHERE ecm.EntityTypeID = ${CUSTOMER_ENTITY_TYPE}
             AND ecm.EntityID = c.CustomerID
             AND mt.Category IN ('PHONE','MOBILE')
             AND ecm.IsActive = 1
           ORDER BY ecm.IsPrimary DESC, mt.DefaultOrder) AS PrimaryPhone,
          -- Primary email
          (SELECT TOP 1 ecm.Value
           FROM tblEntityContactMethods ecm
           JOIN tblContactMethodTypes mt ON mt.MethodTypeID = ecm.MethodTypeID
           WHERE ecm.EntityTypeID = ${CUSTOMER_ENTITY_TYPE}
             AND ecm.EntityID = c.CustomerID
             AND mt.Category = 'EMAIL'
             AND ecm.IsActive = 1
           ORDER BY ecm.IsPrimary DESC) AS PrimaryEmail,
          -- Primary city
          (SELECT TOP 1 COALESCE(a.CityFree, '')
           FROM tblEntityAddresses ea
           JOIN tblAddresses a ON a.AddressID = ea.AddressID
           WHERE ea.EntityTypeID = ${CUSTOMER_ENTITY_TYPE}
             AND ea.EntityID = c.CustomerID
             AND ea.IsPrimary = 1
             AND a.IsActive = 1) AS PrimaryCity,
          -- Primary country
          (SELECT TOP 1 co.NameEN
           FROM tblEntityAddresses ea
           JOIN tblAddresses a ON a.AddressID = ea.AddressID
           JOIN tblCountries co ON co.CountryID = a.CountryID
           WHERE ea.EntityTypeID = ${CUSTOMER_ENTITY_TYPE}
             AND ea.EntityID = c.CustomerID
             AND ea.IsPrimary = 1
             AND a.IsActive = 1) AS PrimaryCountry
        FROM tblCustomers c
        WHERE (
          c.ShortNameEN LIKE @search OR c.ShortNameHE LIKE @search
          OR c.FullNameEN LIKE @search OR c.FullNameHE LIKE @search
          OR c.CompanyRegNo LIKE @search
          OR CAST(c.CustomerID AS NVARCHAR) LIKE @search
        )
        ORDER BY
          CASE WHEN COALESCE(NULLIF(RTRIM(c.ShortNameEN),''), NULLIF(RTRIM(c.FullNameEN),''), NULLIF(RTRIM(c.ShortNameHE),''), NULLIF(RTRIM(c.FullNameHE),'')) IS NULL THEN 1 ELSE 0 END,
          COALESCE(NULLIF(RTRIM(c.ShortNameEN),''), NULLIF(RTRIM(c.FullNameEN),''), NULLIF(RTRIM(c.ShortNameHE),''), NULLIF(RTRIM(c.FullNameHE),''))
      `);

    res.json({ success: true, data: rowsToCamel(r.recordset), total: r.recordset.length, message: '' });
  } catch (e) {
    res.status(500).json({ success: false, data: null, message: e.message });
  }
});

// ── GET /api/customers/:id  (detail) ───────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const id   = +req.params.id;

    const cust = await pool.request()
      .input('id', sql.Int, id)
      .query(`SELECT * FROM tblCustomers WHERE CustomerID = @id`);

    if (!cust.recordset.length)
      return res.status(404).json({ success: false, message: 'לקוח לא נמצא' });

    const addrs = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT
          ea.EntityAddressID, ea.AddressTypeID, ea.IsPrimary,
          a.AddressID, a.Line1, a.Line2,
          a.CityFree, a.CityID, a.StateFree, a.StateID,
          a.ZipCode, a.CountryID,
          co.NameHE AS CountryNameHE, co.NameEN AS CountryNameEN, co.CountryCode
        FROM tblEntityAddresses ea
        JOIN tblAddresses a ON a.AddressID = ea.AddressID
        JOIN tblCountries co ON co.CountryID = a.CountryID
        WHERE ea.EntityTypeID = ${CUSTOMER_ENTITY_TYPE}
          AND ea.EntityID = @id
          AND a.IsActive = 1
        ORDER BY ea.IsPrimary DESC, ea.AddressTypeID
      `);

    const contacts = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT
          ecm.EntityContactID, ecm.MethodTypeID,
          mt.NameHE AS MethodTypeName, mt.Category, mt.ValueFormat, mt.Icon,
          ecm.DialCountryID,
          dc.NameHE AS DialCountryName, dc.DialCode,
          ecm.Value, ecm.Label, ecm.IsPrimary
        FROM tblEntityContactMethods ecm
        JOIN tblContactMethodTypes mt ON mt.MethodTypeID = ecm.MethodTypeID
        LEFT JOIN tblCountries dc ON dc.CountryID = ecm.DialCountryID
        WHERE ecm.EntityTypeID = ${CUSTOMER_ENTITY_TYPE}
          AND ecm.EntityID = @id
          AND ecm.IsActive = 1
        ORDER BY ecm.IsPrimary DESC, mt.DefaultOrder
      `);

    res.json({
      success: true,
      data: {
        ...toCamel(cust.recordset[0]),
        addresses:      rowsToCamel(addrs.recordset),
        contactMethods: rowsToCamel(contacts.recordset),
      },
      message: '',
    });
  } catch (e) {
    res.status(500).json({ success: false, data: null, message: e.message });
  }
});

// ── POST /api/customers  (create) ──────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const pool = await getPool();
  const { customer, address, contacts } = req.body;
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const r = await new sql.Request(transaction)
      .input('ShortNameEN',          sql.NVarChar(30),  customer.shortNameEN          || null)
      .input('ShortNameHE',          sql.NVarChar(30),  customer.shortNameHE          || null)
      .input('FullNameEN',           sql.NVarChar(80),  customer.fullNameEN           || null)
      .input('FullNameHE',           sql.NVarChar(80),  customer.fullNameHE           || null)
      .input('VATRate',              sql.Decimal(5,2),  customer.vatRate              ?? null)
      .input('CompanyRegNo',         sql.NVarChar(30),  customer.companyRegNo         || null)
      .input('DefaultCurrencyID',    sql.SmallInt,       customer.defaultCurrencyID    || null)
      .input('DefaultPaymentTermID', sql.SmallInt,       customer.defaultPaymentTermID || null)
      .input('DefaultSalesDomainID', sql.SmallInt,       customer.defaultSalesDomainID || null)
      .input('PSNPrefix',            sql.NVarChar(10),  customer.psnPrefix            || null)
      .input('PSNNumerator',         sql.Int,            customer.psnNumerator         || null)
      .input('Notes',                sql.NVarChar(500), customer.notes                || null)
      .input('IsActive',             sql.Bit,            customer.isActive !== false ? 1 : 0)
      .input('CreatedByUser',        sql.Int,            req.user?.userId              || null)
      .query(`
        INSERT INTO tblCustomers
          (ShortNameEN, ShortNameHE, FullNameEN, FullNameHE, VATRate, CompanyRegNo,
           DefaultCurrencyID, DefaultPaymentTermID, DefaultSalesDomainID,
           PSNPrefix, PSNNumerator, Notes, IsActive, CreatedByUserID)
        VALUES
          (@ShortNameEN, @ShortNameHE, @FullNameEN, @FullNameHE, @VATRate, @CompanyRegNo,
           @DefaultCurrencyID, @DefaultPaymentTermID, @DefaultSalesDomainID,
           @PSNPrefix, @PSNNumerator, @Notes, @IsActive, @CreatedByUser);
        SELECT SCOPE_IDENTITY() AS CustomerID;
      `);

    const customerID = +r.recordset[0].CustomerID;

    await _upsertAddress(transaction, CUSTOMER_ENTITY_TYPE, customerID, null, address);
    await _replaceContacts(transaction, CUSTOMER_ENTITY_TYPE, customerID, contacts);

    await transaction.commit();
    res.json({ success: true, data: { customerID }, message: 'לקוח נוצר בהצלחה' });
  } catch (e) {
    await transaction.rollback();
    res.status(500).json({ success: false, data: null, message: e.message });
  }
});

// ── PUT /api/customers/:id  (update) ───────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  const pool = await getPool();
  const id   = +req.params.id;
  const { customer, address, contacts } = req.body;
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction)
      .input('id',                   sql.Int,            id)
      .input('ShortNameEN',          sql.NVarChar(30),  customer.shortNameEN          || null)
      .input('ShortNameHE',          sql.NVarChar(30),  customer.shortNameHE          || null)
      .input('FullNameEN',           sql.NVarChar(80),  customer.fullNameEN           || null)
      .input('FullNameHE',           sql.NVarChar(80),  customer.fullNameHE           || null)
      .input('VATRate',              sql.Decimal(5,2),  customer.vatRate              ?? null)
      .input('CompanyRegNo',         sql.NVarChar(30),  customer.companyRegNo         || null)
      .input('DefaultCurrencyID',    sql.SmallInt,       customer.defaultCurrencyID    || null)
      .input('DefaultPaymentTermID', sql.SmallInt,       customer.defaultPaymentTermID || null)
      .input('DefaultSalesDomainID', sql.SmallInt,       customer.defaultSalesDomainID || null)
      .input('PSNPrefix',            sql.NVarChar(10),  customer.psnPrefix            || null)
      .input('PSNNumerator',         sql.Int,            customer.psnNumerator         || null)
      .input('Notes',                sql.NVarChar(500), customer.notes                || null)
      .input('IsActive',             sql.Bit,            customer.isActive !== false ? 1 : 0)
      .query(`
        UPDATE tblCustomers SET
          ShortNameEN=@ShortNameEN, ShortNameHE=@ShortNameHE,
          FullNameEN=@FullNameEN,   FullNameHE=@FullNameHE,
          VATRate=@VATRate,         CompanyRegNo=@CompanyRegNo,
          DefaultCurrencyID=@DefaultCurrencyID,
          DefaultPaymentTermID=@DefaultPaymentTermID,
          DefaultSalesDomainID=@DefaultSalesDomainID,
          PSNPrefix=@PSNPrefix,     PSNNumerator=@PSNNumerator,
          Notes=@Notes,             IsActive=@IsActive,
          UpdatedAt=SYSDATETIME()
        WHERE CustomerID=@id
      `);

    const ea = await new sql.Request(transaction)
      .input('id', sql.Int, id)
      .query(`
        SELECT TOP 1 EntityAddressID, AddressID
        FROM tblEntityAddresses
        WHERE EntityTypeID=${CUSTOMER_ENTITY_TYPE} AND EntityID=@id AND IsPrimary=1
      `);
    const existingAddressID = ea.recordset[0]?.AddressID ?? null;

    await _upsertAddress(transaction, CUSTOMER_ENTITY_TYPE, id, existingAddressID, address);
    await _replaceContacts(transaction, CUSTOMER_ENTITY_TYPE, id, contacts);

    await transaction.commit();
    res.json({ success: true, message: 'לקוח עודכן בהצלחה' });
  } catch (e) {
    await transaction.rollback();
    res.status(500).json({ success: false, data: null, message: e.message });
  }
});

// ── PATCH /api/customers/:id/toggle-active  ────────────────────────
router.patch('/:id/toggle-active', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input('id', sql.Int, +req.params.id)
      .query(`
        UPDATE tblCustomers
        SET IsActive = CASE WHEN IsActive=1 THEN 0 ELSE 1 END, UpdatedAt=SYSDATETIME()
        OUTPUT INSERTED.IsActive
        WHERE CustomerID=@id
      `);
    const newState = r.recordset[0]?.IsActive;
    res.json({ success: true, data: { isActive: newState }, message: newState ? 'לקוח הופעל' : 'לקוח הושבת' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── DELETE /api/customers/:id  (soft) ──────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, +req.params.id)
      .query(`UPDATE tblCustomers SET IsActive=0, UpdatedAt=SYSDATETIME() WHERE CustomerID=@id`);
    res.json({ success: true, message: 'לקוח הושבת' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Shared helpers ──────────────────────────────────────────────────

async function _upsertAddress(transaction, entityTypeID, entityID, existingAddressID, address) {
  if (!address) return;
  const { line1, line2, cityFree, cityID, stateFree, stateID, zipCode, countryID } = address;
  if (!line1 && !line2 && !cityFree && !zipCode && !countryID) return;

  const req = new sql.Request(transaction);
  req.input('Line1',     sql.NVarChar(100), line1     || null);
  req.input('Line2',     sql.NVarChar(100), line2     || null);
  req.input('CityFree',  sql.NVarChar(80),  cityFree  || null);
  req.input('CityID',    sql.Int,           cityID    || null);
  req.input('StateFree', sql.NVarChar(80),  stateFree || null);
  req.input('StateID',   sql.Int,           stateID   || null);
  req.input('CountryID', sql.Int,           countryID || 81);
  req.input('ZipCode',   sql.NVarChar(20),  zipCode   || null);

  if (existingAddressID) {
    req.input('AddressID', sql.BigInt, existingAddressID);
    await req.query(`
      UPDATE tblAddresses SET
        Line1=@Line1, Line2=@Line2, CityFree=@CityFree, CityID=@CityID,
        StateFree=@StateFree, StateID=@StateID, CountryID=@CountryID,
        ZipCode=@ZipCode, UpdatedAt=SYSDATETIME()
      WHERE AddressID=@AddressID
    `);
  } else {
    const ar = await req.query(`
      INSERT INTO tblAddresses (Line1,Line2,CityFree,CityID,StateFree,StateID,CountryID,ZipCode)
      VALUES (@Line1,@Line2,@CityFree,@CityID,@StateFree,@StateID,@CountryID,@ZipCode);
      SELECT SCOPE_IDENTITY() AS AddressID;
    `);
    const newAddressID = ar.recordset[0].AddressID;
    await new sql.Request(transaction)
      .input('eType', sql.SmallInt, entityTypeID)
      .input('eID',   sql.Int,      entityID)
      .input('aID',   sql.BigInt,   newAddressID)
      .query(`
        INSERT INTO tblEntityAddresses (EntityTypeID, EntityID, AddressID, AddressTypeID, IsPrimary)
        VALUES (@eType, @eID, @aID, 1, 1)
      `);
  }
}

async function _replaceContacts(transaction, entityTypeID, entityID, contacts) {
  if (!contacts || !contacts.length) return;

  await new sql.Request(transaction)
    .input('eType', sql.SmallInt, entityTypeID)
    .input('eID',   sql.Int,      entityID)
    .query(`DELETE FROM tblEntityContactMethods WHERE EntityTypeID=@eType AND EntityID=@eID`);

  for (const c of contacts) {
    if (!c.value) continue;

    let methodTypeID = c.methodTypeID || null;
    if (!methodTypeID && c.category) {
      const mt = await new sql.Request(transaction)
        .input('cat', sql.NVarChar(30), c.category)
        .query(`SELECT TOP 1 MethodTypeID FROM tblContactMethodTypes WHERE Category=@cat ORDER BY DefaultOrder`);
      methodTypeID = mt.recordset[0]?.MethodTypeID;
    }
    if (!methodTypeID) continue;

    await new sql.Request(transaction)
      .input('eType',   sql.SmallInt,     entityTypeID)
      .input('eID',     sql.Int,          entityID)
      .input('mType',   sql.SmallInt,     methodTypeID)
      .input('dialID',  sql.Int,          c.dialCountryID || null)
      .input('value',   sql.NVarChar(200), c.value)
      .input('label',   sql.NVarChar(50), c.label || null)
      .input('primary', sql.Bit,          c.isPrimary ? 1 : 0)
      .query(`
        INSERT INTO tblEntityContactMethods
          (EntityTypeID, EntityID, MethodTypeID, DialCountryID, Value, Label, IsPrimary)
        VALUES (@eType, @eID, @mType, @dialID, @value, @label, @primary)
      `);
  }
}

module.exports = router;
