const express = require('express');
const router  = express.Router();
const { sql, getPool } = require('../db');
const requireAuth = require('../middleware/auth');
const audit = require('../helpers/sfAuditLogger');

router.use(requireAuth);

// ─────────────────────────────────────────────────────────────────────────────
// Generic helpers
// ─────────────────────────────────────────────────────────────────────────────
function ok(res, data)  { res.json({ success: true,  data }); }
function fail(res, msg) { res.status(500).json({ success: false, message: msg }); }

// ─────────────────────────────────────────────────────────────────────────────
// BANKS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/banks', async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .query('SELECT BankID,BankCode,NameHE,NameEN,SwiftCode,BranchNo,IsActive FROM tblBanks ORDER BY BankCode');
    ok(res, r.recordset);
  } catch(e) { fail(res, e.message); }
});

router.post('/banks', async (req, res) => {
  try {
    const { bankCode, nameHE, nameEN, swiftCode, branchNo } = req.body;
    const pool = await getPool();
    const r = await pool.request()
      .input('BankCode',  sql.NVarChar(10),  bankCode)
      .input('NameHE',    sql.NVarChar(100), nameHE)
      .input('NameEN',    sql.NVarChar(100), nameEN || null)
      .input('SwiftCode', sql.NVarChar(11),  swiftCode || null)
      .input('BranchNo',  sql.NVarChar(10),  branchNo || null)
      .query('INSERT INTO tblBanks (BankCode,NameHE,NameEN,SwiftCode,BranchNo) OUTPUT INSERTED.BankID VALUES (@BankCode,@NameHE,@NameEN,@SwiftCode,@BranchNo)');
    const id = r.recordset[0].BankID;
    audit.logAction(req, { actionType:'CREATE', entityType:'BANK', entityId:id, entityName:nameHE, newValue:req.body });
    ok(res, { bankId: id });
  } catch(e) { fail(res, e.message); }
});

router.put('/banks/:id', async (req, res) => {
  try {
    const { bankCode, nameHE, nameEN, swiftCode, branchNo, isActive } = req.body;
    const pool = await getPool();
    const old = await pool.request().input('ID',sql.Int,+req.params.id).query('SELECT * FROM tblBanks WHERE BankID=@ID');
    await pool.request()
      .input('ID',        sql.Int,           +req.params.id)
      .input('BankCode',  sql.NVarChar(10),  bankCode)
      .input('NameHE',    sql.NVarChar(100), nameHE)
      .input('NameEN',    sql.NVarChar(100), nameEN || null)
      .input('SwiftCode', sql.NVarChar(11),  swiftCode || null)
      .input('BranchNo',  sql.NVarChar(10),  branchNo || null)
      .input('IsActive',  sql.Bit,           isActive ? 1 : 0)
      .query('UPDATE tblBanks SET BankCode=@BankCode,NameHE=@NameHE,NameEN=@NameEN,SwiftCode=@SwiftCode,BranchNo=@BranchNo,IsActive=@IsActive,UpdatedAt=GETDATE() WHERE BankID=@ID');
    audit.logAction(req, { actionType:'UPDATE', entityType:'BANK', entityId:+req.params.id, entityName:nameHE, oldValue:old.recordset[0], newValue:req.body });
    ok(res, { bankId: +req.params.id });
  } catch(e) { fail(res, e.message); }
});

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMS BROKERS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/customs-brokers', async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .query('SELECT BrokerID,NameHE,NameEN,LicenseNo,ContactName,Phone,Email,Address,IsActive FROM tblCustomsBrokers ORDER BY NameHE');
    ok(res, r.recordset);
  } catch(e) { fail(res, e.message); }
});

router.post('/customs-brokers', async (req, res) => {
  try {
    const { nameHE, nameEN, licenseNo, contactName, phone, email, address } = req.body;
    const pool = await getPool();
    const r = await pool.request()
      .input('NameHE',      sql.NVarChar(100), nameHE)
      .input('NameEN',      sql.NVarChar(100), nameEN || null)
      .input('LicenseNo',   sql.NVarChar(30),  licenseNo || null)
      .input('ContactName', sql.NVarChar(100), contactName || null)
      .input('Phone',       sql.NVarChar(30),  phone || null)
      .input('Email',       sql.NVarChar(100), email || null)
      .input('Address',     sql.NVarChar(200), address || null)
      .query('INSERT INTO tblCustomsBrokers (NameHE,NameEN,LicenseNo,ContactName,Phone,Email,Address) OUTPUT INSERTED.BrokerID VALUES (@NameHE,@NameEN,@LicenseNo,@ContactName,@Phone,@Email,@Address)');
    const id = r.recordset[0].BrokerID;
    audit.logAction(req, { actionType:'CREATE', entityType:'CUSTOMS_BROKER', entityId:id, entityName:nameHE, newValue:req.body });
    ok(res, { brokerId: id });
  } catch(e) { fail(res, e.message); }
});

router.put('/customs-brokers/:id', async (req, res) => {
  try {
    const { nameHE, nameEN, licenseNo, contactName, phone, email, address, isActive } = req.body;
    const pool = await getPool();
    const old = await pool.request().input('ID',sql.Int,+req.params.id).query('SELECT * FROM tblCustomsBrokers WHERE BrokerID=@ID');
    await pool.request()
      .input('ID',          sql.Int,           +req.params.id)
      .input('NameHE',      sql.NVarChar(100), nameHE)
      .input('NameEN',      sql.NVarChar(100), nameEN || null)
      .input('LicenseNo',   sql.NVarChar(30),  licenseNo || null)
      .input('ContactName', sql.NVarChar(100), contactName || null)
      .input('Phone',       sql.NVarChar(30),  phone || null)
      .input('Email',       sql.NVarChar(100), email || null)
      .input('Address',     sql.NVarChar(200), address || null)
      .input('IsActive',    sql.Bit,           isActive ? 1 : 0)
      .query('UPDATE tblCustomsBrokers SET NameHE=@NameHE,NameEN=@NameEN,LicenseNo=@LicenseNo,ContactName=@ContactName,Phone=@Phone,Email=@Email,Address=@Address,IsActive=@IsActive,UpdatedAt=GETDATE() WHERE BrokerID=@ID');
    audit.logAction(req, { actionType:'UPDATE', entityType:'CUSTOMS_BROKER', entityId:+req.params.id, entityName:nameHE, oldValue:old.recordset[0], newValue:req.body });
    ok(res, { brokerId: +req.params.id });
  } catch(e) { fail(res, e.message); }
});

