const express     = require('express');
const router      = express.Router();
const { sql, getPool } = require('../db');
const requireAuth = require('../middleware/auth');

const ok  = (res, data, msg = 'OK') => res.json({ success: true, data, message: msg });
const err = (res, e, code = 500)    => res.status(code).json({ success: false, message: e.message || e });

// ─── TEMPLATES ───────────────────────────────────────────────

// GET /api/attributes/templates
router.get('/templates', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT t.*,
        (SELECT COUNT(*) FROM tblAttributeFields f WHERE f.AttributeTemplateID = t.AttributeTemplateID AND f.IsActive=1) AS fieldCount
      FROM tblAttributeTemplates t
      ORDER BY t.TemplateName
    `);
    ok(res, r.recordset);
  } catch (e) { err(res, e); }
});

// GET /api/attributes/templates/:id  (with fields + options)
router.get('/templates/:id', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const id   = +req.params.id;
    const t = await pool.request().input('id', sql.Int, id)
      .query(`SELECT * FROM tblAttributeTemplates WHERE AttributeTemplateID=@id`);
    if (!t.recordset.length) return err(res, { message: 'לא נמצא' }, 404);

    const fields = await pool.request().input('id', sql.Int, id)
      .query(`SELECT * FROM tblAttributeFields WHERE AttributeTemplateID=@id AND IsActive=1 ORDER BY DisplayOrder`);

    const fieldIds = fields.recordset.map(f => f.AttributeFieldID);
    let options = [];
    if (fieldIds.length) {
      const o = await pool.request()
        .query(`SELECT * FROM tblAttributeFieldOptions
                WHERE AttributeFieldID IN (${fieldIds.join(',')}) AND IsActive=1
                ORDER BY AttributeFieldID, DisplayOrder`);
      options = o.recordset;
    }

    const result = { ...t.recordset[0], fields: fields.recordset.map(f => ({
      ...f,
      options: options.filter(o => o.AttributeFieldID === f.AttributeFieldID)
    }))};
    ok(res, result);
  } catch (e) { err(res, e); }
});

// POST /api/attributes/templates
router.post('/templates', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const { templateName, description, isComposite, isMandatory } = req.body;
    const r = await pool.request()
      .input('n', sql.NVarChar(100), templateName)
      .input('d', sql.NVarChar(500), description || null)
      .input('c', sql.Bit, isComposite ? 1 : 0)
      .input('m', sql.Bit, isMandatory  ? 1 : 0)
      .input('u', sql.Int, req.user?.userId || null)
      .query(`INSERT INTO tblAttributeTemplates (TemplateName,Description,IsComposite,IsMandatory,CreatedByUserID)
              OUTPUT INSERTED.* VALUES (@n,@d,@c,@m,@u)`);
    ok(res, r.recordset[0], 'תבנית נוצרה');
  } catch (e) { err(res, e); }
});

// PUT /api/attributes/templates/:id
router.put('/templates/:id', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const { templateName, description, isComposite, isMandatory, isActive } = req.body;
    await pool.request()
      .input('id', sql.Int, +req.params.id)
      .input('n',  sql.NVarChar(100), templateName)
      .input('d',  sql.NVarChar(500), description || null)
      .input('c',  sql.Bit, isComposite ? 1 : 0)
      .input('m',  sql.Bit, isMandatory  ? 1 : 0)
      .input('a',  sql.Bit, isActive !== false ? 1 : 0)
      .query(`UPDATE tblAttributeTemplates
              SET TemplateName=@n, Description=@d, IsComposite=@c, IsMandatory=@m, IsActive=@a, UpdatedAt=GETDATE()
              WHERE AttributeTemplateID=@id`);
    ok(res, { id: +req.params.id }, 'תבנית עודכנה');
  } catch (e) { err(res, e); }
});

// DELETE (deactivate) /api/attributes/templates/:id
router.delete('/templates/:id', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', sql.Int, +req.params.id)
      .query(`UPDATE tblAttributeTemplates SET IsActive=0, UpdatedAt=GETDATE() WHERE AttributeTemplateID=@id`);
    ok(res, { deactivated: true });
  } catch (e) { err(res, e); }
});

// ─── FIELDS ──────────────────────────────────────────────────

// POST /api/attributes/fields
router.post('/fields', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const { attributeTemplateId, fieldName, dataType, isRequired, defaultValue, minValue, maxValue, maxLength, displayOrder } = req.body;
    const r = await pool.request()
      .input('t',  sql.Int,          attributeTemplateId)
      .input('n',  sql.NVarChar(100), fieldName)
      .input('dt', sql.NVarChar(20),  dataType)
      .input('r',  sql.Bit,           isRequired ? 1 : 0)
      .input('dv', sql.NVarChar(200), defaultValue || null)
      .input('mn', sql.Decimal(18,4), minValue ?? null)
      .input('mx', sql.Decimal(18,4), maxValue ?? null)
      .input('ml', sql.Int,           maxLength  ?? null)
      .input('o',  sql.TinyInt,       displayOrder ?? 0)
      .query(`INSERT INTO tblAttributeFields (AttributeTemplateID,FieldName,DataType,IsRequired,DefaultValue,MinValue,MaxValue,MaxLength,DisplayOrder)
              OUTPUT INSERTED.* VALUES (@t,@n,@dt,@r,@dv,@mn,@mx,@ml,@o)`);
    ok(res, r.recordset[0], 'שדה נוצר');
  } catch (e) { err(res, e); }
});

// PUT /api/attributes/fields/:id
router.put('/fields/:id', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const { fieldName, dataType, isRequired, defaultValue, minValue, maxValue, maxLength, displayOrder, isActive } = req.body;
    await pool.request()
      .input('id', sql.Int,           +req.params.id)
      .input('n',  sql.NVarChar(100),  fieldName)
      .input('dt', sql.NVarChar(20),   dataType)
      .input('r',  sql.Bit,            isRequired ? 1 : 0)
      .input('dv', sql.NVarChar(200),  defaultValue || null)
      .input('mn', sql.Decimal(18,4),  minValue ?? null)
      .input('mx', sql.Decimal(18,4),  maxValue ?? null)
      .input('ml', sql.Int,            maxLength  ?? null)
      .input('o',  sql.TinyInt,        displayOrder ?? 0)
      .input('a',  sql.Bit,            isActive !== false ? 1 : 0)
      .query(`UPDATE tblAttributeFields
              SET FieldName=@n, DataType=@dt, IsRequired=@r, DefaultValue=@dv,
                  MinValue=@mn, MaxValue=@mx, MaxLength=@ml, DisplayOrder=@o, IsActive=@a
              WHERE AttributeFieldID=@id`);
    ok(res, { id: +req.params.id }, 'שדה עודכן');
  } catch (e) { err(res, e); }
});

// DELETE /api/attributes/fields/:id
router.delete('/fields/:id', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', sql.Int, +req.params.id)
      .query(`UPDATE tblAttributeFields SET IsActive=0 WHERE AttributeFieldID=@id`);
    ok(res, { deactivated: true });
  } catch (e) { err(res, e); }
});

// ─── OPTIONS ─────────────────────────────────────────────────

// POST /api/attributes/options
router.post('/options', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const { attributeFieldId, optionValue, displayOrder } = req.body;
    const r = await pool.request()
      .input('f', sql.Int,          attributeFieldId)
      .input('v', sql.NVarChar(100), optionValue)
      .input('o', sql.TinyInt,       displayOrder ?? 0)
      .query(`INSERT INTO tblAttributeFieldOptions (AttributeFieldID,OptionValue,DisplayOrder)
              OUTPUT INSERTED.* VALUES (@f,@v,@o)`);
    ok(res, r.recordset[0], 'אפשרות נוצרה');
  } catch (e) { err(res, e); }
});

// PUT /api/attributes/options/:id
router.put('/options/:id', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const { optionValue, displayOrder, isActive } = req.body;
    await pool.request()
      .input('id', sql.Int,          +req.params.id)
      .input('v',  sql.NVarChar(100), optionValue)
      .input('o',  sql.TinyInt,       displayOrder ?? 0)
      .input('a',  sql.Bit,           isActive !== false ? 1 : 0)
      .query(`UPDATE tblAttributeFieldOptions SET OptionValue=@v, DisplayOrder=@o, IsActive=@a WHERE OptionID=@id`);
    ok(res, { id: +req.params.id }, 'אפשרות עודכנה');
  } catch (e) { err(res, e); }
});

// DELETE /api/attributes/options/:id
router.delete('/options/:id', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', sql.Int, +req.params.id)
      .query(`UPDATE tblAttributeFieldOptions SET IsActive=0 WHERE OptionID=@id`);
    ok(res, { deactivated: true });
  } catch (e) { err(res, e); }
});

// ─── ITEM LINK ATTRIBUTES (link template → SKU) ───────────────

// GET /api/attributes/item-link/:itemLinkId
router.get('/item-link/:itemLinkId', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const id   = +req.params.itemLinkId;
    const r = await pool.request().input('id', sql.BigInt, id).query(`
      SELECT
        ila.ItemLinkAttrID, ila.ItemLinkID, ila.CreatedAt,
        t.AttributeTemplateID, t.TemplateName, t.IsComposite, t.IsMandatory,
        f.AttributeFieldID, f.FieldName, f.DataType, f.IsRequired, f.DisplayOrder,
        v.ValueID, v.TextValue, v.NumberValue, v.BoolValue, v.DateValue, v.OptionID,
        opt.OptionValue
      FROM tblItemLinkAttributes ila
      JOIN tblAttributeTemplates t ON t.AttributeTemplateID = ila.AttributeTemplateID
      JOIN tblAttributeFields    f ON f.AttributeTemplateID = t.AttributeTemplateID AND f.IsActive=1
      LEFT JOIN tblItemLinkAttributeValues v ON v.ItemLinkAttrID = ila.ItemLinkAttrID AND v.AttributeFieldID = f.AttributeFieldID
      LEFT JOIN tblAttributeFieldOptions opt ON opt.OptionID = v.OptionID
      WHERE ila.ItemLinkID = @id
      ORDER BY t.TemplateName, f.DisplayOrder
    `);

    // group by template
    const grouped = {};
    for (const row of r.recordset) {
      if (!grouped[row.AttributeTemplateID]) {
        grouped[row.AttributeTemplateID] = {
          itemLinkAttrId: row.ItemLinkAttrID,
          templateId: row.AttributeTemplateID,
          templateName: row.TemplateName,
          isComposite: row.IsComposite,
          isMandatory: row.IsMandatory,
          fields: []
        };
      }
      grouped[row.AttributeTemplateID].fields.push({
        fieldId: row.AttributeFieldID,
        fieldName: row.FieldName,
        dataType: row.DataType,
        isRequired: row.IsRequired,
        valueId: row.ValueID,
        textValue: row.TextValue,
        numberValue: row.NumberValue,
        boolValue: row.BoolValue,
        dateValue: row.DateValue,
        optionId: row.OptionID,
        optionValue: row.OptionValue,
      });
    }
    ok(res, Object.values(grouped));
  } catch (e) { err(res, e); }
});

// POST /api/attributes/item-link  (attach template + values to a link)
router.post('/item-link', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const { itemLinkId, attributeTemplateId, values } = req.body;
    // values: [{ attributeFieldId, textValue, numberValue, boolValue, dateValue, optionId }]

    const ila = await pool.request()
      .input('l', sql.BigInt, itemLinkId)
      .input('t', sql.Int,    attributeTemplateId)
      .input('u', sql.Int,    req.user?.userId || null)
      .query(`INSERT INTO tblItemLinkAttributes (ItemLinkID,AttributeTemplateID,CreatedByUserID)
              OUTPUT INSERTED.ItemLinkAttrID VALUES (@l,@t,@u)`);
    const ilaId = ila.recordset[0].ItemLinkAttrID;

    for (const v of (values || [])) {
      await pool.request()
        .input('ila', sql.BigInt,       ilaId)
        .input('f',   sql.Int,          v.attributeFieldId)
        .input('tv',  sql.NVarChar(1000), v.textValue   ?? null)
        .input('nv',  sql.Decimal(18,4), v.numberValue  ?? null)
        .input('bv',  sql.Bit,           v.boolValue    ?? null)
        .input('dv',  sql.Date,          v.dateValue    ?? null)
        .input('ov',  sql.Int,           v.optionId     ?? null)
        .query(`INSERT INTO tblItemLinkAttributeValues
                (ItemLinkAttrID,AttributeFieldID,TextValue,NumberValue,BoolValue,DateValue,OptionID)
                VALUES (@ila,@f,@tv,@nv,@bv,@dv,@ov)`);
    }
    ok(res, { itemLinkAttrId: ilaId }, 'מאפיין קושר למק"ט');
  } catch (e) { err(res, e); }
});

// PUT /api/attributes/item-link/:ilaId/values  (update values)
router.put('/item-link/:ilaId/values', requireAuth, async (req, res) => {
  try {
    const pool  = await getPool();
    const ilaId = +req.params.ilaId;
    const { values } = req.body;

    for (const v of (values || [])) {
      const exists = await pool.request()
        .input('ila', sql.BigInt, ilaId).input('f', sql.Int, v.attributeFieldId)
        .query(`SELECT ValueID FROM tblItemLinkAttributeValues WHERE ItemLinkAttrID=@ila AND AttributeFieldID=@f`);

      if (exists.recordset.length) {
        await pool.request()
          .input('id', sql.BigInt,       exists.recordset[0].ValueID)
          .input('tv', sql.NVarChar(1000), v.textValue  ?? null)
          .input('nv', sql.Decimal(18,4),  v.numberValue ?? null)
          .input('bv', sql.Bit,            v.boolValue   ?? null)
          .input('dv', sql.Date,           v.dateValue   ?? null)
          .input('ov', sql.Int,            v.optionId    ?? null)
          .query(`UPDATE tblItemLinkAttributeValues
                  SET TextValue=@tv, NumberValue=@nv, BoolValue=@bv, DateValue=@dv, OptionID=@ov
                  WHERE ValueID=@id`);
      } else {
        await pool.request()
          .input('ila', sql.BigInt,       ilaId)
          .input('f',   sql.Int,          v.attributeFieldId)
          .input('tv',  sql.NVarChar(1000), v.textValue  ?? null)
          .input('nv',  sql.Decimal(18,4),  v.numberValue ?? null)
          .input('bv',  sql.Bit,            v.boolValue   ?? null)
          .input('dv',  sql.Date,           v.dateValue   ?? null)
          .input('ov',  sql.Int,            v.optionId    ?? null)
          .query(`INSERT INTO tblItemLinkAttributeValues
                  (ItemLinkAttrID,AttributeFieldID,TextValue,NumberValue,BoolValue,DateValue,OptionID)
                  VALUES (@ila,@f,@tv,@nv,@bv,@dv,@ov)`);
      }
    }
    ok(res, { updated: true }, 'ערכים עודכנו');
  } catch (e) { err(res, e); }
});

// DELETE /api/attributes/item-link/:ilaId
router.delete('/item-link/:ilaId', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('id', sql.BigInt, +req.params.ilaId)
      .query(`DELETE FROM tblItemLinkAttributeValues WHERE ItemLinkAttrID=@id`);
    await pool.request().input('id', sql.BigInt, +req.params.ilaId)
      .query(`DELETE FROM tblItemLinkAttributes WHERE ItemLinkAttrID=@id`);
    ok(res, { deleted: true });
  } catch (e) { err(res, e); }
});

module.exports = router;
