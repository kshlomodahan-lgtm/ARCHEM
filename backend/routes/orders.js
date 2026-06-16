const express     = require('express');
const router      = express.Router();
const { sql, getPool } = require('../db');
const requireAuth = require('../middleware/auth');

function mapCommType(c) {
  if (!c) return 'NONE';
  const v = c.trim();
  if (v === 'א') return 'PCT';
  if (v === 'ק') return 'FIXED';
  if (v === 'מ') return 'PER_PRICE';
  return 'NONE';
}

function mapStatus(row) {
  if (row.IsCancelled)     return 'cancelled';
  if (row.IsFrozen)        return 'frozen';
  if (row.IsImportant)     return 'important';
  if (row.IsFrameContract) return 'frame';
  return 'active';
}

// GET /api/orders/meta/suppliers
router.get('/meta/suppliers', requireAuth, async (req, res) => {
  try {
    const pool   = await getPool();
    const result = await pool.request().query(`
      SELECT SupplierID, ISNULL(NULLIF(RTRIM(ShortNameHE),''), ISNULL(NULLIF(RTRIM(ShortNameEN),''), RTRIM(FullNameHE))) AS Name
      FROM tblSuppliers WHERE IsActive=1 ORDER BY Name
    `);
    res.json({ success: true, data: result.recordset, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

// GET /api/orders/meta/customers
router.get('/meta/customers', requireAuth, async (req, res) => {
  try {
    const pool   = await getPool();
    const result = await pool.request().query(`
      SELECT CustomerID, ISNULL(NULLIF(RTRIM(ShortNameHE),''), FullNameHE) AS Name
      FROM tblCustomers WHERE IsActive=1 ORDER BY Name
    `);
    res.json({ success: true, data: result.recordset, message: '' });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

// GET /api/orders
router.get('/', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const req2 = pool.request();
    const { year, companyId, supplierId, customerId, status, search } = req.query;

    let where = ['1=1'];

    if (year && year !== 'all') {
      req2.input('Year', sql.SmallInt, parseInt(year));
      where.push('o.OrderYear = @Year');
    } else if (!year) {
      req2.input('DefYear', sql.SmallInt, new Date().getFullYear());
      where.push('o.OrderYear = @DefYear');
    }

    if (companyId)  { req2.input('CompanyID',  sql.Int, parseInt(companyId));  where.push('o.CompanyID = @CompanyID'); }
    if (supplierId) { req2.input('SupplierID', sql.Int, parseInt(supplierId)); where.push('o.SupplierID = @SupplierID'); }
    if (customerId) { req2.input('CustomerID', sql.Int, parseInt(customerId)); where.push('o.CustomerID = @CustomerID'); }

    if (status === 'cancelled') where.push('o.IsCancelled = 1');
    if (status === 'frozen')    where.push('o.IsFrozen = 1 AND o.IsCancelled = 0');
    if (status === 'important') where.push('o.IsImportant = 1 AND o.IsFrozen = 0 AND o.IsCancelled = 0');
    if (status === 'frame')     where.push('o.IsFrameContract = 1 AND o.IsFrozen = 0 AND o.IsCancelled = 0');
    if (status === 'active')    where.push('o.IsCancelled = 0 AND o.IsFrozen = 0');

    if (search) {
      req2.input('Search', sql.NVarChar(100), `%${search}%`);
      where.push(`(s.FullNameHE LIKE @Search OR s.FullNameEN LIKE @Search OR c.FullNameHE LIKE @Search OR c.FullNameEN LIKE @Search OR CAST(o.OrderNumber AS nvarchar) LIKE @Search)`);
    }

    const whereClause = where.join(' AND ');

    const result = await req2.query(`
      SELECT
        o.OrderID, o.CompanyID, o.OrderYear, o.OrderNumber, o.GroupNo,
        o.SupplierID, ISNULL(ISNULL(s.ShortNameHE, s.ShortNameEN), CAST(o.SupplierID AS nvarchar)) AS SupplierName,
        o.CustomerID, ISNULL(c.FullNameHE, c.FullNameEN) AS CustomerName,
        o.OrderDate, o.ETA, o.ATA,
        o.TotalValue, o.TotalCommission, o.CommissionReceived, o.CommissionAmtReceived,
        o.IsFrozen, o.IsCancelled, o.IsImportant, o.IsFrameContract,
        o.CurrencyID, ISNULL(cur.CurrencySymbol, '') AS CurrencySymbol,
        (SELECT MIN(ol2.DeliveryDate) FROM tblOrderLines ol2 WHERE ol2.OrderID = o.OrderID AND ol2.DeliveryDate IS NOT NULL) AS DeliveryDate,
        (SELECT TOP 1 ol3.CommissionType FROM tblOrderLines ol3 WHERE ol3.OrderID = o.OrderID AND ol3.CommissionType IS NOT NULL GROUP BY ol3.CommissionType ORDER BY COUNT(*) DESC) AS CommissionType,
        (SELECT AVG(ol4.CommissionPct) FROM tblOrderLines ol4 WHERE ol4.OrderID = o.OrderID AND ol4.CommissionPct > 0) AS CommissionPct,
        (SELECT COUNT(*) FROM tblOrderLines ol5 WHERE ol5.OrderID = o.OrderID) AS LineCount
      FROM tblOrders o
      LEFT JOIN tblSuppliers s    ON s.SupplierID = o.SupplierID
      LEFT JOIN tblCustomers c    ON c.CustomerID = o.CustomerID
      LEFT JOIN tblCurrencies cur ON cur.CurrencyID = o.CurrencyID
      WHERE ${whereClause}
      ORDER BY o.OrderDate DESC, o.OrderYear DESC, o.OrderNumber DESC
    `);

    const data = result.recordset.map(row => ({
      orderId:               row.OrderID,
      orderNumber:           row.OrderNumber,
      orderYear:             row.OrderYear,
      companyId:             row.CompanyID,
      groupNo:               row.GroupNo,
      supplierID:            row.SupplierID,
      supplierShort:         row.SupplierName,
      supplierFull:          row.SupplierName,
      customerID:            row.CustomerID,
      customerShort:         row.CustomerName,
      customerFull:          row.CustomerName,
      orderDate:             row.OrderDate,
      deliveryDate:          row.DeliveryDate,
      eta:                   row.ETA,
      ata:                   row.ATA,
      currency:              row.CurrencySymbol,
      totalValue:            Number(row.TotalValue) || 0,
      commissionAmount:      Number(row.TotalCommission) || 0,
      commissionReceived:    !!row.CommissionReceived,
      commissionAmtReceived: Number(row.CommissionAmtReceived) || 0,
      commissionType:        mapCommType(row.CommissionType),
      commissionPct:         Number(row.CommissionPct) || 0,
      status:                mapStatus(row),
      salesDomain: '', salesDomainPrefix: '', salesPerson: '', customerRef: '',
      isFrameContract: !!row.IsFrameContract,
      lineCount: row.LineCount,
      lines: [], financial: null, shipment: null,
    }));

    res.json({ success: true, data, message: '' });
  } catch (err) {
    console.error('GET /api/orders', err.message);
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

// GET /api/orders/:orderId
router.get('/:orderId', requireAuth, async (req, res) => {
  try {
    const pool    = await getPool();
    const orderId = parseInt(req.params.orderId);
    if (!orderId) return res.status(400).json({ success: false, message: 'מזהה הזמנה לא תקין' });

    const hdr = await pool.request()
      .input('OrderID', sql.BigInt, orderId)
      .query(`
        SELECT o.*,
          ISNULL(ISNULL(s.ShortNameHE, s.ShortNameEN), CAST(o.SupplierID AS nvarchar)) AS SupplierName,
          ISNULL(s.ShortNameHE, s.ShortNameEN) AS SupplierShortName,
          ISNULL(c.FullNameHE, c.FullNameEN) AS CustomerName,
          c.ShortNameHE AS CustomerShortName,
          ISNULL(cur.CurrencySymbol,'') AS CurrencySymbol,
          comp.NameHE AS CompanyName
        FROM tblOrders o
        LEFT JOIN tblSuppliers s    ON s.SupplierID = o.SupplierID
        LEFT JOIN tblCustomers c    ON c.CustomerID = o.CustomerID
        LEFT JOIN tblCurrencies cur ON cur.CurrencyID = o.CurrencyID
        LEFT JOIN tblCompanies comp ON comp.CompanyID = o.CompanyID
        WHERE o.OrderID = @OrderID
      `);

    if (!hdr.recordset.length)
      return res.status(404).json({ success: false, message: 'הזמנה לא נמצאה' });

    const h = hdr.recordset[0];

    const lines = await pool.request()
      .input('OrderID', sql.BigInt, orderId)
      .query(`
        SELECT ol.OrderLineID, ol.[LineNo], ol.[GroupNo],
          ol.SupplierSKU, ol.CustomerSKU, ol.Description,
          ol.QtyOrdered, ol.QtyRemaining,
          ol.Price, ol.UOM, ol.CurrencyID,
          ISNULL(cur.CurrencySymbol,'') AS CurrencySymbol,
          ol.DiscountPct, ol.LineValue, ol.DeliveryDate,
          ol.CommissionType, ol.CommissionPct, ol.CommissionFixed,
          ol.CommissionPerPrice, ol.IsFrameContract, ol.ItemLinkID
        FROM tblOrderLines ol
        LEFT JOIN tblCurrencies cur ON cur.CurrencyID = ol.CurrencyID
        WHERE ol.OrderID = @OrderID
        ORDER BY ol.[GroupNo], ol.[LineNo]
      `);

    const mappedLines = lines.recordset.map(l => ({
      orderLineId:     l.OrderLineID,
      lineNo:          l.LineNo,
      groupNo:         l.GroupNo,
      supplierSKU:     l.SupplierSKU || '',
      customerSKU:     l.CustomerSKU || '',
      description:     l.Description || '',
      qtyOrdered:      Number(l.QtyOrdered) || 0,
      qtyDispatched:   Math.max(0, (Number(l.QtyOrdered) || 0) - (Number(l.QtyRemaining) || 0)),
      price:           Number(l.Price) || 0,
      uom:             l.UOM || '',
      currency:        l.CurrencySymbol,
      discountPct:     Number(l.DiscountPct) || 0,
      lineValue:       Number(l.LineValue) || 0,
      deliveryDate:    l.DeliveryDate,
      commissionType:  mapCommType(l.CommissionType),
      commissionPct:   Number(l.CommissionPct) || 0,
      commissionFixed: Number(l.CommissionFixed) || 0,
      commissionAmount: 0,
      isFrameContract: !!l.IsFrameContract,
      itemLinkId:      l.ItemLinkID,
    }));

    const domCommType = mappedLines.find(l => l.commissionType !== 'NONE')?.commissionType ?? 'NONE';
    const avgCommPct  = mappedLines.filter(l => l.commissionPct > 0)
      .reduce((s, l, _, a) => s + l.commissionPct / a.length, 0);

    const order = {
      orderId:               h.OrderID,
      orderNumber:           h.OrderNumber,
      orderYear:             h.OrderYear,
      companyId:             h.CompanyID,
      groupNo:               h.GroupNo,
      supplierID:            h.SupplierID,
      supplierShort:         h.SupplierShortName || h.SupplierName,
      supplierFull:          h.SupplierName,
      customerID:            h.CustomerID,
      customerShort:         h.CustomerShortName || h.CustomerName,
      customerFull:          h.CustomerName,
      orderDate:             h.OrderDate,
      currency:              h.CurrencySymbol,
      totalValue:            Number(h.TotalValue) || 0,
      commissionAmount:      Number(h.TotalCommission) || 0,
      commissionType:        domCommType,
      commissionPct:         avgCommPct,
      commissionReceived:    !!h.CommissionReceived,
      commissionAmtReceived: Number(h.CommissionAmtReceived) || 0,
      status:                mapStatus(h),
      salesDomain: '', salesDomainPrefix: '', salesPerson: '', customerRef: '',
      isFrameContract: !!h.IsFrameContract,
      lineCount: mappedLines.length,
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
        currency:                 h.CurrencySymbol,
      },
      lines: mappedLines,
      deliveryDate: mappedLines.reduce((min, l) => {
        if (!l.deliveryDate) return min;
        if (!min) return l.deliveryDate;
        return l.deliveryDate < min ? l.deliveryDate : min;
      }, null),
      eta: h.ETA,
      ata: h.ATA,
    };

    res.json({ success: true, data: order, message: '' });
  } catch (err) {
    console.error('GET /api/orders/:id', err.message);
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});


// ── META ─────────────────────────────────────────────────────────────────────

router.get('/meta/companies', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT CompanyID, ISNULL(NameHE, NameEN) AS Name FROM tblCompanies WHERE IsActive=1 ORDER BY NameHE`
    );
    res.json({ success: true, data: r.recordset, message: '' });
  } catch (err) { res.status(500).json({ success: false, data: null, message: err.message }); }
});

router.get('/meta/currencies', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT CurrencyID, CurrencySymbol AS Symbol, ISNULL(CurrencyNameHE, CurrencySymbol) AS Name FROM tblCurrencies ORDER BY CurrencyID`
    );
    res.json({ success: true, data: r.recordset, message: '' });
  } catch (err) { res.status(500).json({ success: false, data: null, message: err.message }); }
});

router.get('/meta/next-order-number', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const r = await pool.request()
      .input('Year', sql.SmallInt, year)
      .query(`SELECT ISNULL(MAX(OrderNumber),0)+1 AS NextNo FROM tblOrders WHERE OrderYear=@Year`);
    res.json({ success: true, data: { nextNo: r.recordset[0].NextNo }, message: '' });
  } catch (err) { res.status(500).json({ success: false, data: null, message: err.message }); }
});

// ── CREATE ────────────────────────────────────────────────────────────────────

function reverseCommType(t) {
  if (t === 'PCT')       return 'א';
  if (t === 'FIXED')     return 'ק';
  if (t === 'PER_PRICE') return 'מ';
  return null;
}

router.post('/', requireAuth, async (req, res) => {
  const { header, lines } = req.body;
  if (!header || !header.supplierId || !header.customerId)
    return res.status(400).json({ success: false, message: 'ספק, לקוח ותאריך הם שדות חובה' });

  const pool = await getPool();
  const t = new sql.Transaction(pool);
  await t.begin();
  try {
    const r = new sql.Request(t);
    r.input('CompanyID',          sql.Int,           header.companyId   || null);
    r.input('OrderYear',          sql.SmallInt,      header.orderYear   || new Date().getFullYear());
    r.input('OrderNumber',        sql.Int,           header.orderNumber || null);
    r.input('GroupNo',            sql.NVarChar(10),  header.groupNo     || null);
    r.input('SupplierID',         sql.Int,           header.supplierId);
    r.input('CustomerID',         sql.Int,           header.customerId);
    r.input('OrderDate',          sql.DateTime,      header.orderDate ? new Date(header.orderDate) : new Date());
    r.input('CurrencyID',         sql.Int,           header.currencyId  || 1);
    r.input('IsFrameContract',    sql.Bit,           header.isFrameContract ? 1 : 0);
    r.input('IsImportant',        sql.Bit,           header.isImportant ? 1 : 0);
    r.input('IsFrozen',           sql.Bit,           0);
    r.input('IsCancelled',        sql.Bit,           0);
    r.input('TotalValue',         sql.Decimal(18,2), header.totalValue  || 0);
    r.input('TotalCommission',    sql.Decimal(18,2), 0);
    r.input('CommissionReceived', sql.Bit,           0);
    r.input('CommissionAmtReceived', sql.Decimal(18,2), 0);
    r.input('SupplierOC',         sql.NVarChar(50),  header.supplierOC           || null);
    r.input('SupplierOCDate',     sql.DateTime,      header.supplierOCDate        ? new Date(header.supplierOCDate) : null);
    r.input('DesiredDeliveryDate',sql.DateTime,      header.desiredDeliveryDate   ? new Date(header.desiredDeliveryDate) : null);
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

    const ins = await r.query(`
      INSERT INTO tblOrders (
        CompanyID, OrderYear, OrderNumber, GroupNo, SupplierID, CustomerID,
        OrderDate, CurrencyID, IsFrameContract, IsImportant, IsFrozen, IsCancelled,
        TotalValue, TotalCommission, CommissionReceived, CommissionAmtReceived,
        SupplierOC, SupplierOCDate, DesiredDeliveryDate, ETD, ETA, ATA,
        VesselName, BLNumber, TransportMode,
        SupplierInvoiceNo, SupplierInvoiceDate, InvoiceAmount,
        CustomerPaid, AmountPaidByCustomer, InvoiceIssuedToSupplier
      ) VALUES (
        @CompanyID,@OrderYear,@OrderNumber,@GroupNo,@SupplierID,@CustomerID,
        @OrderDate,@CurrencyID,@IsFrameContract,@IsImportant,@IsFrozen,@IsCancelled,
        @TotalValue,@TotalCommission,@CommissionReceived,@CommissionAmtReceived,
        @SupplierOC,@SupplierOCDate,@DesiredDeliveryDate,@ETD,@ETA,@ATA,
        @VesselName,@BLNumber,@TransportMode,
        @SupplierInvoiceNo,@SupplierInvoiceDate,@InvoiceAmount,
        @CustomerPaid,@AmountPaidByCustomer,@InvoiceIssuedToSupplier
      );
      SELECT SCOPE_IDENTITY() AS OrderID;
    `);
    const newOrderId = ins.recordset[0].OrderID;

    if (lines && lines.length > 0) {
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const lr = new sql.Request(t);
        lr.input('OrderID',      sql.BigInt,        newOrderId);
        lr.input('LineNo',       sql.SmallInt,      i + 1);
        lr.input('GroupNo',      sql.SmallInt,      l.groupNo || 1);
        lr.input('SupplierSKU',  sql.NVarChar(50),  l.supplierSKU  || null);
        lr.input('CustomerSKU',  sql.NVarChar(50),  l.customerSKU  || null);
        lr.input('Description',  sql.NVarChar(200), l.description  || null);
        lr.input('QtyOrdered',   sql.Decimal(18,4), l.qtyOrdered   || 0);
        lr.input('QtyRemaining', sql.Decimal(18,4), l.qtyOrdered   || 0);
        lr.input('Price',        sql.Decimal(18,4), l.price        || 0);
        lr.input('UOM',          sql.NVarChar(20),  l.uom          || null);
        lr.input('CurrencyID',   sql.Int,           l.currencyId   || header.currencyId || 1);
        lr.input('DiscountPct',  sql.Decimal(5,2),  l.discountPct  || 0);
        lr.input('LineValue',    sql.Decimal(18,2), l.lineValue    || 0);
        lr.input('DeliveryDate', sql.DateTime,      l.deliveryDate  ? new Date(l.deliveryDate) : null);
        lr.input('CommissionType',    sql.Char(1),       reverseCommType(l.commissionType));
        lr.input('CommissionPct',     sql.Decimal(5,2),  l.commissionPct   || 0);
        lr.input('CommissionFixed',   sql.Decimal(18,2), l.commissionFixed || 0);
        lr.input('CommissionPerPrice',sql.Decimal(18,2), 0);
        lr.input('IsFrameContract',   sql.Bit,           l.isFrameContract ? 1 : 0);
        await lr.query(`
          INSERT INTO tblOrderLines (
            OrderID,LineNo,GroupNo,SupplierSKU,CustomerSKU,Description,
            QtyOrdered,QtyRemaining,Price,UOM,CurrencyID,DiscountPct,LineValue,
            DeliveryDate,CommissionType,CommissionPct,CommissionFixed,CommissionPerPrice,IsFrameContract
          ) VALUES (
            @OrderID,@LineNo,@GroupNo,@SupplierSKU,@CustomerSKU,@Description,
            @QtyOrdered,@QtyRemaining,@Price,@UOM,@CurrencyID,@DiscountPct,@LineValue,
            @DeliveryDate,@CommissionType,@CommissionPct,@CommissionFixed,@CommissionPerPrice,@IsFrameContract
          )
        `);
      }
    }

    await t.commit();
    res.json({ success: true, data: { orderId: newOrderId }, message: 'הזמנה נוצרה בהצלחה' });
  } catch (err) {
    await t.rollback();
    console.error('POST /api/orders', err.message);
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

// ── UPDATE ────────────────────────────────────────────────────────────────────

router.put('/:orderId', requireAuth, async (req, res) => {
  const orderId = parseInt(req.params.orderId);
  const { header, lines } = req.body;
  if (!orderId || !header)
    return res.status(400).json({ success: false, message: 'נתונים חסרים' });

  const pool = await getPool();
  const t = new sql.Transaction(pool);
  await t.begin();
  try {
    const r = new sql.Request(t);
    r.input('OrderID',            sql.BigInt,        orderId);
    r.input('SupplierID',         sql.Int,           header.supplierId);
    r.input('CustomerID',         sql.Int,           header.customerId);
    r.input('CompanyID',          sql.Int,           header.companyId   || null);
    r.input('OrderDate',          sql.DateTime,      header.orderDate ? new Date(header.orderDate) : null);
    r.input('CurrencyID',         sql.Int,           header.currencyId  || 1);
    r.input('IsFrameContract',    sql.Bit,           header.isFrameContract ? 1 : 0);
    r.input('IsImportant',        sql.Bit,           header.isImportant ? 1 : 0);
    r.input('TotalValue',         sql.Decimal(18,2), header.totalValue  || 0);
    r.input('SupplierOC',         sql.NVarChar(50),  header.supplierOC           || null);
    r.input('SupplierOCDate',     sql.DateTime,      header.supplierOCDate        ? new Date(header.supplierOCDate) : null);
    r.input('DesiredDeliveryDate',sql.DateTime,      header.desiredDeliveryDate   ? new Date(header.desiredDeliveryDate) : null);
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
    r.input('CommissionReceived', sql.Bit,           header.commissionReceived ? 1 : 0);
    r.input('CommissionAmtReceived',sql.Decimal(18,2),header.commissionAmtReceived || 0);

    await r.query(`
      UPDATE tblOrders SET
        SupplierID=@SupplierID, CustomerID=@CustomerID, CompanyID=@CompanyID,
        OrderDate=@OrderDate, CurrencyID=@CurrencyID,
        IsFrameContract=@IsFrameContract, IsImportant=@IsImportant, TotalValue=@TotalValue,
        SupplierOC=@SupplierOC, SupplierOCDate=@SupplierOCDate,
        DesiredDeliveryDate=@DesiredDeliveryDate, ETD=@ETD, ETA=@ETA, ATA=@ATA,
        VesselName=@VesselName, BLNumber=@BLNumber, TransportMode=@TransportMode,
        SupplierInvoiceNo=@SupplierInvoiceNo, SupplierInvoiceDate=@SupplierInvoiceDate,
        InvoiceAmount=@InvoiceAmount, CustomerPaid=@CustomerPaid,
        AmountPaidByCustomer=@AmountPaidByCustomer,
        InvoiceIssuedToSupplier=@InvoiceIssuedToSupplier,
        CommissionReceived=@CommissionReceived, CommissionAmtReceived=@CommissionAmtReceived
      WHERE OrderID=@OrderID
    `);

    if (lines) {
      await new sql.Request(t)
        .input('OrderID', sql.BigInt, orderId)
        .query('DELETE FROM tblOrderLines WHERE OrderID=@OrderID');

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const lr = new sql.Request(t);
        lr.input('OrderID',      sql.BigInt,        orderId);
        lr.input('LineNo',       sql.SmallInt,      i + 1);
        lr.input('GroupNo',      sql.SmallInt,      l.groupNo || 1);
        lr.input('SupplierSKU',  sql.NVarChar(50),  l.supplierSKU  || null);
        lr.input('CustomerSKU',  sql.NVarChar(50),  l.customerSKU  || null);
        lr.input('Description',  sql.NVarChar(200), l.description  || null);
        lr.input('QtyOrdered',   sql.Decimal(18,4), l.qtyOrdered   || 0);
        lr.input('QtyRemaining', sql.Decimal(18,4), l.qtyOrdered   || 0);
        lr.input('Price',        sql.Decimal(18,4), l.price        || 0);
        lr.input('UOM',          sql.NVarChar(20),  l.uom          || null);
        lr.input('CurrencyID',   sql.Int,           l.currencyId   || header.currencyId || 1);
        lr.input('DiscountPct',  sql.Decimal(5,2),  l.discountPct  || 0);
        lr.input('LineValue',    sql.Decimal(18,2), l.lineValue    || 0);
        lr.input('DeliveryDate', sql.DateTime,      l.deliveryDate  ? new Date(l.deliveryDate) : null);
        lr.input('CommissionType',    sql.Char(1),       reverseCommType(l.commissionType));
        lr.input('CommissionPct',     sql.Decimal(5,2),  l.commissionPct   || 0);
        lr.input('CommissionFixed',   sql.Decimal(18,2), l.commissionFixed || 0);
        lr.input('CommissionPerPrice',sql.Decimal(18,2), 0);
        lr.input('IsFrameContract',   sql.Bit,           l.isFrameContract ? 1 : 0);
        await lr.query(`
          INSERT INTO tblOrderLines (
            OrderID,LineNo,GroupNo,SupplierSKU,CustomerSKU,Description,
            QtyOrdered,QtyRemaining,Price,UOM,CurrencyID,DiscountPct,LineValue,
            DeliveryDate,CommissionType,CommissionPct,CommissionFixed,CommissionPerPrice,IsFrameContract
          ) VALUES (
            @OrderID,@LineNo,@GroupNo,@SupplierSKU,@CustomerSKU,@Description,
            @QtyOrdered,@QtyRemaining,@Price,@UOM,@CurrencyID,@DiscountPct,@LineValue,
            @DeliveryDate,@CommissionType,@CommissionPct,@CommissionFixed,@CommissionPerPrice,@IsFrameContract
          )
        `);
      }
    }

    await t.commit();
    res.json({ success: true, data: { orderId }, message: 'הזמנה עודכנה בהצלחה' });
  } catch (err) {
    await t.rollback();
    console.error('PUT /api/orders/:id', err.message);
    res.status(500).json({ success: false, data: null, message: err.message });
  }
});

module.exports = router;