// ─────────────────────────────────────────────────────────────────────────────
// FORWARDERS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/forwarders', async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .query('SELECT ForwarderID,NameHE,NameEN,ContactName,Phone,Email,Country,IsActive FROM tblForwarders ORDER BY NameHE');
    ok(res, r.recordset);
  } catch(e) { fail(res, e.message); }
});

router.post('/forwarders', async (req, res) => {
  try {
    const { nameHE, nameEN, contactName, phone, email, country } = req.body;
    const pool = await getPool();
    const r = await pool.request()
      .input('NameHE',      sql.NVarChar(100), nameHE)
      .input('NameEN',      sql.NVarChar(100), nameEN || null)
      .input('ContactName', sql.NVarChar(100), contactName || null)
      .input('Phone',       sql.NVarChar(30),  phone || null)
      .input('Email',       sql.NVarChar(100), email || null)
      .input('Country',     sql.NVarChar(60),  country || null)
      .query('INSERT INTO tblForwarders (NameHE,NameEN,ContactName,Phone,Email,Country) OUTPUT INSERTED.ForwarderID VALUES (@NameHE,@NameEN,@ContactName,@Phone,@Email,@Country)');
    const id = r.recordset[0].ForwarderID;
    audit.logAction(req, { actionType:'CREATE', entityType:'FORWARDER', entityId:id, entityName:nameHE, newValue:req.body });
    ok(res, { forwarderId: id });
  } catch(e) { fail(res, e.message); }
});

router.put('/forwarders/:id', async (req, res) => {
  try {
    const { nameHE, nameEN, contactName, phone, email, country, isActive } = req.body;
    const pool = await getPool();
    const old = await pool.request().input('ID',sql.Int,+req.params.id).query('SELECT * FROM tblForwarders WHERE ForwarderID=@ID');
    await pool.request()
      .input('ID',          sql.Int,           +req.params.id)
      .input('NameHE',      sql.NVarChar(100), nameHE)
      .input('NameEN',      sql.NVarChar(100), nameEN || null)
      .input('ContactName', sql.NVarChar(100), contactName || null)
      .input('Phone',       sql.NVarChar(30),  phone || null)
      .input('Email',       sql.NVarChar(100), email || null)
      .input('Country',     sql.NVarChar(60),  country || null)
      .input('IsActive',    sql.Bit,           isActive ? 1 : 0)
      .query('UPDATE tblForwarders SET NameHE=@NameHE,NameEN=@NameEN,ContactName=@ContactName,Phone=@Phone,Email=@Email,Country=@Country,IsActive=@IsActive,UpdatedAt=GETDATE() WHERE ForwarderID=@ID');
    audit.logAction(req, { actionType:'UPDATE', entityType:'FORWARDER', entityId:+req.params.id, entityName:nameHE, oldValue:old.recordset[0], newValue:req.body });
    ok(res, { forwarderId: +req.params.id });
  } catch(e) { fail(res, e.message); }
});

// ─────────────────────────────────────────────────────────────────────────────
// DISCOUNT RULES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/discount-rules', async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .query('SELECT DiscountID,RuleCode,Description,DiscountPct,AppliesTo,ValidFrom,ValidTo,Notes,IsActive FROM tblDiscountRules ORDER BY RuleCode');
    ok(res, r.recordset);
  } catch(e) { fail(res, e.message); }
});

router.post('/discount-rules', async (req, res) => {
  try {
    const { ruleCode, description, discountPct, appliesTo, validFrom, validTo, notes } = req.body;
    const pool = await getPool();
    const r = await pool.request()
      .input('RuleCode',    sql.NVarChar(20),  ruleCode)
      .input('Description', sql.NVarChar(200), description)
      .input('DiscountPct', sql.Decimal(5,2),  discountPct || 0)
      .input('AppliesTo',   sql.NVarChar(20),  appliesTo || 'ALL')
      .input('ValidFrom',   sql.Date,          validFrom || null)
      .input('ValidTo',     sql.Date,          validTo || null)
      .input('Notes',       sql.NVarChar(500), notes || null)
      .query('INSERT INTO tblDiscountRules (RuleCode,Description,DiscountPct,AppliesTo,ValidFrom,ValidTo,Notes) OUTPUT INSERTED.DiscountID VALUES (@RuleCode,@Description,@DiscountPct,@AppliesTo,@ValidFrom,@ValidTo,@Notes)');
    const id = r.recordset[0].DiscountID;
    audit.logAction(req, { actionType:'CREATE', entityType:'DISCOUNT_RULE', entityId:id, entityName:description, newValue:req.body });
    ok(res, { discountId: id });
  } catch(e) { fail(res, e.message); }
});

router.put('/discount-rules/:id', async (req, res) => {
  try {
    const { ruleCode, description, discountPct, appliesTo, validFrom, validTo, notes, isActive } = req.body;
    const pool = await getPool();
    const old = await pool.request().input('ID',sql.Int,+req.params.id).query('SELECT * FROM tblDiscountRules WHERE DiscountID=@ID');
    await pool.request()
      .input('ID',          sql.Int,           +req.params.id)
      .input('RuleCode',    sql.NVarChar(20),  ruleCode)
      .input('Description', sql.NVarChar(200), description)
      .input('DiscountPct', sql.Decimal(5,2),  discountPct || 0)
      .input('AppliesTo',   sql.NVarChar(20),  appliesTo || 'ALL')
      .input('ValidFrom',   sql.Date,          validFrom || null)
      .input('ValidTo',     sql.Date,          validTo || null)
      .input('Notes',       sql.NVarChar(500), notes || null)
      .input('IsActive',    sql.Bit,           isActive ? 1 : 0)
      .query('UPDATE tblDiscountRules SET RuleCode=@RuleCode,Description=@Description,DiscountPct=@DiscountPct,AppliesTo=@AppliesTo,ValidFrom=@ValidFrom,ValidTo=@ValidTo,Notes=@Notes,IsActive=@IsActive,UpdatedAt=GETDATE() WHERE DiscountID=@ID');
    audit.logAction(req, { actionType:'UPDATE', entityType:'DISCOUNT_RULE', entityId:+req.params.id, entityName:description, oldValue:old.recordset[0], newValue:req.body });
    ok(res, { discountId: +req.params.id });
  } catch(e) { fail(res, e.message); }
});

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT TYPES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/document-types', async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .query('SELECT DocTypeID,DocCode,NameHE,NameEN,IsMandatory,SortOrder,IsActive FROM tblDocumentTypes ORDER BY SortOrder,DocCode');
    ok(res, r.recordset);
  } catch(e) { fail(res, e.message); }
});

