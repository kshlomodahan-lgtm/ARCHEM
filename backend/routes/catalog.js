const express     = require('express');
const router      = express.Router();
const { sql, getPool } = require('../db');
const requireAuth = require('../middleware/auth');

const ok  = (res, data, msg = 'OK') => res.json({ success: true, data, message: msg });
const err = (res, e, code = 500)    => res.status(code).json({ success: false, message: e.message || e });

// ─── QUEUE ────────────────────────────────────────────────────

// GET /api/catalog/queue?status=PENDING
router.get('/queue', requireAuth, async (req, res) => {
  try {
    const pool   = await getPool();
    const status = req.query.status || 'PENDING';
    const r = await pool.request()
      .input('s', sql.NVarChar(20), status)
      .query(`
        SELECT
          q.QueueID, q.AIStatus, q.Decision, q.CreatedAt, q.ProcessedAt, q.AssignedToUserID,
          il.ItemLinkID, il.SupplierID, il.SupplierSKU,
          il.CustomerID, il.CustomerSKU, il.CustomerSKUDesc, il.IsTempSKU,
          s.SupplierName, c.CustomerName
        FROM tblCatalogQueue q
        JOIN tblItemLinks il ON il.ItemLinkID = q.ItemLinkID
        LEFT JOIN tblSuppliers s ON s.SupplierID = il.SupplierID
        LEFT JOIN tblCustomers c ON c.CustomerID = il.CustomerID
        WHERE q.AIStatus = @s
        ORDER BY q.CreatedAt DESC
      `);
    ok(res, r.recordset);
  } catch (e) { err(res, e); }
});

