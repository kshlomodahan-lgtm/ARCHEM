const express     = require('express');
const router      = express.Router();
const { sql, getPool } = require('../db');
const requireAuth = require('../middleware/auth');
const audit       = require('../helpers/sfAuditLogger');

async function resolveSKU(pool, supplierId, supplierSKU, customerId, customerSKU, desc) {
  const r = pool.request();
  r.input('SupplierID',      sql.Int,          supplierId);
  r.input('InSupplierSKU',   sql.NVarChar(50),  supplierSKU  || null);
  r.input('CustomerID',      sql.Int,          customerId);
  r.input('InCustomerSKU',   sql.NVarChar(50),  customerSKU  || null);
  r.input('CustomerSKUDesc', sql.NVarChar(200), desc         || null);
  r.output('ItemLinkID',       sql.BigInt);
  r.output('FinalSupplierSKU', sql.NVarChar(50));
  r.output('FinalCustomerSKU', sql.NVarChar(50));
  r.output('WasTempSKU',       sql.Bit);
  r.output('ResultCode',       sql.Int);
  r.output('ResultMessage',    sql.NVarChar(200));
  const res = await r.execute('sp_OrderLine_ResolveSKU');
  if (res.output.ResultCode !== 0) throw new Error(res.output.ResultMessage);
  return {
    itemLinkId:      res.output.ItemLinkID,
    finalSupplierSKU: res.output.FinalSupplierSKU,
    finalCustomerSKU: res.output.FinalCustomerSKU,
    wasTempSKU:      !!res.output.WasTempSKU,
  };
}

function mapCommType(c) {
  if (!c) return 'NONE';
  const v = String(c).trim();
  if (v === 'א') return 'PCT';
  if (v === 'ק') return 'FIXED';
  if (v === 'מ') return 'PER_PRICE';
  return 'NONE';
}

function reverseCommType(t) {
  if (t === 'PCT')       return 'א';
  if (t === 'FIXED')     return 'ק';
  if (t === 'PER_PRICE') return 'מ';
  return null;
}

function mapStatus(row) {
  if (!row.IsActive)       return 'inactive';
  if (row.IsCancelled)     return 'cancelled';
  if (row.IsFrozen)        return 'frozen';
  if (row.IsImportant)     return 'important';
  if (row.IsFrameContract) return 'frame';
  return 'active';
}

function mapOrderRow(row) {
  return {
    orderId:               row.OrderID,
    orderNumber:           row.OrderNumber,
    orderYear:             row.OrderYear,
    companyId:             row.CompanyID,
    companyName:           row.CompanyName || '',
    groupNo:               row.GroupNo,
    supplierID:            row.SupplierID,
    supplierShort:         row.SupplierShort || '',
    supplierFull:          row.SupplierFull  || '',
    customerID:            row.CustomerID,
    customerShort:         row.CustomerShort || '',
    customerFull:          row.CustomerFull  || '',
    customerRef:           row.CustomerRef   || '',
    orderDate:             row.OrderDate,
    currency:              row.CurrencySymbol || '',
    currencyCode:          row.CurrencyCode   || '',
    currencyId:            row.CurrencyID,
    totalValue:            Number(row.TotalValue)       || 0,
    commissionAmount:      Number(row.TotalCommission)  || 0,
    commissionReceived:    !!row.CommissionReceived,
    commissionAmtReceived: Number(row.CommissionAmtReceived) || 0,
    commissionType:        mapCommType(row.CommissionType),
    commissionPct:         Number(row.CommissionPct) || 0,
    status:                mapStatus(row),
    isFrameContract:       !!row.IsFrameContract,
    isImportant:           !!row.IsImportant,
    isFrozen:              !!row.IsFrozen,
    isCancelled:           !!row.IsCancelled,
    isActive:              row.IsActive !== false && row.IsActive !== 0,
    salesDomainId:         row.SalesDomainID   || null,
    salesDomainName:       row.SalesDomainName || '',
    salesDomainPrefix:     row.SalesDomainPrefix || '',
    editorId:              row.EditorID        || null,
    editorName:            row.EditorName      || '',
    paymentTermsId:        row.PaymentTermsID  || null,
    paymentTermsDesc:      row.PaymentTermsDesc || '',
    creditDays:            row.CreditDays      || null,
    incotermsId:           row.IncotermsID     || null,
    incotermsDesc:         row.IncotermsDesc   || '',
    supplierContactName:   row.SupplierContactName || '',
    deliveryDate:          row.EarliestDelivery || null,
    eta:                   row.ETA  || null,
    ata:                   row.ATA  || null,
    lineCount:             row.LineCount || 0,
    lines: [], financial: null, shipment: null,
  };
}