router.post('/document-types', async (req, res) => {
  try {
    const { docCode, nameHE, nameEN, isMandatory, sortOrder } = req.body;
    const pool = await getPool();
    const r = await pool.request()
      .input('DocCode',     sql.NVarChar(20),  docCode)
      .input('NameHE',      sql.NVarChar(100), nameHE)
      .input('NameEN',      sql.NVarChar(100), nameEN || null)
      .input('IsMandatory', sql.Bit,           isMandatory ? 1 : 0)
      .input('SortOrder',   sql.Int,           sortOrder || 0)
      .query('INSERT INTO tblDocumentTypes (DocCode,NameHE,NameEN,IsMandatory,SortOrder) OUTPUT INSERTED.DocTypeID VALUES (@DocCode,@NameHE,@NameEN,@IsMandatory,@SortOrder)');
    const id = r.recordset[0].DocTypeID;
    audit.logAction(req, { actionType:'CREATE', entityType:'DOCUMENT_TYPE', entityId:id, entityName:nameHE, newValue:req.body });
    ok(res, { docTypeId: id });
  } catch(e) { fail(res, e.message); }
});

router.put('/document-types/:id', async (req, res) => {
  try {
    const { docCode, nameHE, nameEN, isMandatory, sortOrder, isActive } = req.body;
    const pool = await getPool();
    const old = await pool.request().input('ID',sql.Int,+req.params.id).query('SELECT * FROM tblDocumentTypes WHERE DocTypeID=@ID');
    await pool.request()
      .input('ID',          sql.Int,           +req.params.id)
      .input('DocCode',     sql.NVarChar(20),  docCode)
      .input('NameHE',      sql.NVarChar(100), nameHE)
      .input('NameEN',      sql.NVarChar(100), nameEN || null)
      .input('IsMandatory', sql.Bit,           isMandatory ? 1 : 0)
      .input('SortOrder',   sql.Int,           sortOrder || 0)
      .input('IsActive',    sql.Bit,           isActive ? 1 : 0)
      .query('UPDATE tblDocumentTypes SET DocCode=@DocCode,NameHE=@NameHE,NameEN=@NameEN,IsMandatory=@IsMandatory,SortOrder=@SortOrder,IsActive=@IsActive,UpdatedAt=GETDATE() WHERE DocTypeID=@ID');
    audit.logAction(req, { actionType:'UPDATE', entityType:'DOCUMENT_TYPE', entityId:+req.params.id, entityName:nameHE, oldValue:old.recordset[0], newValue:req.body });
    ok(res, { docTypeId: +req.params.id });
  } catch(e) { fail(res, e.message); }
});

// ─────────────────────────────────────────────────────────────────────────────
// PRINTER PARAMS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/printer-params', async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .query('SELECT ParamID,CompanyID,ParamKey,ParamValue,Description,SortOrder,IsActive FROM tblPrinterParams ORDER BY SortOrder,ParamKey');
    ok(res, r.recordset);
  } catch(e) { fail(res, e.message); }
});

router.post('/printer-params', async (req, res) => {
  try {
    const { companyId, paramKey, paramValue, description, sortOrder } = req.body;
    const pool = await getPool();
    const r = await pool.request()
      .input('CompanyID',   sql.Int,           companyId || null)
      .input('ParamKey',    sql.NVarChar(50),  paramKey)
      .input('ParamValue',  sql.NVarChar(500), paramValue || null)
      .input('Description', sql.NVarChar(200), description || null)
      .input('SortOrder',   sql.Int,           sortOrder || 0)
      .query('INSERT INTO tblPrinterParams (CompanyID,ParamKey,ParamValue,Description,SortOrder) OUTPUT INSERTED.ParamID VALUES (@CompanyID,@ParamKey,@ParamValue,@Description,@SortOrder)');
    const id = r.recordset[0].ParamID;
    audit.logAction(req, { actionType:'CREATE', entityType:'PRINTER_PARAM', entityId:id, entityName:paramKey, newValue:req.body });
    ok(res, { paramId: id });
  } catch(e) { fail(res, e.message); }
});

router.put('/printer-params/:id', async (req, res) => {
  try {
    const { companyId, paramKey, paramValue, description, sortOrder, isActive } = req.body;
    const pool = await getPool();
    const old = await pool.request().input('ID',sql.Int,+req.params.id).query('SELECT * FROM tblPrinterParams WHERE ParamID=@ID');
    await pool.request()
      .input('ID',          sql.Int,           +req.params.id)
      .input('CompanyID',   sql.Int,           companyId || null)
      .input('ParamKey',    sql.NVarChar(50),  paramKey)
      .input('ParamValue',  sql.NVarChar(500), paramValue || null)
      .input('Description', sql.NVarChar(200), description || null)
      .input('SortOrder',   sql.Int,           sortOrder || 0)
      .input('IsActive',    sql.Bit,           isActive ? 1 : 0)
      .query('UPDATE tblPrinterParams SET CompanyID=@CompanyID,ParamKey=@ParamKey,ParamValue=@ParamValue,Description=@Description,SortOrder=@SortOrder,IsActive=@IsActive,UpdatedAt=GETDATE() WHERE ParamID=@ID');
    audit.logAction(req, { actionType:'UPDATE', entityType:'PRINTER_PARAM', entityId:+req.params.id, entityName:paramKey, oldValue:old.recordset[0], newValue:req.body });
    ok(res, { paramId: +req.params.id });
  } catch(e) { fail(res, e.message); }
});

