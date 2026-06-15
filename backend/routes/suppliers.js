const express     = require('express');
const router      = express.Router();
const { sql, getPool } = require('../db');
const requireAuth = require('../middleware/auth');

// EntityTypeID = 1 for SUPPLIER (per tblEntityTypes seeding order)
const SUPPLIER_ENTITY_TYPE = 1;

// PascalCase → camelCase (מכיוון ש-mssql מחזיר שמות עמודות כפי שהוגדרו ב-DB)
const toCamel = obj => {
  if (!obj || typeof obj !== 'object') return obj;
  const r = {};
  for (const k of Object.keys(obj)) r[k.charAt(0).toLowerCase() + k.slice(1)] = obj[k];
  return r;
};
const rowsToCamel = arr => arr.map(toCamel);

// ── GET /api/suppliers  (list) ──────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const pool  = await getPool();
    const { search = '' } = req.query;

    const r = await pool.request()
      .input('search', sql.NVarChar, `%${search}%`)
      .query(`
        SELECT
          s.SupplierID,
          ISNULL(NULLIF(RTRIM(s.ShortNameEN),''), RTRIM(s.FullNameEN)) AS ShortNameEN,
          s.ShortNameHE,
          s.FullNameEN,
          s.FullNameHE,
          s.VATNumber,
          s.SupplierTypeID,
          s.IsActive,
          s.CreatedAt,
          -- Primary phone
          (SELECT TOP 1 ecm.Value
           FROM tblEntityContactMethods ecm
           JOIN tblContactMethodTypes mt ON mt.MethodTypeID = ecm.MethodTypeID
           WHERE ecm.EntityTypeID = ${SUPPLIER_ENTITY_TYPE}
             AND ecm.EntityID = s.SupplierID
             AND mt.Category IN ('PHONE','MOBILE')
             AND ecm.IsActive = 1
           ORDER BY ecm.IsPrimary DESC, mt.DefaultOrder) AS PrimaryPhone,
          -- Primary email
          (SELECT TOP 1 ecm.Value
           FROM tblEntityContactMethods ecm
           JOIN tblContactMethodTypes mt ON mt.MethodTypeID = ecm.MethodTypeID
           WHERE ecm.EntityTypeID = ${SUPPLIER_ENTITY_TYPE}
             AND ecm.EntityID = s.SupplierID
             AND mt.Category = 'EMAIL'
             AND ecm.IsActive = 1
           ORDER BY ecm.IsPrimary DESC) AS PrimaryEmail,
          -- Primary city
          (SELECT TOP 1 COALESCE(a.CityFree, '')
           FROM tblEntityAddresses ea
           JOIN tblAddresses a ON a.AddressID = ea.AddressID
           WHERE ea.EntityTypeID = ${SUPPLIER_ENTITY_TYPE}
             AND ea.EntityID = s.SupplierID
             AND ea.IsPrimary = 1
             AND a.IsActive = 1) AS PrimaryCity,
          -- Primary country
          (SELECT TOP 1 co.NameEN
           FROM tblEntityAddresses ea
           JOIN tblAddresses a ON a.AddressID = ea.AddressID
           JOIN tblCountries co ON co.CountryID = a.CountryID
           WHERE ea.EntityTypeID = ${SUPPLIER_ENTITY_TYPE}
             AND ea.EntityID = s.SupplierID
             AND ea.IsPrimary = 1
             AND a.IsActive = 1) AS PrimaryCountry
        FROM tblSuppliers s
        WHERE (
          s.ShortNameEN LIKE @search OR s.ShortNameHE LIKE @search
          OR s.FullNameEN LIKE @search OR s.FullNameHE LIKE @search
          OR CAST(s.SupplierID AS NVARCHAR) LIKE @search
        )
        ORDER BY
          CASE WHEN COALESCE(NULLIF(RTRIM(s.ShortNameEN),''), NULLIF(RTRIM(s.FullNameEN),''), NULLIF(RTRIM(s.ShortNameHE),''), NULLIF(RTRIM(s.FullNameHE),'')) IS NULL THEN 1 ELSE 0 END,
          COALESCE(NULLIF(RTRIM(s.ShortNameEN),''), NULLIF(RTRIM(s.FullNameEN),''), NULLIF(RTRIM(s.ShortNameHE),''), NULLIF(RTRIM(s.FullNameHE),''))
      `);

    res.json({ success: true, data: rowsToCamel(r.recordset), total: r.recordset.length, message: '' });
  } catch (e) {
    res.status(500).json({ success: false, data: null, message: e.message });
  }
});