// GET /api/catalog/queue/counts
router.get('/queue/counts', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT AIStatus, COUNT(*) AS cnt FROM tblCatalogQueue GROUP BY AIStatus
    `);
    const counts = { PENDING: 0, PROCESSING: 0, DONE: 0, FAILED: 0 };
    r.recordset.forEach(row => { counts[row.AIStatus] = row.cnt; });
    ok(res, counts);
  } catch (e) { err(res, e); }
});

// GET /api/catalog/queue/:queueId
router.get('/queue/:queueId', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().input('id', sql.BigInt, +req.params.queueId).query(`
      SELECT
        q.*, il.SupplierID, il.SupplierSKU, il.CustomerID, il.CustomerSKU,
        il.CustomerSKUDesc, il.UOMID, il.IsTempSKU, il.IsGlobalSKU,
        s.SupplierName, c.CustomerName,
        u.UOMCode
      FROM tblCatalogQueue q
      JOIN tblItemLinks il ON il.ItemLinkID = q.ItemLinkID
      LEFT JOIN tblSuppliers s  ON s.SupplierID  = il.SupplierID
      LEFT JOIN tblCustomers c  ON c.CustomerID  = il.CustomerID
      LEFT JOIN tblUnitsOfMeasure u ON u.UOMID   = il.UOMID
      WHERE q.QueueID = @id
    `);
    if (!r.recordset.length) return err(res, { message: 'לא נמצא' }, 404);
    const row = r.recordset[0];
    if (row.AISuggestions) {
      try { row.AISuggestions = JSON.parse(row.AISuggestions); } catch { /* keep as string */ }
    }
    ok(res, row);
  } catch (e) { err(res, e); }
});

// POST /api/catalog/queue/enqueue  — add temp SKU to queue
router.post('/queue/enqueue', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const { itemLinkId } = req.body;
    // check not already in queue
    const exists = await pool.request().input('id', sql.BigInt, itemLinkId)
      .query(`SELECT QueueID FROM tblCatalogQueue WHERE ItemLinkID=@id AND AIStatus IN ('PENDING','PROCESSING')`);
    if (exists.recordset.length) return ok(res, { queueId: exists.recordset[0].QueueID }, 'כבר בתור');

    const r = await pool.request().input('id', sql.BigInt, itemLinkId)
      .query(`INSERT INTO tblCatalogQueue (ItemLinkID) OUTPUT INSERTED.QueueID VALUES (@id)`);
    ok(res, { queueId: r.recordset[0].QueueID }, 'נוסף לתור');
  } catch (e) { err(res, e); }
});

// ─── AI SUGGEST ───────────────────────────────────────────────

// POST /api/catalog/ai-suggest
router.post('/ai-suggest', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const { queueId, itemLinkId, supplierSku, customerSkuDesc } = req.body;

    // Mark as PROCESSING
    if (queueId) {
      await pool.request().input('id', sql.BigInt, queueId)
        .query(`UPDATE tblCatalogQueue SET AIStatus='PROCESSING' WHERE QueueID=@id`);
    }

    // Fetch existing catalog items for context
    const items = await pool.request().query(`
      SELECT TOP 200
        i.ItemID, i.ItemCode, i.NameHE, i.NameEN,
        isl.SupplierPartNo, isl.SupplierID,
        s.SupplierName
      FROM tblItems i
      LEFT JOIN tblItemSupplierLinks isl ON isl.ItemID=i.ItemID AND isl.IsPrimary=1 AND isl.IsActive=1
      LEFT JOIN tblSuppliers s ON s.SupplierID=isl.SupplierID
      WHERE i.IsActive=1
      ORDER BY i.CreatedAt DESC
    `);

    // Build AI prompt
    const catalogSample = items.recordset.slice(0, 100).map(it =>
      `ItemID:${it.ItemID} | Code:${it.ItemCode || '-'} | HE:${it.NameHE || '-'} | EN:${it.NameEN || '-'} | SKU:${it.SupplierPartNo || '-'} | Supplier:${it.SupplierName || '-'}`
    ).join('\n');

    const prompt = `You are a catalog deduplication AI for ARCHEM, an import management system.

A new item has arrived requiring catalog review:
- Supplier SKU: ${supplierSku || 'unknown'}
- Customer description: ${customerSkuDesc || 'no description'}

Here are the last 100 items in the catalog:
${catalogSample}

Analyze the new item and find up to 5 similar existing catalog items.
For each match, return a JSON array (only the array, no markdown):
[
  {
    "itemId": <number>,
    "itemCode": "<string>",
    "itemName": "<string>",
    "supplierSku": "<string>",
    "score": <0.0-1.0>,
    "reason": "<brief Hebrew explanation why similar>"
  }
]

Only include items with score > 0.3. If no similar items exist, return [].`;

    // Call AI via SQUADFLOW connector (742aef38)
    let suggestions = [];
    try {
      const sfPool = await require('../db').getSFPool();
      const aiConn = await sfPool.request()
        .query(`SELECT ConnectorConfig FROM tblConnectors WHERE ConnectorToken='742aef38' AND IsActive=1`);

      if (aiConn.recordset.length) {
        const cfg = JSON.parse(aiConn.recordset[0].ConnectorConfig || '{}');
        const apiKey = cfg.apiKey || cfg.api_key;
        const model  = cfg.model  || 'claude-haiku-4-5-20251001';

        const fetch  = require('node-fetch');
        const aiRes  = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model,
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }]
          })
        });
        const aiData = await aiRes.json();
        const text   = aiData?.content?.[0]?.text || '[]';
        const match  = text.match(/\[[\s\S]*\]/);
        if (match) suggestions = JSON.parse(match[0]);
      }
    } catch (aiErr) {
      console.error('AI suggest error:', aiErr.message);
      // fallback: simple text search
      suggestions = await fallbackSearch(pool, supplierSku, customerSkuDesc);
    }

    // If AI failed or empty — fallback
    if (!suggestions.length) {
      suggestions = await fallbackSearch(pool, supplierSku, customerSkuDesc);
    }

    const suggestionsJson = JSON.stringify(suggestions);

    // Save to queue
    if (queueId) {
      await pool.request()
        .input('id', sql.BigInt, queueId)
        .input('sg', sql.NVarChar(sql.MAX), suggestionsJson)
        .query(`UPDATE tblCatalogQueue SET AIStatus='DONE', AISuggestions=@sg WHERE QueueID=@id`);
    }

    ok(res, { suggestions });
  } catch (e) {
    if (req.body.queueId) {
      try {
        const pool2 = await getPool();
        await pool2.request().input('id', sql.BigInt, req.body.queueId)
          .query(`UPDATE tblCatalogQueue SET AIStatus='FAILED' WHERE QueueID=@id`);
      } catch {}
    }
    err(res, e);
  }
});

async function fallbackSearch(pool, supplierSku, desc) {
  const terms = [supplierSku, desc].filter(Boolean).join(' ').trim();
  if (!terms) return [];
  const words = terms.split(/\s+/).filter(w => w.length > 1).slice(0, 5);
  if (!words.length) return [];
  const conditions = words.map((w, i) => `(i.NameHE LIKE '%'+@w${i}+'%' OR i.NameEN LIKE '%'+@w${i}+'%' OR isl.SupplierPartNo LIKE '%'+@w${i}+'%')`).join(' OR ');
  const req2 = pool.request();
  words.forEach((w, i) => req2.input(`w${i}`, sql.NVarChar(100), w));
  const r = await req2.query(`
    SELECT TOP 5 i.ItemID, i.ItemCode, COALESCE(i.NameHE, i.NameEN, '') AS itemName, isl.SupplierPartNo AS supplierSku
    FROM tblItems i
    LEFT JOIN tblItemSupplierLinks isl ON isl.ItemID=i.ItemID AND isl.IsPrimary=1
    WHERE i.IsActive=1 AND (${conditions})
  `);
  return r.recordset.map(row => ({
    itemId: row.ItemID, itemCode: row.ItemCode,
    itemName: row.itemName, supplierSku: row.supplierSku || '',
    score: 0.5, reason: 'התאמה לפי מלל'
  }));
}

// ─── DECISIONS ────────────────────────────────────────────────

// POST /api/catalog/decide/link  — link temp SKU to existing item
router.post('/decide/link', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const { queueId, itemLinkId, itemId } = req.body;

    // Find existing SupplierPartNo for this item+supplier and update, or create
    const il = await pool.request().input('id', sql.BigInt, itemLinkId)
      .query(`SELECT SupplierID, SupplierSKU FROM tblItemLinks WHERE ItemLinkID=@id`);
    if (!il.recordset.length) return err(res, { message: 'ItemLink לא נמצא' }, 404);

    const { SupplierID, SupplierSKU } = il.recordset[0];

    // Upsert into tblItemSupplierLinks
    const existing = await pool.request()
      .input('item', sql.Int, itemId).input('sup', sql.Int, SupplierID)
      .query(`SELECT ItemSupplierID FROM tblItemSupplierLinks WHERE ItemID=@item AND SupplierID=@sup AND IsActive=1`);

    if (!existing.recordset.length) {
      await pool.request()
        .input('item', sql.Int,         itemId)
        .input('sup',  sql.Int,         SupplierID)
        .input('sku',  sql.NVarChar(30), SupplierSKU)
        .query(`INSERT INTO tblItemSupplierLinks (ItemID,SupplierID,SupplierPartNo,IsPrimary,IsActive)
                VALUES (@item,@sup,@sku,0,1)`);
    }

    // Mark link as approved
    await pool.request().input('id', sql.BigInt, itemLinkId)
      .query(`UPDATE tblItemLinks SET IsTempSKU=0, UpdatedAt=GETDATE() WHERE ItemLinkID=@id`);

    // Close queue entry
    await pool.request()
      .input('id',  sql.BigInt, queueId)
      .input('ri',  sql.Int,    itemId)
      .input('uid', sql.Int,    req.user?.userId || null)
      .query(`UPDATE tblCatalogQueue
              SET Decision='LINKED', ResultItemID=@ri, ProcessedAt=GETDATE(), AssignedToUserID=@uid
              WHERE QueueID=@id`);

    ok(res, { linked: true, itemId }, 'מק"ט קושר לפריט קיים');
  } catch (e) { err(res, e); }
});

// POST /api/catalog/decide/create  — create new item and link
router.post('/decide/create', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const { queueId, itemLinkId, nameHe, nameEn, itemCode, uomId } = req.body;

    const il = await pool.request().input('id', sql.BigInt, itemLinkId)
      .query(`SELECT SupplierID, SupplierSKU FROM tblItemLinks WHERE ItemLinkID=@id`);
    if (!il.recordset.length) return err(res, { message: 'ItemLink לא נמצא' }, 404);
    const { SupplierID, SupplierSKU } = il.recordset[0];

    // Create tblItems record
    const newItem = await pool.request()
      .input('c',  sql.NVarChar(20),  itemCode || null)
      .input('he', sql.NVarChar(100), nameHe   || null)
      .input('en', sql.NVarChar(100), nameEn   || null)
      .input('s',  sql.Int,           SupplierID)
      .input('u',  sql.Int,           uomId     || null)
      .input('cu', sql.Int,           req.user?.userId || null)
      .query(`INSERT INTO tblItems (ItemCode,NameHE,NameEN,DefaultSupplierID,UOM_ID,IsActive,CreatedAt,CreatedByUserID)
              OUTPUT INSERTED.ItemID
              VALUES (@c,@he,@en,@s,@u,1,GETDATE(),@cu)`);
    const itemId = newItem.recordset[0].ItemID;

    // Create supplier link
    await pool.request()
      .input('item', sql.Int,         itemId)
      .input('sup',  sql.Int,         SupplierID)
      .input('sku',  sql.NVarChar(30), SupplierSKU)
      .query(`INSERT INTO tblItemSupplierLinks (ItemID,SupplierID,SupplierPartNo,IsPrimary,IsActive)
              VALUES (@item,@sup,@sku,1,1)`);

    // Mark link approved
    await pool.request().input('id', sql.BigInt, itemLinkId)
      .query(`UPDATE tblItemLinks SET IsTempSKU=0, UpdatedAt=GETDATE() WHERE ItemLinkID=@id`);

    // Close queue
    await pool.request()
      .input('id',  sql.BigInt, queueId)
      .input('ri',  sql.Int,    itemId)
      .input('uid', sql.Int,    req.user?.userId || null)
      .query(`UPDATE tblCatalogQueue
              SET Decision='CREATED', ResultItemID=@ri, ProcessedAt=GETDATE(), AssignedToUserID=@uid
              WHERE QueueID=@id`);

    ok(res, { created: true, itemId }, 'פריט חדש נוצר ומק"ט קושר');
  } catch (e) { err(res, e); }
});

// POST /api/catalog/decide/skip
router.post('/decide/skip', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const { queueId } = req.body;
    await pool.request()
      .input('id',  sql.BigInt, queueId)
      .input('uid', sql.Int,    req.user?.userId || null)
      .query(`UPDATE tblCatalogQueue SET Decision='SKIPPED', ProcessedAt=GETDATE(), AssignedToUserID=@uid WHERE QueueID=@id`);
    ok(res, { skipped: true });
  } catch (e) { err(res, e); }
});

// ─── ITEMS SEARCH (for cataloger to pick existing item) ───────

// GET /api/catalog/items-search?q=...
router.get('/items-search', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const q = (req.query.q || '').trim();
    if (!q) return ok(res, []);

    const r = await pool.request()
      .input('q1', sql.NVarChar(100), `%${q}%`)
      .input('q2', sql.NVarChar(100), `%${q}%`)
      .input('q3', sql.NVarChar(20),  `%${q}%`)
      .query(`
        SELECT TOP 20
          i.ItemID, i.ItemCode, i.NameHE, i.NameEN,
          isl.SupplierPartNo AS SupplierSKU,
          s.SupplierName
        FROM tblItems i
        LEFT JOIN tblItemSupplierLinks isl ON isl.ItemID=i.ItemID AND isl.IsPrimary=1 AND isl.IsActive=1
        LEFT JOIN tblSuppliers s ON s.SupplierID=isl.SupplierID
        WHERE i.IsActive=1 AND (i.NameHE LIKE @q1 OR i.NameEN LIKE @q2 OR i.ItemCode LIKE @q3 OR isl.SupplierPartNo LIKE @q3)
        ORDER BY i.NameHE
      `);
    ok(res, r.recordset);
  } catch (e) { err(res, e); }
});

// GET /api/catalog/item-link/:itemLinkId  — full detail of a link
router.get('/item-link/:itemLinkId', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().input('id', sql.BigInt, +req.params.itemLinkId).query(`
      SELECT il.*, s.SupplierName, c.CustomerName, u.UOMCode,
        i.ItemID, i.ItemCode, i.NameHE AS ItemNameHE, i.NameEN AS ItemNameEN
      FROM tblItemLinks il
      LEFT JOIN tblSuppliers s ON s.SupplierID = il.SupplierID
      LEFT JOIN tblCustomers c ON c.CustomerID = il.CustomerID
      LEFT JOIN tblUnitsOfMeasure u ON u.UOMID  = il.UOMID
      LEFT JOIN tblItemSupplierLinks isl ON isl.SupplierID=il.SupplierID AND isl.SupplierPartNo=il.SupplierSKU AND isl.IsActive=1
      LEFT JOIN tblItems i ON i.ItemID = isl.ItemID
      WHERE il.ItemLinkID=@id
    `);
    if (!r.recordset.length) return err(res, { message: 'לא נמצא' }, 404);
    ok(res, r.recordset[0]);
  } catch (e) { err(res, e); }
});

// GET /api/catalog/pending-links  — all IsTempSKU=1 not yet in queue
router.get('/pending-links', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT il.ItemLinkID, il.SupplierID, il.SupplierSKU, il.CustomerID, il.CustomerSKU, il.CustomerSKUDesc, il.CreatedAt,
        s.SupplierName, c.CustomerName
      FROM tblItemLinks il
      LEFT JOIN tblSuppliers s ON s.SupplierID=il.SupplierID
      LEFT JOIN tblCustomers c ON c.CustomerID=il.CustomerID
      WHERE il.IsTempSKU=1 AND il.IsActive=1
        AND NOT EXISTS (SELECT 1 FROM tblCatalogQueue q WHERE q.ItemLinkID=il.ItemLinkID AND q.AIStatus IN ('PENDING','PROCESSING','DONE'))
      ORDER BY il.CreatedAt DESC
    `);
    ok(res, r.recordset);
  } catch (e) { err(res, e); }
});

module.exports = router;