// ─────────────────────────────────────────────────────────────────────────────
// CURRENCY RATES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/currency-rates', async (req, res) => {
  try {
    const pool = await getPool();
    // One row per active currency — latest rate each
    const r = await pool.request().query(`
      SELECT
        c.CurrencyID,
        c.CurrencyCode,
        c.CurrencyName,
        c.CurrencySymbol AS Symbol,
        c.IsActive,
        cr.RateID,
        cr.RateDate,
        cr.RateToILS,
        cr.Source,
        cr.CreatedAt AS UpdatedAt
      FROM tblCurrencies c
      LEFT JOIN (
        SELECT cr1.*
        FROM tblCurrencyRates cr1
        INNER JOIN (
          SELECT CurrencyID, MAX(RateDate) AS MaxDate
          FROM tblCurrencyRates
          GROUP BY CurrencyID
        ) mx ON cr1.CurrencyID=mx.CurrencyID AND cr1.RateDate=mx.MaxDate
      ) cr ON cr.CurrencyID = c.CurrencyID
      WHERE c.IsActive = 1
      ORDER BY c.CurrencyCode
    `);
    ok(res, r.recordset);
  } catch(e) { fail(res, e.message); }
});

router.post('/currency-rates', async (req, res) => {
  try {
    const { currencyId, rateDate, rateToILS, source } = req.body;
    const pool = await getPool();
    const r = await pool.request()
      .input('CurrencyID', sql.Int,           +currencyId)
      .input('RateDate',   sql.Date,          rateDate)
      .input('RateToILS',  sql.Decimal(18,6), +rateToILS)
      .input('Source',     sql.NVarChar(50),  source || 'MANUAL')
      .query(`
        MERGE tblCurrencyRates AS t
        USING (SELECT @CurrencyID AS CurrencyID, @RateDate AS RateDate) AS s
          ON t.CurrencyID=s.CurrencyID AND t.RateDate=s.RateDate
        WHEN MATCHED THEN UPDATE SET RateToILS=@RateToILS, Source=@Source
        WHEN NOT MATCHED THEN INSERT (CurrencyID,RateDate,RateToILS,Source) VALUES (@CurrencyID,@RateDate,@RateToILS,@Source);
        SELECT SCOPE_IDENTITY() AS RateID
      `);
    const cur = await pool.request().input('ID',sql.Int,+currencyId).query('SELECT CurrencyCode FROM tblCurrencies WHERE CurrencyID=@ID');
    const code = cur.recordset[0]?.CurrencyCode || currencyId;
    audit.logAction(req, { actionType:'CREATE', entityType:'CURRENCY_RATE', entityName:`${code} ${rateDate}`, newValue:req.body });
    ok(res, { saved: true });
  } catch(e) { fail(res, e.message); }
});

router.delete('/currency-rates/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const old = await pool.request().input('ID',sql.Int,+req.params.id).query('SELECT * FROM tblCurrencyRates WHERE RateID=@ID');
    await pool.request().input('ID',sql.Int,+req.params.id).query('DELETE FROM tblCurrencyRates WHERE RateID=@ID');
    audit.logAction(req, { actionType:'DELETE', entityType:'CURRENCY_RATE', entityId:+req.params.id, oldValue:old.recordset[0], severity:'WARN' });
    ok(res, { deleted: true });
  } catch(e) { fail(res, e.message); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC DEACTIVATE (soft-delete: IsActive=0)
// ─────────────────────────────────────────────────────────────────────────────
const DEACTIVATE_MAP = {
  'banks':           { table: 'tblBanks',               idField: 'BankID',        activeField: 'IsActive'      },
  'customs-brokers': { table: 'tblCustomsBrokers',       idField: 'BrokerID',      activeField: 'IsActive'      },
  'forwarders':      { table: 'tblForwarders',           idField: 'ForwarderID',   activeField: 'IsActive'      },
  'discount-rules':  { table: 'tblDiscountRules',        idField: 'RuleID',        activeField: 'IsActive'      },
  'document-types':  { table: 'tblDocumentTypes',        idField: 'DocTypeID',     activeField: 'IsActive'      },
  'printer-params':  { table: 'tblPrinterParams',        idField: 'ParamID',       activeField: 'IsActive'      },
  'countries':       { table: 'tblCountries',            idField: 'CountryID',     activeField: 'IsActive'      },
  'uom':             { table: 'tblUnitsOfMeasure',       idField: 'UOM_ID',        activeField: 'UOM_IsActive'  },
  'terms-of-sale':   { table: 'tblTermsOfSale',          idField: 'TOS_ID',        activeField: 'TOS_IsActive'  },
  'container-types': { table: 'tblContainerTypes',       idField: 'COT_ID',        activeField: 'COT_IsActive'  },
  'warehouses':      { table: 'tblWareHouseList',        idField: 'WHL_ID',        activeField: 'WHL_IsActive'  },
  'import-status':   { table: 'tblImportProcessStatus',  idField: 'IPS_ID',        activeField: 'IPS_isActive'  },
  'order-types':     { table: 'tblOrderType',            idField: 'OT_ID',         activeField: 'OT_IsActive'   },
  'sales-persons':   { table: 'tblSalesPersons',         idField: 'SalesPersonID', activeField: 'IsActive'      },
  'cities':          { table: 'tblCities',               idField: 'CityID',        activeField: 'IsActive'      },
  'kosher-types':    { table: 'tblTypesOfKosher',        idField: 'TOK_ID',        activeField: 'TOK_IsActive'  },
  'item-categories': { table: 'tblItemCategories',       idField: 'CategoryID',    activeField: 'IsActive'      },
};

router.put('/deactivate', async (req, res) => {
  const { entity, id } = req.body;
  const map = DEACTIVATE_MAP[entity];
  if (!map) return res.status(400).json({ success: false, message: 'Unknown entity' });
  try {
    await (await getPool()).request()
      .input('ID', sql.Int, +id)
      .query(`UPDATE ${map.table} SET ${map.activeField}=0 WHERE ${map.idField}=@ID`);
    audit.logAction(req, { actionType: 'DEACTIVATE', entityType: entity.toUpperCase().replace(/-/g,'_'), entityId: +id, severity: 'WARN' });
    ok(res, { deactivated: true });
  } catch(e) { fail(res, e.message); }
});

// ─────────────────────────────────────────────────────────────────────────────
// COUNTRIES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/countries', async (req, res) => {
  try {
    const r = await (await getPool()).request().query(
      `SELECT CountryID,CountryCode,CountryCode3,NameHE,NameEN,DialCode,IsActive FROM tblCountries ORDER BY NameHE`
    );
    ok(res, r.recordset);
  } catch(e) { fail(res, e.message); }
});
router.put('/countries/:id', async (req, res) => {
  try {
    const { isActive } = req.body;
    await (await getPool()).request()
      .input('ID', sql.Int, +req.params.id)
      .input('IsActive', sql.Bit, isActive ? 1 : 0)
      .query(`UPDATE tblCountries SET IsActive=@IsActive WHERE CountryID=@ID`);
    audit.logAction(req,{actionType:'UPDATE',entityType:'COUNTRY',entityId:+req.params.id,newValue:req.body});
    ok(res,{updated:true});
  } catch(e) { fail(res,e.message); }
});

