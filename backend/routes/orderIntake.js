const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const pdfParse = require('pdf-parse');
const https    = require('https');
const requireAuth      = require('../middleware/auth');
const { sql, getPool } = require('../db');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── POST /api/order-intake/analyze ────────────────────────────────────
router.post('/analyze', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'לא נשלח קובץ' });

    // 1. Extract text from PDF
    const pdfData = await pdfParse(req.file.buffer);
    const text    = pdfData.text;
    if (!text || text.trim().length < 50)
      return res.status(422).json({ success: false, message: 'לא ניתן לחלץ טקסט מהמסמך' });

    // 2. AI extraction
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ success: false, message: 'ANTHROPIC_API_KEY חסר' });

    const raw = await _callClaude(apiKey, _buildPrompt(text));
    let extracted;
    try {
      const clean = raw.replace(/^```json\s*/,'').replace(/\s*```$/,'').trim();
      extracted = JSON.parse(clean);
    } catch {
      return res.status(500).json({ success: false, message: 'AI החזיר תשובה לא תקינה', raw });
    }

    // 3. DB lookups
    const pool = await getPool();
    extracted.toParty   = await _lookupSupplier(pool, extracted.toParty);
    extracted.fromParty = await _lookupCustomer(pool, extracted.fromParty);
    extracted.lines     = await _lookupItems(pool, extracted.lines);

    res.json({ success: true, data: extracted, message: '' });
  } catch (e) {
    res.status(500).json({ success: false, data: null, message: e.message });
  }
});

// ── DB lookup: ספק ────────────────────────────────────────────────────
async function _lookupSupplier(pool, toParty) {
  if (!toParty?.companyName) return { ...toParty, found: false };
  const name = toParty.companyName.trim();

  const r = await pool.request()
    .input('n', sql.NVarChar(100), `%${name}%`)
    .query(`
      SELECT TOP 3
        SupplierID, ShortNameEN, ShortNameHE, FullNameEN, FullNameHE,
        VatNumber, IsActive
      FROM tblSuppliers
      WHERE (ShortNameEN LIKE @n OR ShortNameHE LIKE @n
          OR FullNameEN  LIKE @n OR FullNameHE  LIKE @n)
        AND IsActive = 1
      ORDER BY
        CASE WHEN ShortNameEN = '${name.replace(/'/g,"''")}' THEN 0 ELSE 1 END,
        SupplierID
    `);

  if (!r.recordset.length) return { ...toParty, found: false, candidates: [] };

  const best = r.recordset[0];
  return {
    ...toParty,
    found:       true,
    supplierID:  best.SupplierID,
    systemName:  best.ShortNameEN || best.FullNameEN,
    systemNameHE: best.ShortNameHE || best.FullNameHE,
    isActive:    best.IsActive,
    candidates:  r.recordset.map(s => ({
      supplierID: s.SupplierID,
      name: s.ShortNameEN || s.FullNameEN,
      nameHE: s.ShortNameHE,
    })),
  };
}

// ── DB lookup: לקוח (מפיק ההזמנה) ────────────────────────────────────
async function _lookupCustomer(pool, fromParty) {
  if (!fromParty) return fromParty;
  const regNo = fromParty.companyRegNo?.trim();
  const name  = fromParty.companyName?.trim();

  let r;
  if (regNo) {
    r = await pool.request()
      .input('reg', sql.NVarChar(30), regNo)
      .query(`SELECT TOP 1 CustomerID, ShortNameEN, ShortNameHE, CompanyRegNo, IsActive FROM tblCustomers WHERE CompanyRegNo=@reg AND IsActive=1`);
  }
  if ((!r || !r.recordset.length) && name) {
    r = await pool.request()
      .input('n', sql.NVarChar(100), `%${name}%`)
      .query(`SELECT TOP 1 CustomerID, ShortNameEN, ShortNameHE, CompanyRegNo, IsActive FROM tblCustomers WHERE (ShortNameEN LIKE @n OR FullNameEN LIKE @n) AND IsActive=1 ORDER BY CustomerID`);
  }

  if (!r?.recordset?.length) return { ...fromParty, found: false };
  const best = r.recordset[0];
  return {
    ...fromParty,
    found:      true,
    customerID: best.CustomerID,
    systemName: best.ShortNameEN || best.ShortNameHE,
  };
}

