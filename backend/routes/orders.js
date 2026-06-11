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
      SELECT SupplierID, ISNULL(NULLIF(RTRIM(ShortName),''), RTRIM(FullName)) AS Name
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
      where.push(`(s.FullName LIKE @Search OR c.FullNameHE LIKE @Search OR c.FullNameEN LIKE @Search OR CAST(o.OrderNumber AS nvarchar) LIKE @Search)`);
    }

    const whereClause = where.join(' AND ');

    const result = await req2.query(`
      SELECT
        o.OrderID, o.CompanyID, o.OrderYear, o.OrderNumber, o.GroupNo,
        o.SupplierID, ISNULL(s.FullName, CAST(o.SupplierID AS nvarchar)) AS SupplierName,
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
          ISNULL(s.FullName, CAST(o.SupplierID AS nvarchar)) AS SupplierName,
          s.ShortName AS SupplierShortName,
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

module.exports = router;