// ── GET /api/suppliers/ai-lookup?name=...  ──────────────────────────
router.get('/ai-lookup', requireAuth, async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(503).json({ success: false, message: 'מפתח Anthropic API חסר ב-.env' });

    const name = (req.query.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'שם ספק נדרש' });

    const prompt = `You are a business data researcher with broad knowledge of companies worldwide.
Find information about this company (multiple names/languages may be provided, separated by " / "): "${name}"

Return ONLY a valid JSON object (no explanation, no markdown fences) with exactly these fields (use null for unknown):
{
  "fullNameEN": "official full English name",
  "fullNameHE": "Hebrew name if Israeli/known",
  "vatNumber": "tax ID / registration number",
  "phone": "main phone with country code e.g. +972-3-1234567",
  "email": "main contact email",
  "website": "website URL with https://",
  "addressLine1": "street address",
  "city": "city name in local language or English",
  "country": "country name in English",
  "notes": "2-3 sentence description of what the company does",
  "sources": ["list the types of sources or registries where you found or can verify this information, e.g. 'Company website', 'Israel Companies Registrar', 'LinkedIn', 'Wikipedia', 'EU VAT registry'. Array of strings, null if none."]
}`;

    const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const aiData = await aiResp.json();
    if (!aiResp.ok) return res.status(502).json({ success: false, message: aiData.error?.message || 'שגיאת Anthropic API' });

    const text = aiData.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.json({ success: false, message: 'לא הצליח לפרסר תגובת AI' });

    const parsed = JSON.parse(match[0]);
    res.json({ success: true, data: parsed });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── GET /api/suppliers/:id  (detail) ───────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const id   = +req.params.id;

    const sup = await pool.request()
      .input('id', sql.Int, id)
      .query(`SELECT * FROM tblSuppliers WHERE SupplierID = @id`);

    if (!sup.recordset.length)
      return res.status(404).json({ success: false, message: 'ספק לא נמצא' });

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
        WHERE ea.EntityTypeID = ${SUPPLIER_ENTITY_TYPE}
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
        WHERE ecm.EntityTypeID = ${SUPPLIER_ENTITY_TYPE}
          AND ecm.EntityID = @id
          AND ecm.IsActive = 1
        ORDER BY ecm.IsPrimary DESC, mt.DefaultOrder
      `);

    res.json({
      success: true,
      data: {
        ...toCamel(sup.recordset[0]),
        addresses:      rowsToCamel(addrs.recordset),
        contactMethods: rowsToCamel(contacts.recordset),
      },
      message: '',
    });
  } catch (e) {
    res.status(500).json({ success: false, data: null, message: e.message });
  }
});

// ── POST /api/suppliers  (create) ──────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const pool = await getPool();
  const { supplier, address, contacts } = req.body;
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    // Insert supplier header
    const r = await new sql.Request(transaction)
      .input('ShortNameEN',    sql.NVarChar(30),  supplier.shortNameEN    || null)
      .input('ShortNameHE',    sql.NVarChar(30),  supplier.shortNameHE    || null)
      .input('FullNameEN',     sql.NVarChar(80),  supplier.fullNameEN     || null)
      .input('FullNameHE',     sql.NVarChar(80),  supplier.fullNameHE     || null)
      .input('VATNumber',      sql.NVarChar(20),  supplier.vatNumber      || null)
      .input('SupplierTypeID', sql.SmallInt,       supplier.supplierTypeID || null)
      .input('PaymentBankID',  sql.SmallInt,       supplier.paymentBankID  || null)
      .input('PSNPrefix',      sql.NVarChar(10),  supplier.psnPrefix      || null)
      .input('PSNNumerator',   sql.Int,            supplier.psnNumerator   || null)
      .input('Notes',          sql.NVarChar(500), supplier.notes          || null)
      .input('IsActive',       sql.Bit,            supplier.isActive !== false ? 1 : 0)
      .input('CreatedByUser',  sql.Int,            req.user?.userId        || null)
      .query(`
        INSERT INTO tblSuppliers
          (ShortNameEN, ShortNameHE, FullNameEN, FullNameHE, VATNumber,
           SupplierTypeID, PaymentBankID, PSNPrefix, PSNNumerator, Notes,
           IsActive, CreatedByUserID)
        VALUES
          (@ShortNameEN, @ShortNameHE, @FullNameEN, @FullNameHE, @VATNumber,
           @SupplierTypeID, @PaymentBankID, @PSNPrefix, @PSNNumerator, @Notes,
           @IsActive, @CreatedByUser);
        SELECT SCOPE_IDENTITY() AS SupplierID;
      `);

    const supplierID = +r.recordset[0].SupplierID;

    await _upsertAddress(transaction, SUPPLIER_ENTITY_TYPE, supplierID, null, address);
    await _replaceContacts(transaction, SUPPLIER_ENTITY_TYPE, supplierID, contacts);

    await transaction.commit();
    res.json({ success: true, data: { supplierID }, message: 'ספק נוצר בהצלחה' });
  } catch (e) {
    await transaction.rollback();
    res.status(500).json({ success: false, data: null, message: e.message });
  }
});

// ── PUT /api/suppliers/:id  (update) ───────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  const pool = await getPool();
  const id   = +req.params.id;
  const { supplier, address, contacts } = req.body;
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction)
      .input('id',             sql.Int,            id)
      .input('ShortNameEN',    sql.NVarChar(30),  supplier.shortNameEN    || null)
      .input('ShortNameHE',    sql.NVarChar(30),  supplier.shortNameHE    || null)
      .input('FullNameEN',     sql.NVarChar(80),  supplier.fullNameEN     || null)
      .input('FullNameHE',     sql.NVarChar(80),  supplier.fullNameHE     || null)
      .input('VATNumber',      sql.NVarChar(20),  supplier.vatNumber      || null)
      .input('SupplierTypeID', sql.SmallInt,       supplier.supplierTypeID || null)
      .input('PaymentBankID',  sql.SmallInt,       supplier.paymentBankID  || null)
      .input('PSNPrefix',      sql.NVarChar(10),  supplier.psnPrefix      || null)
      .input('PSNNumerator',   sql.Int,            supplier.psnNumerator   || null)
      .input('Notes',          sql.NVarChar(500), supplier.notes          || null)
      .input('IsActive',       sql.Bit,            supplier.isActive !== false ? 1 : 0)
      .query(`
        UPDATE tblSuppliers SET
          ShortNameEN=@ShortNameEN, ShortNameHE=@ShortNameHE,
          FullNameEN=@FullNameEN,   FullNameHE=@FullNameHE,
          VATNumber=@VATNumber,     SupplierTypeID=@SupplierTypeID,
          PaymentBankID=@PaymentBankID, PSNPrefix=@PSNPrefix,
          PSNNumerator=@PSNNumerator, Notes=@Notes,
          IsActive=@IsActive,       UpdatedAt=SYSDATETIME()
        WHERE SupplierID = @id
      `);

    // Fetch existing primary address for upsert
    const ea = await new sql.Request(transaction)
      .input('id', sql.Int, id)
      .query(`
        SELECT TOP 1 EntityAddressID, AddressID
        FROM tblEntityAddresses
        WHERE EntityTypeID=${SUPPLIER_ENTITY_TYPE} AND EntityID=@id AND IsPrimary=1
      `);
    const existingAddressID = ea.recordset[0]?.AddressID ?? null;

    await _upsertAddress(transaction, SUPPLIER_ENTITY_TYPE, id, existingAddressID, address);
    await _replaceContacts(transaction, SUPPLIER_ENTITY_TYPE, id, contacts);

    await transaction.commit();
    res.json({ success: true, message: 'ספק עודכן בהצלחה' });
  } catch (e) {
    await transaction.rollback();
    res.status(500).json({ success: false, data: null, message: e.message });
  }
});

// ── PATCH /api/suppliers/:id/toggle-active  ─────────────────────────
router.patch('/:id/toggle-active', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input('id', sql.Int, +req.params.id)
      .query(`
        UPDATE tblSuppliers
        SET IsActive = CASE WHEN IsActive=1 THEN 0 ELSE 1 END, UpdatedAt=SYSDATETIME()
        OUTPUT INSERTED.IsActive
        WHERE SupplierID=@id
      `);
    const newState = r.recordset[0]?.IsActive;
    res.json({ success: true, data: { isActive: newState }, message: newState ? 'ספק הופעל' : 'ספק הושבת' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── DELETE /api/suppliers/:id  (soft) ──────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, +req.params.id)
      .query(`UPDATE tblSuppliers SET IsActive=0, UpdatedAt=SYSDATETIME() WHERE SupplierID=@id`);
    res.json({ success: true, message: 'ספק הושבת' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Shared helpers ──────────────────────────────────────────────────

async function _upsertAddress(transaction, entityTypeID, entityID, existingAddressID, address) {
  if (!address) return;
  const { line1, line2, cityFree, cityID, stateFree, stateID, zipCode, countryID } = address;
  const hasData = line1 || line2 || cityFree || cityID || zipCode || countryID;
  if (!hasData) return;

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

    // Prefer direct methodTypeID; fall back to category lookup for backward compat
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