// ── DB lookup: פריטים (B_PRITIM) ─────────────────────────────────────
async function _lookupItems(pool, lines) {
  if (!lines?.length) return lines;

  return Promise.all(lines.map(async line => {
    const partNo = (line.partNumber || '').trim();

    let r;

    // Pass 1: exact match by Makat_Sapak (מק"ט ספק) or Item_No
    if (partNo) {
      r = await pool.request()
        .input('pn', sql.NVarChar(50), partNo)
        .query(`
          SELECT TOP 3
            CAST(Item_No AS NVARCHAR(20)) AS Item_No,
            RTRIM(Shem_Parit) AS Shem_Parit,
            RTRIM(Makat_Sapak) AS Makat_Sapak,
            RTRIM(Unit) AS Unit
          FROM B_PRITIM
          WHERE RTRIM(Makat_Sapak) = @pn OR CAST(Item_No AS NVARCHAR(20)) = @pn
          ORDER BY
            CASE WHEN RTRIM(Makat_Sapak) = @pn THEN 0 ELSE 1 END,
            Item_No
        `);
    }

    // Pass 2: text search on Shem_Parit (description in Hebrew/EN)
    if ((!r || !r.recordset.length) && line.description) {
      const desc = line.description.replace(/[_%]/g, '').trim().substring(0, 30);
      r = await pool.request()
        .input('d', sql.NVarChar(100), `%${desc}%`)
        .query(`
          SELECT TOP 3
            CAST(Item_No AS NVARCHAR(20)) AS Item_No,
            RTRIM(Shem_Parit) AS Shem_Parit,
            RTRIM(Makat_Sapak) AS Makat_Sapak,
            RTRIM(Unit) AS Unit
          FROM B_PRITIM
          WHERE Shem_Parit LIKE @d
          ORDER BY Item_No
        `);
    }

    if (!r?.recordset?.length) return { ...line, found: false, candidates: [] };

    const best     = r.recordset[0];
    const textMatch = _textSimilarity(line.description, best.Shem_Parit);
    const isExact  = partNo && (best.Makat_Sapak === partNo || best.Item_No === partNo);

    return {
      ...line,
      found:          true,
      itemID:         best.Item_No,
      systemItemCode: best.Item_No,
      systemName:     best.Shem_Parit,
      systemNameHE:   best.Shem_Parit,
      supplierPartNo: best.Makat_Sapak,
      unitMatch:      _unitMatch(line.unit, best.Unit, best.Unit),
      textMatchScore: textMatch,
      matchType:      isExact ? 'exact-part' : textMatch > 0.6 ? 'text' : 'partial',
      candidates:     r.recordset.map(i => ({
        itemID: i.Item_No, itemCode: i.Item_No,
        name: i.Shem_Parit,
        supplierPartNo: i.Makat_Sapak,
      })),
    };
  }));
}

// ── Text similarity (simple word-overlap) ─────────────────────────────
function _textSimilarity(a, b) {
  if (!a || !b) return 0;
  const wa = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const wb = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  return common / Math.max(wa.size, wb.size, 1);
}

function _unitMatch(docUnit, sysEN, sysHE) {
  if (!docUnit) return null;
  const d = docUnit.toLowerCase();
  return d === (sysEN||'').toLowerCase() || d === (sysHE||'').toLowerCase();
}

// ── AI Prompt ─────────────────────────────────────────────────────────
function _buildPrompt(text) {
  return `You are a purchase order data extractor. Extract structured data from the purchase order text below.

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "header": {
    "poNumber": "string",
    "orderDate": "DD/MM/YYYY",
    "printDate": "DD/MM/YYYY",
    "deliveryTerms": "string",
    "paymentTerms": "string",
    "shipMethod": "string",
    "vendorNumber": "string",
    "currency": "string",
    "version": "string"
  },
  "fromParty": {
    "companyName": "string",
    "address": "string",
    "city": "string",
    "zipCode": "string",
    "country": "string",
    "phone": "string",
    "fax": "string",
    "companyRegNo": "string",
    "vatNumber": "string",
    "website": "string"
  },
  "toParty": {
    "companyName": "string",
    "address": "string",
    "city": "string",
    "zipCode": "string",
    "country": "string",
    "contactName": "string",
    "phone": "string",
    "fax": "string"
  },
  "lines": [
    {
      "lineNumber": 1,
      "partNumber": "string",
      "description": "string",
      "dueDate": "DD/MM/YYYY",
      "unitPrice": 0.00,
      "discount": 0.00,
      "quantity": 0,
      "unit": "string",
      "extendedPrice": 0.00,
      "manufacturer": "string"
    }
  ],
  "totals": {
    "totalPrice": 0.00,
    "tax": 0.00,
    "grandTotal": 0.00,
    "currency": "string"
  }
}

Rules:
- dates in DD/MM/YYYY format
- numbers: pure numeric only (no commas, no currency symbols)
- missing fields: null
- "fromParty" = company that ISSUED the order (top-left letterhead)
- "toParty" = recipient/supplier ("To:" section)
- extract ALL line items from the table

Purchase Order Text:
${text}`;
}

// ── Anthropic API call ────────────────────────────────────────────────
function _callClaude(apiKey, prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });
    const opts = {
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key':    apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(opts, r => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message));
          resolve(json.content?.[0]?.text || '');
        } catch { reject(new Error('Invalid Anthropic response')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = router;