// ─────────────────────────────────────────────────────────────────────────────
// UNITS OF MEASURE
// ─────────────────────────────────────────────────────────────────────────────
router.get('/uom', async (req, res) => {
  try {
    const r = await (await getPool()).request().query(
      `SELECT UOM_ID,UOM_UnitDescShort,UOM_UnitDesc,UOM_Order,UOM_IsActive FROM tblUnitsOfMeasure ORDER BY UOM_Order`
    );
    ok(res, r.recordset);
  } catch(e) { fail(res, e.message); }
});
router.post('/uom', async (req, res) => {
  try {
    const {shortDesc,fullDesc,sortOrder} = req.body;
    const r = await (await getPool()).request()
      .input('S',sql.NVarChar(50),shortDesc).input('F',sql.NVarChar(50),fullDesc)
      .input('O',sql.Int,+sortOrder||0)
      .query(`INSERT INTO tblUnitsOfMeasure(UOM_UnitDescShort,UOM_UnitDesc,UOM_Order,UOM_IsActive) VALUES(@S,@F,@O,1); SELECT SCOPE_IDENTITY() AS id`);
    audit.logAction(req,{actionType:'CREATE',entityType:'UOM',entityName:shortDesc,newValue:req.body});
    ok(res,{id:r.recordset[0].id});
  } catch(e) { fail(res,e.message); }
});
router.put('/uom/:id', async (req, res) => {
  try {
    const {shortDesc,fullDesc,sortOrder,isActive} = req.body;
    await (await getPool()).request()
      .input('ID',sql.Int,+req.params.id)
      .input('S',sql.NVarChar(50),shortDesc).input('F',sql.NVarChar(50),fullDesc)
      .input('O',sql.Int,+sortOrder||0).input('A',sql.Bit,isActive?1:0)
      .query(`UPDATE tblUnitsOfMeasure SET UOM_UnitDescShort=@S,UOM_UnitDesc=@F,UOM_Order=@O,UOM_IsActive=@A WHERE UOM_ID=@ID`);
    audit.logAction(req,{actionType:'UPDATE',entityType:'UOM',entityId:+req.params.id,newValue:req.body});
    ok(res,{updated:true});
  } catch(e) { fail(res,e.message); }
});

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT TERMS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/payment-terms', async (req, res) => {
  try {
    const r = await (await getPool()).request().query(
      `SELECT PaymentTermID,Description1,Description2,CreditDays FROM tblPaymentTerms ORDER BY CreditDays`
    );
    ok(res, r.recordset);
  } catch(e) { fail(res, e.message); }
});
router.post('/payment-terms', async (req, res) => {
  try {
    const {description1,description2,creditDays} = req.body;
    const r = await (await getPool()).request()
      .input('D1',sql.NVarChar(100),description1).input('D2',sql.NVarChar(100),description2||'')
      .input('C',sql.SmallInt,+creditDays||0)
      .query(`INSERT INTO tblPaymentTerms(Description1,Description2,CreditDays) VALUES(@D1,@D2,@C); SELECT SCOPE_IDENTITY() AS id`);
    audit.logAction(req,{actionType:'CREATE',entityType:'PAYMENT_TERM',entityName:description1,newValue:req.body});
    ok(res,{id:r.recordset[0].id});
  } catch(e) { fail(res,e.message); }
});
router.put('/payment-terms/:id', async (req, res) => {
  try {
    const {description1,description2,creditDays} = req.body;
    await (await getPool()).request()
      .input('ID',sql.SmallInt,+req.params.id)
      .input('D1',sql.NVarChar(100),description1).input('D2',sql.NVarChar(100),description2||'')
      .input('C',sql.SmallInt,+creditDays||0)
      .query(`UPDATE tblPaymentTerms SET Description1=@D1,Description2=@D2,CreditDays=@C WHERE PaymentTermID=@ID`);
    audit.logAction(req,{actionType:'UPDATE',entityType:'PAYMENT_TERM',entityId:+req.params.id,newValue:req.body});
    ok(res,{updated:true});
  } catch(e) { fail(res,e.message); }
});
router.delete('/payment-terms/:id', async (req, res) => {
  try {
    const old = await (await getPool()).request().input('ID',sql.SmallInt,+req.params.id).query('SELECT * FROM tblPaymentTerms WHERE PaymentTermID=@ID');
    await (await getPool()).request().input('ID',sql.SmallInt,+req.params.id).query('DELETE FROM tblPaymentTerms WHERE PaymentTermID=@ID');
    audit.logAction(req,{actionType:'DELETE',entityType:'PAYMENT_TERM',entityId:+req.params.id,oldValue:old.recordset[0],severity:'WARN'});
    ok(res,{deleted:true});
  } catch(e) { fail(res,e.message); }
});