// ── META ─────────────────────────────────────────────────────────────────────

router.get('/meta/suppliers', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT SupplierID,
        COALESCE(NULLIF(RTRIM(ShortNameHE),''), NULLIF(RTRIM(ShortNameEN),''),
                 NULLIF(RTRIM(FullNameHE),''),  NULLIF(RTRIM(FullNameEN),''),
                 CAST(SupplierID AS NVARCHAR)) AS Name,
        COALESCE(NULLIF(RTRIM(FullNameHE),''), NULLIF(RTRIM(FullNameEN),'')) AS FullName,
        NULLIF(RTRIM(ISNULL(VATNumber,'')), '') AS VATNumber
      FROM tblSuppliers
      WHERE IsActive=1
      ORDER BY
        CASE WHEN COALESCE(NULLIF(RTRIM(ShortNameHE),''),NULLIF(RTRIM(ShortNameEN),''),
                           NULLIF(RTRIM(FullNameHE),''),NULLIF(RTRIM(FullNameEN),'')) IS NULL THEN 1 ELSE 0 END,
        Name
    `);
    res.json({ success: true, data: r.recordset, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

router.get('/meta/customers', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT CustomerID,
        COALESCE(NULLIF(RTRIM(ShortNameHE),''), NULLIF(RTRIM(ShortNameEN),''),
                 NULLIF(RTRIM(FullNameHE),''),  NULLIF(RTRIM(FullNameEN),''),
                 CAST(CustomerID AS NVARCHAR)) AS Name,
        COALESCE(NULLIF(RTRIM(FullNameHE),''), NULLIF(RTRIM(FullNameEN),'')) AS FullName,
        NULLIF(RTRIM(ISNULL(CompanyRegNo,'')), '') AS CompanyRegNo
      FROM tblCustomers
      WHERE IsActive=1
      ORDER BY
        CASE WHEN COALESCE(NULLIF(RTRIM(ShortNameHE),''),NULLIF(RTRIM(ShortNameEN),''),
                           NULLIF(RTRIM(FullNameHE),''),NULLIF(RTRIM(FullNameEN),'')) IS NULL THEN 1 ELSE 0 END,
        Name
    `);
    res.json({ success: true, data: r.recordset, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

router.get('/meta/companies', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT CompanyID, ISNULL(NameHE, NameEN) AS Name FROM tblCompanies WHERE IsActive=1 ORDER BY CompanyID`
    );
    res.json({ success: true, data: r.recordset, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

router.get('/meta/currencies', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT CurrencyID, CurrencyCode, CurrencySymbol AS Symbol,
         ISNULL(CurrencyName, CurrencyCode) AS Name
       FROM tblCurrencies WHERE IsActive=1 ORDER BY CurrencyID`
    );
    res.json({ success: true, data: r.recordset, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

router.get('/meta/sales-domains', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT SalesDomainID, DomainName, ISNULL(DomainPrefix,'') AS DomainPrefix
       FROM tblSalesDomains WHERE IsActive=1 ORDER BY DomainName`
    );
    res.json({ success: true, data: r.recordset, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

router.get('/meta/editors', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT SalesPersonID, NameHE, NameEN FROM tblSalesPersons WHERE IsActive=1 ORDER BY NameHE`
    );
    res.json({ success: true, data: r.recordset, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

router.get('/meta/payment-terms', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT PaymentTermID, Description1, CreditDays FROM tblPaymentTerms ORDER BY PaymentTermID`
    );
    res.json({ success: true, data: r.recordset, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

router.get('/meta/incoterms', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT TOS_ID, TOS_Desc FROM tblTermsOfSale WHERE TOS_IsActive=1 ORDER BY TOS_Order`
    );
    res.json({ success: true, data: r.recordset, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

router.get('/meta/next-order-number', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const year      = parseInt(req.query.year)      || new Date().getFullYear();
    const companyId = parseInt(req.query.companyId) || null;
    const req2 = pool.request().input('Year', sql.SmallInt, year);
    if (companyId) req2.input('CompanyID', sql.Int, companyId);
    const r = await req2.query(
      `SELECT ISNULL(MAX(OrderNumber),0)+1 AS NextNo FROM tblOrders
       WHERE OrderYear=@Year ${companyId ? 'AND CompanyID=@CompanyID' : ''}`
    );
    res.json({ success: true, data: { nextNo: r.recordset[0].NextNo }, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

// ── Contact suggestions (historical) ─────────────────────────────────────────

router.get('/meta/supplier-contacts', requireAuth, async (req, res) => {
  try {
    const supplierId = parseInt(req.query.supplierId);
    if (!supplierId) return res.json({ success: true, data: [], message: '' });
    const pool = await getPool();
    const r = await pool.request()
      .input('SupplierId', sql.Int, supplierId)
      .query(`SELECT DISTINCT SupplierContactName AS name FROM tblOrders
              WHERE SupplierID=@SupplierId AND SupplierContactName IS NOT NULL AND SupplierContactName!=''
              ORDER BY name`);
    res.json({ success: true, data: r.recordset.map(x => x.name), message: '' });
  } catch (err) { res.status(500).json({ success: false, data: [], message: err.message }); }
});

router.get('/meta/customer-contacts', requireAuth, async (req, res) => {
  try {
    const customerId = parseInt(req.query.customerId);
    if (!customerId) return res.json({ success: true, data: [], message: '' });
    const pool = await getPool();
    const r = await pool.request()
      .input('CustomerId', sql.Int, customerId)
      .query(`SELECT DISTINCT CustomerContactName AS name FROM tblOrders
              WHERE CustomerID=@CustomerId AND CustomerContactName IS NOT NULL AND CustomerContactName!=''
              ORDER BY name`);
    res.json({ success: true, data: r.recordset.map(x => x.name), message: '' });
  } catch (err) { res.status(500).json({ success: false, data: [], message: err.message }); }
});

// ── GET LIST — sp_Orders_GetList ──────────────────────────────────────────────

router.get('/', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const {
      year, fromDate, toDate, companyId, supplierId, customerId,
      showFrozen, showCancelled, showImportant, showFrame,
      salesDomainId, search,
    } = req.query;

    const r = pool.request();
    r.output('ResultCode',    sql.Int);
    r.output('ResultMessage', sql.NVarChar(200));

    if (year && year !== 'all') r.input('Year', sql.SmallInt, parseInt(year));
    if (fromDate)   r.input('FromDate',   sql.Date, new Date(fromDate));
    if (toDate)     r.input('ToDate',     sql.Date, new Date(toDate));
    if (companyId)  r.input('CompanyID',  sql.Int, parseInt(companyId));
    if (supplierId) r.input('SupplierID', sql.Int, parseInt(supplierId));
    if (customerId) r.input('CustomerID', sql.Int, parseInt(customerId));
    if (salesDomainId) r.input('SalesDomainID', sql.Int, parseInt(salesDomainId));
    r.input('ShowFrozen',    sql.TinyInt, showFrozen    !== undefined ? parseInt(showFrozen)    : 2);
    r.input('ShowCancelled', sql.TinyInt, showCancelled !== undefined ? parseInt(showCancelled) : 2);
    r.input('ShowImportant', sql.TinyInt, showImportant !== undefined ? parseInt(showImportant) : 2);
    r.input('ShowFrame',     sql.TinyInt, showFrame     !== undefined ? parseInt(showFrame)     : 2);
    if (search) r.input('Search', sql.NVarChar(100), `%${search}%`);

    const result = await r.execute('sp_Orders_GetList');

    if (result.output.ResultCode !== 0) {
      return res.status(500).json({ success: false, data: null, message: result.output.ResultMessage });
    }

    res.json({ success: true, data: result.recordset.map(mapOrderRow), message: '' });
  } catch (err) {
    console.error('GET /api/orders', err.message);
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

// ── GET SINGLE — sp_Orders_GetById ───────────────────────────────────────────

router.get('/:orderId', requireAuth, async (req, res) => {
  try {
    const pool    = await getPool();
    const orderId = parseInt(req.params.orderId);
    if (!orderId) return res.status(400).json({ success: false, message: 'מזהה הזמנה לא תקין' });

    const r = pool.request();
    r.input('OrderID', sql.BigInt, orderId);
    r.output('ResultCode',    sql.Int);
    r.output('ResultMessage', sql.NVarChar(200));

    const result = await r.execute('sp_Orders_GetById');

    if (result.output.ResultCode !== 0)
      return res.status(500).json({ success: false, message: result.output.ResultMessage });

    const records = result.recordsets;
    if (!records[0] || !records[0].length)
      return res.status(404).json({ success: false, message: 'הזמנה לא נמצאה' });

    const h = records[0][0];
    const lines = (records[1] || []).map(l => ({
      orderLineId:     l.OrderLineID,
      lineNo:          l.LineNo,
      groupNo:         l.GroupNo,
      supplierSKU:     l.SupplierSKU || '',
      customerSKU:     l.CustomerSKU || '',
      description:     l.Description || '',
      qtyOrdered:      Number(l.QtyOrdered)   || 0,
      qtyDispatched:   Math.max(0, (Number(l.QtyOrdered) || 0) - (Number(l.QtyRemaining) || 0)),
      price:           Number(l.Price)         || 0,
      uom:             l.UOM || '',
      currencyId:      l.CurrencyID,
      currency:        l.CurrencySymbol || '',
      discountPct:     Number(l.DiscountPct)   || 0,
      lineValue:       Number(l.LineValue)     || 0,
      deliveryDate:    l.DeliveryDate,
      commissionType:  mapCommType(l.CommissionType),
      commissionPct:   Number(l.CommissionPct)   || 0,
      commissionFixed: Number(l.CommissionFixed) || 0,
      commissionAmount: 0,
      isFrameContract: !!l.IsFrameContract,
      itemLinkId:      l.ItemLinkID,
    }));

    const domCommType = lines.find(l => l.commissionType !== 'NONE')?.commissionType ?? 'NONE';
    const avgCommPct  = lines.filter(l => l.commissionPct > 0)
      .reduce((s, l, _, a) => s + l.commissionPct / a.length, 0);

    const order = {
      ...mapOrderRow({ ...h, TotalCommission: h.TotalCommission, EarliestDelivery: null, CommissionType: null, CommissionPct: null, LineCount: lines.length }),
      commissionType: domCommType,
      commissionPct:  avgCommPct,
      lineCount:      lines.length,
      lines,
      shipment: {
        supplierOC:            h.SupplierOC || '',
        supplierOCDate:        h.SupplierOCDate,
        desiredDeliveryDate:   h.DesiredDeliveryDate,
        updatedDeliveryDate:   h.UpdatedDeliveryDate,
        handoverToShipperDate: h.HandoverToShipperDate,
        goodsLeftFactoryDate:  h.GoodsLeftFactoryDate,
        blNumber:              h.BLNumber || '',
        vesselName:            h.VesselName || '',
        etd:                   h.ETD,
        eta:                   h.ETA,
        ata:                   h.ATA,
        transportMode:         h.TransportMode || null,
        hasDocuments:          !!h.HasDocuments,
        paymentStatusId:       h.PaymentStatusID,
      },
      financial: {
        supplierInvoiceNo:        h.SupplierInvoiceNo || '',
        supplierInvoiceDate:      h.SupplierInvoiceDate,
        invoiceAmount:            Number(h.InvoiceAmount) || 0,
        customerPaid:             !!h.CustomerPaid,
        amountPaidByCustomer:     Number(h.AmountPaidByCustomer) || 0,
        commissionReceived:       !!h.CommissionReceived,
        commissionAmountReceived: Number(h.CommissionAmtReceived) || 0,
        invoiceIssuedToSupplier:  !!h.InvoiceIssuedToSupplier,
        currency:                 h.CurrencySymbol || '',
      },
      deliveryDate: lines.reduce((min, l) => {
        if (!l.deliveryDate) return min;
        if (!min) return l.deliveryDate;
        return l.deliveryDate < min ? l.deliveryDate : min;
      }, null),
    };

    res.json({ success: true, data: order, message: '' });
  } catch (err) {
    console.error('GET /api/orders/:id', err.message);
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

// ── CREATE — sp_Orders_Create ─────────────────────────────────────────────────

router.post('/', requireAuth, async (req, res) => {
  const { header, lines } = req.body;
  if (!header || !header.supplierId || !header.customerId)
    return res.status(400).json({ success: false, message: 'ספק ולקוח הם שדות חובה' });

  try {
    const pool = await getPool();

    // 1. Create header via SP
    const r = pool.request();
    r.input('CompanyID',          sql.Int,           header.companyId   || null);
    r.input('OrderYear',          sql.SmallInt,      header.orderYear   || new Date().getFullYear());
    r.input('OrderNumber',        sql.Int,           header.orderNumber || null);
    r.input('GroupNo',            sql.NVarChar(10),  header.groupNo     || null);
    r.input('SupplierID',         sql.Int,           header.supplierId);
    r.input('CustomerID',         sql.Int,           header.customerId);
    r.input('OrderDate',          sql.DateTime,      header.orderDate ? new Date(header.orderDate) : new Date());
    r.input('CustomerRef',        sql.NVarChar(50),  header.customerRef || null);
    r.input('CurrencyID',         sql.Int,           header.currencyId  || 1);
    r.input('SalesDomainID',      sql.Int,           header.salesDomainId || null);
    r.input('EditorID',           sql.Int,           header.editorId || null);
    r.input('PaymentTermsID',     sql.Int,           header.paymentTermsId || null);
    r.input('IncotermsID',        sql.Int,           header.incotermsId || null);
    r.input('SupplierContactName',sql.NVarChar(100), header.supplierContactName || null);
    r.input('IsFrameContract',    sql.Bit,           header.isFrameContract ? 1 : 0);
    r.input('IsImportant',        sql.Bit,           header.isImportant ? 1 : 0);
    r.input('TotalValue',         sql.Decimal(18,2), header.totalValue  || 0);
    r.input('SupplierOC',         sql.NVarChar(50),  header.supplierOC || null);
    r.input('SupplierOCDate',     sql.DateTime,      header.supplierOCDate       ? new Date(header.supplierOCDate) : null);
    r.input('DesiredDeliveryDate',sql.DateTime,      header.desiredDeliveryDate  ? new Date(header.desiredDeliveryDate) : null);
    r.input('ETD',                sql.DateTime,      header.etd ? new Date(header.etd) : null);
    r.input('ETA',                sql.DateTime,      header.eta ? new Date(header.eta) : null);
    r.input('ATA',                sql.DateTime,      header.ata ? new Date(header.ata) : null);
    r.input('VesselName',         sql.NVarChar(100), header.vesselName   || null);
    r.input('BLNumber',           sql.NVarChar(50),  header.blNumber     || null);
    r.input('TransportMode',      sql.Char(1),       header.transportMode || null);
    r.input('SupplierInvoiceNo',  sql.NVarChar(50),  header.supplierInvoiceNo   || null);
    r.input('SupplierInvoiceDate',sql.DateTime,      header.supplierInvoiceDate  ? new Date(header.supplierInvoiceDate) : null);
    r.input('InvoiceAmount',      sql.Decimal(18,2), header.invoiceAmount || 0);
    r.input('CustomerPaid',       sql.Bit,           header.customerPaid ? 1 : 0);
    r.input('AmountPaidByCustomer',sql.Decimal(18,2),header.amountPaidByCustomer || 0);
    r.input('InvoiceIssuedToSupplier',sql.Bit,       header.invoiceIssuedToSupplier ? 1 : 0);
    r.output('NewOrderID',    sql.BigInt);
    r.output('ResultCode',    sql.Int);
    r.output('ResultMessage', sql.NVarChar(200));

    const result = await r.execute('sp_Orders_Create');
    if (result.output.ResultCode !== 0)
      return res.status(500).json({ success: false, message: result.output.ResultMessage });

    const newOrderId = result.output.NewOrderID;

    // 2. Insert lines via SP
    if (lines && lines.length > 0) {
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];

        // Resolve SKU — generates temp if missing, links to existing if found
        let resolvedSKU = { itemLinkId: l.itemLinkId || null, finalSupplierSKU: l.supplierSKU, finalCustomerSKU: l.customerSKU };
        try {
          resolvedSKU = await resolveSKU(pool, header.supplierId, l.supplierSKU, header.customerId, l.customerSKU, l.description);
        } catch (skuErr) {
          console.warn(`Line ${i+1} SKU resolve failed:`, skuErr.message);
        }

        const lr = pool.request();
        lr.input('OrderID',           sql.BigInt,        newOrderId);
        lr.input('LineNo',            sql.SmallInt,      i + 1);
        lr.input('GroupNo',           sql.SmallInt,      l.groupNo || 1);
        lr.input('SupplierSKU',       sql.NVarChar(50),  resolvedSKU.finalSupplierSKU  || null);
        lr.input('CustomerSKU',       sql.NVarChar(50),  resolvedSKU.finalCustomerSKU  || null);
        lr.input('Description',       sql.NVarChar(200), l.description  || null);
        lr.input('QtyOrdered',        sql.Decimal(18,4), l.qtyOrdered   || 0);
        lr.input('Price',             sql.Decimal(18,4), l.price        || 0);
        lr.input('UOM',               sql.NVarChar(20),  l.uom          || null);
        lr.input('CurrencyID',        sql.Int,           l.currencyId   || header.currencyId || 1);
        lr.input('DiscountPct',       sql.Decimal(5,2),  l.discountPct  || 0);
        lr.input('LineValue',         sql.Decimal(18,2), l.lineValue    || 0);
        lr.input('DeliveryDate',      sql.DateTime,      l.deliveryDate ? new Date(l.deliveryDate) : null);
        lr.input('CommissionType',    sql.Char(1),       reverseCommType(l.commissionType));
        lr.input('CommissionPct',     sql.Decimal(5,2),  l.commissionPct   || 0);
        lr.input('CommissionFixed',   sql.Decimal(18,2), l.commissionFixed || 0);
        lr.input('CommissionPerPrice',sql.Decimal(18,2), l.commissionPerPrice || 0);
        lr.input('IsFrameContract',   sql.Bit,           l.isFrameContract ? 1 : 0);
        lr.input('ItemLinkID',        sql.Int,           resolvedSKU.itemLinkId || null);
        lr.output('ResultCode',       sql.Int);
        lr.output('ResultMessage',    sql.NVarChar(200));
        const lResult = await lr.execute('sp_Orders_AddLine');
        if (lResult.output.ResultCode !== 0)
          console.warn(`Line ${i+1} failed:`, lResult.output.ResultMessage);
      }

      // 3. Update totals
      const tr = pool.request();
      tr.input('OrderID', sql.BigInt, newOrderId);
      tr.output('ResultCode',    sql.Int);
      tr.output('ResultMessage', sql.NVarChar(200));
      await tr.execute('sp_Orders_UpdateTotals');
    }

    // Save CustomerContactName (not in SP)
    if (header.customerContactName) {
      await pool.request()
        .input('OrderID', sql.BigInt, newOrderId)
        .input('CustomerContactName', sql.NVarChar(100), header.customerContactName)
        .query('UPDATE tblOrders SET CustomerContactName=@CustomerContactName WHERE OrderID=@OrderID');
    }

    audit.logAction(req, { actionType:'CREATE', entityType:'ORDER', entityId:Number(newOrderId), entityName:`הזמנה ${header.orderNumber || newOrderId}`, newValue:{ supplierId:header.supplierId, customerId:header.customerId, totalValue:header.totalValue } });
    res.json({ success: true, data: { orderId: newOrderId }, message: 'הזמנה נוצרה בהצלחה' });
  } catch (err) {
    console.error('POST /api/orders', err.message);
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

// ── UPDATE — sp_Orders_Update ─────────────────────────────────────────────────

router.put('/:orderId', requireAuth, async (req, res) => {
  const orderId = parseInt(req.params.orderId);
  const { header, lines } = req.body;
  if (!orderId || !header)
    return res.status(400).json({ success: false, message: 'נתונים חסרים' });

  try {
    const pool = await getPool();

    // 1. Update header
    const r = pool.request();
    r.input('OrderID',            sql.BigInt,        orderId);
    r.input('SupplierID',         sql.Int,           header.supplierId);
    r.input('CustomerID',         sql.Int,           header.customerId);
    r.input('CompanyID',          sql.Int,           header.companyId   || null);
    r.input('OrderDate',          sql.DateTime,      header.orderDate ? new Date(header.orderDate) : null);
    r.input('CustomerRef',        sql.NVarChar(50),  header.customerRef || null);
    r.input('CurrencyID',         sql.Int,           header.currencyId  || 1);
    r.input('SalesDomainID',      sql.Int,           header.salesDomainId || null);
    r.input('EditorID',           sql.Int,           header.editorId || null);
    r.input('PaymentTermsID',     sql.Int,           header.paymentTermsId || null);
    r.input('IncotermsID',        sql.Int,           header.incotermsId || null);
    r.input('SupplierContactName',sql.NVarChar(100), header.supplierContactName || null);
    r.input('IsFrameContract',    sql.Bit,           header.isFrameContract ? 1 : 0);
    r.input('IsImportant',        sql.Bit,           header.isImportant ? 1 : 0);
    r.input('IsFrozen',           sql.Bit,           header.isFrozen   ? 1 : 0);
    r.input('IsCancelled',        sql.Bit,           header.isCancelled ? 1 : 0);
    r.input('TotalValue',         sql.Decimal(18,2), header.totalValue  || 0);
    r.input('SupplierOC',         sql.NVarChar(50),  header.supplierOC           || null);
    r.input('SupplierOCDate',     sql.DateTime,      header.supplierOCDate       ? new Date(header.supplierOCDate) : null);
    r.input('DesiredDeliveryDate',sql.DateTime,      header.desiredDeliveryDate  ? new Date(header.desiredDeliveryDate) : null);
    r.input('ETD',                sql.DateTime,      header.etd ? new Date(header.etd) : null);
    r.input('ETA',                sql.DateTime,      header.eta ? new Date(header.eta) : null);
    r.input('ATA',                sql.DateTime,      header.ata ? new Date(header.ata) : null);
    r.input('VesselName',         sql.NVarChar(100), header.vesselName   || null);
    r.input('BLNumber',           sql.NVarChar(50),  header.blNumber     || null);
    r.input('TransportMode',      sql.Char(1),       header.transportMode || null);
    r.input('SupplierInvoiceNo',  sql.NVarChar(50),  header.supplierInvoiceNo    || null);
    r.input('SupplierInvoiceDate',sql.DateTime,      header.supplierInvoiceDate  ? new Date(header.supplierInvoiceDate) : null);
    r.input('InvoiceAmount',      sql.Decimal(18,2), header.invoiceAmount || 0);
    r.input('CustomerPaid',       sql.Bit,           header.customerPaid ? 1 : 0);
    r.input('AmountPaidByCustomer',sql.Decimal(18,2),header.amountPaidByCustomer || 0);
    r.input('InvoiceIssuedToSupplier',sql.Bit,       header.invoiceIssuedToSupplier ? 1 : 0);
    r.input('CommissionReceived', sql.Bit,           header.commissionReceived ? 1 : 0);
    r.input('CommissionAmtReceived',sql.Decimal(18,2),header.commissionAmtReceived || 0);
    r.output('ResultCode',    sql.Int);
    r.output('ResultMessage', sql.NVarChar(200));

    const result = await r.execute('sp_Orders_Update');
    if (result.output.ResultCode !== 0)
      return res.status(result.output.ResultCode === 404 ? 404 : 500)
        .json({ success: false, message: result.output.ResultMessage });

    // 2. Replace lines
    if (lines) {
      await pool.request()
        .input('OrderID', sql.BigInt, orderId)
        .query('DELETE FROM tblOrderLines WHERE OrderID=@OrderID');

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];

        let resolvedSKU = { itemLinkId: l.itemLinkId || null, finalSupplierSKU: l.supplierSKU, finalCustomerSKU: l.customerSKU };
        try {
          resolvedSKU = await resolveSKU(pool, header.supplierId, l.supplierSKU, header.customerId, l.customerSKU, l.description);
        } catch (skuErr) {
          console.warn(`Update line ${i+1} SKU resolve failed:`, skuErr.message);
        }

        const lr = pool.request();
        lr.input('OrderID',           sql.BigInt,        orderId);
        lr.input('LineNo',            sql.SmallInt,      i + 1);
        lr.input('GroupNo',           sql.SmallInt,      l.groupNo || 1);
        lr.input('SupplierSKU',       sql.NVarChar(50),  resolvedSKU.finalSupplierSKU  || null);
        lr.input('CustomerSKU',       sql.NVarChar(50),  resolvedSKU.finalCustomerSKU  || null);
        lr.input('Description',       sql.NVarChar(200), l.description  || null);
        lr.input('QtyOrdered',        sql.Decimal(18,4), l.qtyOrdered   || 0);
        lr.input('Price',             sql.Decimal(18,4), l.price        || 0);
        lr.input('UOM',               sql.NVarChar(20),  l.uom          || null);
        lr.input('CurrencyID',        sql.Int,           l.currencyId   || header.currencyId || 1);
        lr.input('DiscountPct',       sql.Decimal(5,2),  l.discountPct  || 0);
        lr.input('LineValue',         sql.Decimal(18,2), l.lineValue    || 0);
        lr.input('DeliveryDate',      sql.DateTime,      l.deliveryDate ? new Date(l.deliveryDate) : null);
        lr.input('CommissionType',    sql.Char(1),       reverseCommType(l.commissionType));
        lr.input('CommissionPct',     sql.Decimal(5,2),  l.commissionPct   || 0);
        lr.input('CommissionFixed',   sql.Decimal(18,2), l.commissionFixed || 0);
        lr.input('CommissionPerPrice',sql.Decimal(18,2), l.commissionPerPrice || 0);
        lr.input('IsFrameContract',   sql.Bit,           l.isFrameContract ? 1 : 0);
        lr.input('ItemLinkID',        sql.Int,           resolvedSKU.itemLinkId || null);
        lr.output('ResultCode',       sql.Int);
        lr.output('ResultMessage',    sql.NVarChar(200));
        await lr.execute('sp_Orders_AddLine');
      }

      // Update totals
      const tr = pool.request();
      tr.input('OrderID', sql.BigInt, orderId);
      tr.output('ResultCode',    sql.Int);
      tr.output('ResultMessage', sql.NVarChar(200));
      await tr.execute('sp_Orders_UpdateTotals');
    }

    // Save CustomerContactName (not in SP)
    await pool.request()
      .input('OrderID', sql.BigInt, orderId)
      .input('CustomerContactName', sql.NVarChar(100), header.customerContactName || null)
      .query('UPDATE tblOrders SET CustomerContactName=@CustomerContactName WHERE OrderID=@OrderID');

    audit.logAction(req, { actionType:'UPDATE', entityType:'ORDER', entityId:orderId, entityName:`הזמנה ${header.orderNumber || orderId}`, newValue:{ supplierId:header.supplierId, customerId:header.customerId, totalValue:header.totalValue, isFrozen:header.isFrozen, isCancelled:header.isCancelled } });
    res.json({ success: true, data: { orderId }, message: 'הזמנה עודכנה בהצלחה' });
  } catch (err) {
    console.error('PUT /api/orders/:id', err.message);
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

// ── PATCH actions ─────────────────────────────────────────────────────────────

router.patch('/:orderId/deactivate', requireAuth, async (req, res) => {
  const orderId = parseInt(req.params.orderId);
  try {
    const pool = await getPool();
    const r = pool.request();
    r.input('OrderID', sql.BigInt, orderId);
    r.output('ResultCode',    sql.Int);
    r.output('ResultMessage', sql.NVarChar(200));
    const result = await r.execute('sp_Orders_SetInactive');
    const ok = result.output.ResultCode === 0;
    if (ok) audit.logAction(req, { actionType:'DELETE', entityType:'ORDER', entityId:orderId, entityName:`הזמנה ${orderId}`, severity:'WARN' });
    res.status(ok ? 200 : 500).json({ success: ok, message: result.output.ResultMessage });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:orderId/freeze', requireAuth, async (req, res) => {
  const orderId  = parseInt(req.params.orderId);
  const isFrozen = req.body.isFrozen ? 1 : 0;
  const reason   = req.body.reason || null;
  try {
    const pool = await getPool();
    const r = pool.request();
    r.input('OrderID',  sql.BigInt,       orderId);
    r.input('IsFrozen', sql.Bit,          isFrozen);
    r.input('Reason',   sql.NVarChar(200),reason);
    r.output('ResultCode',    sql.Int);
    r.output('ResultMessage', sql.NVarChar(200));
    const result = await r.execute('sp_Orders_SetFrozen');
    const ok = result.output.ResultCode === 0;
    if (ok) audit.logAction(req, { actionType:'TOGGLE', entityType:'ORDER', entityId:orderId, entityName:`הזמנה ${orderId}`, newValue:{ isFrozen:!!isFrozen } });
    res.status(ok ? 200 : 500).json({ success: ok, message: result.output.ResultMessage });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:orderId/cancel', requireAuth, async (req, res) => {
  const orderId     = parseInt(req.params.orderId);
  const isCancelled = req.body.isCancelled ? 1 : 0;
  const reason      = req.body.reason || null;
  try {
    const pool = await getPool();
    const r = pool.request();
    r.input('OrderID',      sql.BigInt,        orderId);
    r.input('IsCancelled',  sql.Bit,           isCancelled);
    r.input('Reason',       sql.NVarChar(200), reason);
    r.output('ResultCode',    sql.Int);
    r.output('ResultMessage', sql.NVarChar(200));
    const result = await r.execute('sp_Orders_SetCancelled');
    const ok = result.output.ResultCode === 0;
    if (ok) audit.logAction(req, { actionType:'TOGGLE', entityType:'ORDER', entityId:orderId, entityName:`הזמנה ${orderId}`, newValue:{ isCancelled:!!isCancelled }, severity: isCancelled ? 'WARN' : 'INFO' });
    res.status(ok ? 200 : 500).json({ success: ok, message: result.output.ResultMessage });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