// ─────────────────────────────────────────────────────────────────────────────
// TERMS OF SALE (Incoterms)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/terms-of-sale', async (req, res) => {
  try {
    const r = await (await getPool()).request().query(
      `SELECT TOS_ID,TOS_Desc,TOS_IsActive,TOS_Order,TOS_Remarks FROM tblTermsOfSale ORDER BY TOS_Order`
    );
    ok(res, r.recordset);
  } catch(e) { fail(res, e.message); }
});
router.post('/terms-of-sale', async (req, res) => {
  try {
    const {desc,sortOrder,remarks} = req.body;
    const r = await (await getPool()).request()
      .input('D',sql.NVarChar(50),desc).input('O',sql.Int,+sortOrder||0)
      .input('R',sql.NVarChar(250),remarks||'')
      .query(`INSERT INTO tblTermsOfSale(TOS_Desc,TOS_IsActive,TOS_Order,TOS_Remarks) VALUES(@D,1,@O,@R); SELECT SCOPE_IDENTITY() AS id`);
    audit.logAction(req,{actionType:'CREATE',entityType:'TERMS_OF_SALE',entityName:desc,newValue:req.body});
    ok(res,{id:r.recordset[0].id});
  } catch(e) { fail(res,e.message); }
});
router.put('/terms-of-sale/:id', async (req, res) => {
  try {
    const {desc,sortOrder,remarks,isActive} = req.body;
    await (await getPool()).request()
      .input('ID',sql.Int,+req.params.id)
      .input('D',sql.NVarChar(50),desc).input('O',sql.Int,+sortOrder||0)
      .input('R',sql.NVarChar(250),remarks||'').input('A',sql.Bit,isActive?1:0)
      .query(`UPDATE tblTermsOfSale SET TOS_Desc=@D,TOS_IsActive=@A,TOS_Order=@O,TOS_Remarks=@R WHERE TOS_ID=@ID`);
    audit.logAction(req,{actionType:'UPDATE',entityType:'TERMS_OF_SALE',entityId:+req.params.id,newValue:req.body});
    ok(res,{updated:true});
  } catch(e) { fail(res,e.message); }
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTAINER TYPES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/container-types', async (req, res) => {
  try {
    const r = await (await getPool()).request().query(
      `SELECT COT_ID,COT_ContainerTypeDesc,COT_Order,COT_IsActive FROM tblContainerTypes ORDER BY COT_Order`
    );
    ok(res, r.recordset);
  } catch(e) { fail(res, e.message); }
});
router.post('/container-types', async (req, res) => {
  try {
    const {desc,sortOrder} = req.body;
    const r = await (await getPool()).request()
      .input('D',sql.NVarChar(50),desc).input('O',sql.Int,+sortOrder||0)
      .query(`INSERT INTO tblContainerTypes(COT_ContainerTypeDesc,COT_Order,COT_IsActive) VALUES(@D,@O,1); SELECT SCOPE_IDENTITY() AS id`);
    audit.logAction(req,{actionType:'CREATE',entityType:'CONTAINER_TYPE',entityName:desc,newValue:req.body});
    ok(res,{id:r.recordset[0].id});
  } catch(e) { fail(res,e.message); }
});
router.put('/container-types/:id', async (req, res) => {
  try {
    const {desc,sortOrder,isActive} = req.body;
    await (await getPool()).request()
      .input('ID',sql.Int,+req.params.id)
      .input('D',sql.NVarChar(50),desc).input('O',sql.Int,+sortOrder||0).input('A',sql.Bit,isActive?1:0)
      .query(`UPDATE tblContainerTypes SET COT_ContainerTypeDesc=@D,COT_Order=@O,COT_IsActive=@A WHERE COT_ID=@ID`);
    audit.logAction(req,{actionType:'UPDATE',entityType:'CONTAINER_TYPE',entityId:+req.params.id,newValue:req.body});
    ok(res,{updated:true});
  } catch(e) { fail(res,e.message); }
});

// ─────────────────────────────────────────────────────────────────────────────
// WAREHOUSES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/warehouses', async (req, res) => {
  try {
    const r = await (await getPool()).request().query(
      `SELECT WHL_ID,WHL_WareHouseDesc,WHL_Location,WHL_Details,WHL_Order,WHL_IsActive FROM tblWareHouseList ORDER BY WHL_Order`
    );
    ok(res, r.recordset);
  } catch(e) { fail(res, e.message); }
});
router.post('/warehouses', async (req, res) => {
  try {
    const {name,location,details,sortOrder} = req.body;
    const r = await (await getPool()).request()
      .input('N',sql.NVarChar(50),name).input('L',sql.NVarChar(50),location||'')
      .input('D',sql.NVarChar(100),details||'').input('O',sql.Int,+sortOrder||0)
      .query(`INSERT INTO tblWareHouseList(WHL_WareHouseDesc,WHL_Location,WHL_Details,WHL_Order,WHL_IsActive) VALUES(@N,@L,@D,@O,1); SELECT SCOPE_IDENTITY() AS id`);
    audit.logAction(req,{actionType:'CREATE',entityType:'WAREHOUSE',entityName:name,newValue:req.body});
    ok(res,{id:r.recordset[0].id});
  } catch(e) { fail(res,e.message); }
});
router.put('/warehouses/:id', async (req, res) => {
  try {
    const {name,location,details,sortOrder,isActive} = req.body;
    await (await getPool()).request()
      .input('ID',sql.Int,+req.params.id)
      .input('N',sql.NVarChar(50),name).input('L',sql.NVarChar(50),location||'')
      .input('D',sql.NVarChar(100),details||'').input('O',sql.Int,+sortOrder||0).input('A',sql.Bit,isActive?1:0)
      .query(`UPDATE tblWareHouseList SET WHL_WareHouseDesc=@N,WHL_Location=@L,WHL_Details=@D,WHL_Order=@O,WHL_IsActive=@A WHERE WHL_ID=@ID`);
    audit.logAction(req,{actionType:'UPDATE',entityType:'WAREHOUSE',entityId:+req.params.id,newValue:req.body});
    ok(res,{updated:true});
  } catch(e) { fail(res,e.message); }
});

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT PROCESS STATUS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/import-status', async (req, res) => {
  try {
    const r = await (await getPool()).request().query(
      `SELECT IPS_ID,IPS_Status,IPS_TotalDataToFillIn,IPS_isActive FROM tblImportProcessStatus ORDER BY IPS_ID`
    );
    ok(res, r.recordset);
  } catch(e) { fail(res, e.message); }
});
router.post('/import-status', async (req, res) => {
  try {
    const {status,totalData} = req.body;
    const pool = await getPool();
    const maxR = await pool.request().query(`SELECT ISNULL(MAX(IPS_ID),0)+1 AS nextId FROM tblImportProcessStatus`);
    const nextId = maxR.recordset[0].nextId;
    await pool.request()
      .input('ID',sql.Int,nextId).input('S',sql.VarChar(100),status).input('T',sql.Float,+totalData||0)
      .query(`INSERT INTO tblImportProcessStatus(IPS_ID,IPS_Status,IPS_TotalDataToFillIn,IPS_isActive) VALUES(@ID,@S,@T,1)`);
    audit.logAction(req,{actionType:'CREATE',entityType:'IMPORT_STATUS',entityName:status,newValue:req.body});
    ok(res,{id:nextId});
  } catch(e) { fail(res,e.message); }
});
router.put('/import-status/:id', async (req, res) => {
  try {
    const {status,totalData,isActive} = req.body;
    await (await getPool()).request()
      .input('ID',sql.Int,+req.params.id)
      .input('S',sql.NVarChar(100),status).input('T',sql.Float,+totalData||0).input('A',sql.Bit,isActive?1:0)
      .query(`UPDATE tblImportProcessStatus SET IPS_Status=@S,IPS_TotalDataToFillIn=@T,IPS_isActive=@A WHERE IPS_ID=@ID`);
    audit.logAction(req,{actionType:'UPDATE',entityType:'IMPORT_STATUS',entityId:+req.params.id,newValue:req.body});
    ok(res,{updated:true});
  } catch(e) { fail(res,e.message); }
});

// ─────────────────────────────────────────────────────────────────────────────
// ORDER TYPES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/order-types', async (req, res) => {
  try {
    const r = await (await getPool()).request().query(
      `SELECT OT_ID,OT_OrderTypeDesc,OT_ExtendedExplanation,OT_IsActive,RTRIM(OT_OrderTypeDescEng) AS OT_OrderTypeDescEng FROM tblOrderType ORDER BY OT_ID`
    );
    ok(res, r.recordset);
  } catch(e) { fail(res, e.message); }
});
router.post('/order-types', async (req, res) => {
  try {
    const {descHE,descEN,explanation} = req.body;
    const r = await (await getPool()).request()
      .input('H',sql.NVarChar(50),descHE).input('E',sql.NChar(50),descEN||'')
      .input('X',sql.NVarChar(150),explanation||'')
      .query(`INSERT INTO tblOrderType(OT_OrderTypeDesc,OT_OrderTypeDescEng,OT_ExtendedExplanation,OT_IsActive) VALUES(@H,@E,@X,1); SELECT SCOPE_IDENTITY() AS id`);
    audit.logAction(req,{actionType:'CREATE',entityType:'ORDER_TYPE',entityName:descHE,newValue:req.body});
    ok(res,{id:r.recordset[0].id});
  } catch(e) { fail(res,e.message); }
});
router.put('/order-types/:id', async (req, res) => {
  try {
    const {descHE,descEN,explanation,isActive} = req.body;
    await (await getPool()).request()
      .input('ID',sql.Int,+req.params.id)
      .input('H',sql.NVarChar(50),descHE).input('E',sql.NChar(50),descEN||'')
      .input('X',sql.NVarChar(150),explanation||'').input('A',sql.Bit,isActive?1:0)
      .query(`UPDATE tblOrderType SET OT_OrderTypeDesc=@H,OT_OrderTypeDescEng=@E,OT_ExtendedExplanation=@X,OT_IsActive=@A WHERE OT_ID=@ID`);
    audit.logAction(req,{actionType:'UPDATE',entityType:'ORDER_TYPE',entityId:+req.params.id,newValue:req.body});
    ok(res,{updated:true});
  } catch(e) { fail(res,e.message); }
});

// ─────────────────────────────────────────────────────────────────────────────
// SALES PERSONS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/sales-persons', async (req, res) => {
  try {
    const r = await (await getPool()).request().query(
      `SELECT SalesPersonID,NameHE,NameEN,RoleCode,IsActive FROM tblSalesPersons ORDER BY NameHE`
    );
    ok(res, r.recordset);
  } catch(e) { fail(res, e.message); }
});
router.post('/sales-persons', async (req, res) => {
  try {
    const {nameHE,nameEN,roleCode} = req.body;
    const r = await (await getPool()).request()
      .input('H',sql.NVarChar(40),nameHE).input('E',sql.NVarChar(40),nameEN||'')
      .input('R',sql.Char(1),roleCode||'ע')
      .query(`INSERT INTO tblSalesPersons(NameHE,NameEN,RoleCode,IsActive) VALUES(@H,@E,@R,1); SELECT SCOPE_IDENTITY() AS id`);
    audit.logAction(req,{actionType:'CREATE',entityType:'SALES_PERSON',entityName:nameHE,newValue:req.body});
    ok(res,{id:r.recordset[0].id});
  } catch(e) { fail(res,e.message); }
});
router.put('/sales-persons/:id', async (req, res) => {
  try {
    const {nameHE,nameEN,roleCode,isActive} = req.body;
    await (await getPool()).request()
      .input('ID',sql.SmallInt,+req.params.id)
      .input('H',sql.NVarChar(40),nameHE).input('E',sql.NVarChar(40),nameEN||'')
      .input('R',sql.Char(1),roleCode||'ע').input('A',sql.Bit,isActive?1:0)
      .query(`UPDATE tblSalesPersons SET NameHE=@H,NameEN=@E,RoleCode=@R,IsActive=@A WHERE SalesPersonID=@ID`);
    audit.logAction(req,{actionType:'UPDATE',entityType:'SALES_PERSON',entityId:+req.params.id,newValue:req.body});
    ok(res,{updated:true});
  } catch(e) { fail(res,e.message); }
});

// ─────────────────────────────────────────────────────────────────────────────
// CITIES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/cities', async (req, res) => {
  try {
    const r = await (await getPool()).request().query(`
      SELECT ci.CityID, ci.CountryID, c.NameHE AS CountryNameHE, ci.NameHE, ci.NameEN, ci.PostalCode, ci.IsActive
      FROM tblCities ci JOIN tblCountries c ON c.CountryID=ci.CountryID
      ORDER BY ci.NameHE
    `);
    ok(res, r.recordset);
  } catch(e) { fail(res, e.message); }
});
router.post('/cities', async (req, res) => {
  try {
    const {countryId,nameHE,nameEN,postalCode} = req.body;
    const r = await (await getPool()).request()
      .input('C',sql.Int,+countryId).input('H',sql.NVarChar(80),nameHE)
      .input('E',sql.NVarChar(80),nameEN||'').input('P',sql.NVarChar(20),postalCode||'')
      .query(`INSERT INTO tblCities(CountryID,NameHE,NameEN,PostalCode,IsActive) VALUES(@C,@H,@E,@P,1); SELECT SCOPE_IDENTITY() AS id`);
    audit.logAction(req,{actionType:'CREATE',entityType:'CITY',entityName:nameHE,newValue:req.body});
    ok(res,{id:r.recordset[0].id});
  } catch(e) { fail(res,e.message); }
});
router.put('/cities/:id', async (req, res) => {
  try {
    const {countryId,nameHE,nameEN,postalCode,isActive} = req.body;
    await (await getPool()).request()
      .input('ID',sql.Int,+req.params.id)
      .input('C',sql.Int,+countryId).input('H',sql.NVarChar(80),nameHE)
      .input('E',sql.NVarChar(80),nameEN||'').input('P',sql.NVarChar(20),postalCode||'').input('A',sql.Bit,isActive?1:0)
      .query(`UPDATE tblCities SET CountryID=@C,NameHE=@H,NameEN=@E,PostalCode=@P,IsActive=@A WHERE CityID=@ID`);
    audit.logAction(req,{actionType:'UPDATE',entityType:'CITY',entityId:+req.params.id,newValue:req.body});
    ok(res,{updated:true});
  } catch(e) { fail(res,e.message); }
});

// ─────────────────────────────────────────────────────────────────────────────
// KOSHER TYPES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/kosher-types', async (req, res) => {
  try {
    const r = await (await getPool()).request().query(
      `SELECT TOK_ID,TOK_TypeOfKosherDesc,RTRIM(TOK_TypeOfKosherDescEng) AS TOK_TypeOfKosherDescEng,TOK_Order,TOK_KosherForTheDaysOfTheYear,TOK_KosherForPassover,TOK_IsActive FROM tblTypesOfKosher ORDER BY TOK_Order`
    );
    ok(res, r.recordset);
  } catch(e) { fail(res, e.message); }
});
router.post('/kosher-types', async (req, res) => {
  try {
    const {descHE,descEN,sortOrder,forYear,forPassover} = req.body;
    const r = await (await getPool()).request()
      .input('H',sql.NVarChar(100),descHE).input('E',sql.NChar(100),descEN||'')
      .input('O',sql.Int,+sortOrder||0).input('Y',sql.Bit,forYear?1:0).input('P',sql.Bit,forPassover?1:0)
      .query(`INSERT INTO tblTypesOfKosher(TOK_TypeOfKosherDesc,TOK_TypeOfKosherDescEng,TOK_Order,TOK_KosherForTheDaysOfTheYear,TOK_KosherForPassover,TOK_IsActive) VALUES(@H,@E,@O,@Y,@P,1); SELECT SCOPE_IDENTITY() AS id`);
    audit.logAction(req,{actionType:'CREATE',entityType:'KOSHER_TYPE',entityName:descHE,newValue:req.body});
    ok(res,{id:r.recordset[0].id});
  } catch(e) { fail(res,e.message); }
});
router.put('/kosher-types/:id', async (req, res) => {
  try {
    const {descHE,descEN,sortOrder,forYear,forPassover,isActive} = req.body;
    await (await getPool()).request()
      .input('ID',sql.Int,+req.params.id)
      .input('H',sql.NVarChar(100),descHE).input('E',sql.NChar(100),descEN||'')
      .input('O',sql.Int,+sortOrder||0).input('Y',sql.Bit,forYear?1:0)
      .input('P',sql.Bit,forPassover?1:0).input('A',sql.Bit,isActive?1:0)
      .query(`UPDATE tblTypesOfKosher SET TOK_TypeOfKosherDesc=@H,TOK_TypeOfKosherDescEng=@E,TOK_Order=@O,TOK_KosherForTheDaysOfTheYear=@Y,TOK_KosherForPassover=@P,TOK_IsActive=@A WHERE TOK_ID=@ID`);
    audit.logAction(req,{actionType:'UPDATE',entityType:'KOSHER_TYPE',entityId:+req.params.id,newValue:req.body});
    ok(res,{updated:true});
  } catch(e) { fail(res,e.message); }
});

// ─────────────────────────────────────────────────────────────────────────────
// ITEM CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/item-categories', async (req, res) => {
  try {
    const r = await (await getPool()).request().query(
      `SELECT ic.CategoryID,ic.SupplierID,s.ShortNameHE AS SupplierName,ic.LevelNo,ic.LevelName,ic.CategoryCode,ic.CategoryName,ic.IsActive
       FROM tblItemCategories ic LEFT JOIN tblSuppliers s ON s.SupplierID=ic.SupplierID ORDER BY ic.CategoryName`
    );
    ok(res, r.recordset);
  } catch(e) { fail(res, e.message); }
});
router.put('/item-categories/:id', async (req, res) => {
  try {
    const {categoryName,levelName,isActive} = req.body;
    await (await getPool()).request()
      .input('ID',sql.Int,+req.params.id)
      .input('N',sql.NVarChar(80),categoryName).input('L',sql.NVarChar(40),levelName||'')
      .input('A',sql.Bit,isActive?1:0)
      .query(`UPDATE tblItemCategories SET CategoryName=@N,LevelName=@L,IsActive=@A WHERE CategoryID=@ID`);
    audit.logAction(req,{actionType:'UPDATE',entityType:'ITEM_CATEGORY',entityId:+req.params.id,newValue:req.body});
    ok(res,{updated:true});
  } catch(e) { fail(res,e.message); }
});

module.exports = router;
