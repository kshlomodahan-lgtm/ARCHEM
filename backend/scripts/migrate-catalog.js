const { getPool } = require('../db');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function run() {
  const pool = await getPool();

  console.log('=== ARCHEM Catalog Migration ===\n');

  // 1. tblAttributeTemplates
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='tblAttributeTemplates')
    CREATE TABLE tblAttributeTemplates (
      AttributeTemplateID INT IDENTITY(1,1) PRIMARY KEY,
      TemplateName        NVARCHAR(100) NOT NULL,
      Description         NVARCHAR(500) NULL,
      IsComposite         BIT NOT NULL DEFAULT 0,
      IsMandatory         BIT NOT NULL DEFAULT 0,
      IsActive            BIT NOT NULL DEFAULT 1,
      CreatedByUserID     INT NULL,
      CreatedAt           DATETIME2 NOT NULL DEFAULT GETDATE(),
      UpdatedAt           DATETIME2 NULL
    )
  `);
  console.log('✓ tblAttributeTemplates');

  // 2. tblAttributeFields
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='tblAttributeFields')
    CREATE TABLE tblAttributeFields (
      AttributeFieldID    INT IDENTITY(1,1) PRIMARY KEY,
      AttributeTemplateID INT NOT NULL REFERENCES tblAttributeTemplates(AttributeTemplateID),
      FieldName           NVARCHAR(100) NOT NULL,
      DataType            NVARCHAR(20)  NOT NULL CHECK (DataType IN ('TEXT','NUMBER','BOOL','DATE','LIST','MULTILIST')),
      IsRequired          BIT NOT NULL DEFAULT 0,
      DefaultValue        NVARCHAR(200) NULL,
      MinValue            DECIMAL(18,4) NULL,
      MaxValue            DECIMAL(18,4) NULL,
      MaxLength           INT NULL,
      DisplayOrder        TINYINT NOT NULL DEFAULT 0,
      IsActive            BIT NOT NULL DEFAULT 1
    )
  `);
  console.log('✓ tblAttributeFields');

  // 3. tblAttributeFieldOptions
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='tblAttributeFieldOptions')
    CREATE TABLE tblAttributeFieldOptions (
      OptionID          INT IDENTITY(1,1) PRIMARY KEY,
      AttributeFieldID  INT NOT NULL REFERENCES tblAttributeFields(AttributeFieldID),
      OptionValue       NVARCHAR(100) NOT NULL,
      DisplayOrder      TINYINT NOT NULL DEFAULT 0,
      IsActive          BIT NOT NULL DEFAULT 1
    )
  `);
  console.log('✓ tblAttributeFieldOptions');

  // 4. tblItemLinkAttributes
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='tblItemLinkAttributes')
    CREATE TABLE tblItemLinkAttributes (
      ItemLinkAttrID      BIGINT IDENTITY(1,1) PRIMARY KEY,
      ItemLinkID          BIGINT NOT NULL REFERENCES tblItemLinks(ItemLinkID),
      AttributeTemplateID INT    NOT NULL REFERENCES tblAttributeTemplates(AttributeTemplateID),
      CreatedByUserID     INT NULL,
      CreatedAt           DATETIME2 NOT NULL DEFAULT GETDATE()
    )
  `);
  console.log('✓ tblItemLinkAttributes');

  // 5. tblItemLinkAttributeValues
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='tblItemLinkAttributeValues')
    CREATE TABLE tblItemLinkAttributeValues (
      ValueID          BIGINT IDENTITY(1,1) PRIMARY KEY,
      ItemLinkAttrID   BIGINT NOT NULL REFERENCES tblItemLinkAttributes(ItemLinkAttrID),
      AttributeFieldID INT    NOT NULL REFERENCES tblAttributeFields(AttributeFieldID),
      TextValue        NVARCHAR(1000) NULL,
      NumberValue      DECIMAL(18,4)  NULL,
      BoolValue        BIT            NULL,
      DateValue        DATE           NULL,
      OptionID         INT            NULL REFERENCES tblAttributeFieldOptions(OptionID)
    )
  `);
  console.log('✓ tblItemLinkAttributeValues');

  // 6. tblCatalogQueue
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='tblCatalogQueue')
    CREATE TABLE tblCatalogQueue (
      QueueID           BIGINT IDENTITY(1,1) PRIMARY KEY,
      ItemLinkID        BIGINT NOT NULL REFERENCES tblItemLinks(ItemLinkID),
      AIStatus          NVARCHAR(20) NOT NULL DEFAULT 'PENDING'
                          CHECK (AIStatus IN ('PENDING','PROCESSING','DONE','FAILED')),
      AISuggestions     NVARCHAR(MAX) NULL,
      AssignedToUserID  INT NULL,
      Decision          NVARCHAR(10) NULL CHECK (Decision IN ('LINKED','CREATED','SKIPPED')),
      ResultItemID      INT NULL REFERENCES tblItems(ItemID),
      ProcessedAt       DATETIME2 NULL,
      CreatedAt         DATETIME2 NOT NULL DEFAULT GETDATE()
    )
  `);
  console.log('✓ tblCatalogQueue');

  // Seed a few demo attribute templates
  const existing = await pool.request().query(`SELECT COUNT(*) AS cnt FROM tblAttributeTemplates`);
  if (existing.recordset[0].cnt === 0) {
    console.log('\nSeeding demo templates...');
    const sql = require('mssql');

    // Template 1: כשרות (composite)
    const t1 = await pool.request()
      .input('n', sql.NVarChar(100), 'מפרט כשרות')
      .input('d', sql.NVarChar(500), 'פרטי הכשרות הנדרשים')
      .input('c', sql.Bit, 1).input('m', sql.Bit, 0)
      .query(`INSERT INTO tblAttributeTemplates (TemplateName,Description,IsComposite,IsMandatory)
              OUTPUT INSERTED.AttributeTemplateID
              VALUES (@n,@d,@c,@m)`);
    const tid1 = t1.recordset[0].AttributeTemplateID;

    // Fields for kosher
    const f1 = await pool.request()
      .input('t', sql.Int, tid1).input('n', sql.NVarChar(100), 'סוג כשרות')
      .input('dt', sql.NVarChar(20), 'LIST').input('r', sql.Bit, 1).input('o', sql.TinyInt, 1)
      .query(`INSERT INTO tblAttributeFields (AttributeTemplateID,FieldName,DataType,IsRequired,DisplayOrder)
              OUTPUT INSERTED.AttributeFieldID VALUES (@t,@n,@dt,@r,@o)`);
    const fid1 = f1.recordset[0].AttributeFieldID;
    for (const [i, v] of ['בד"צ','מהדרין','רגיל','ללא כשרות'].entries()) {
      await pool.request().input('f', sql.Int, fid1).input('v', sql.NVarChar(100), v).input('o', sql.TinyInt, i+1)
        .query(`INSERT INTO tblAttributeFieldOptions (AttributeFieldID,OptionValue,DisplayOrder) VALUES (@f,@v,@o)`);
    }
    await pool.request()
      .input('t', sql.Int, tid1).input('n', sql.NVarChar(100), 'תוקף כשרות')
      .input('dt', sql.NVarChar(20), 'DATE').input('r', sql.Bit, 0).input('o', sql.TinyInt, 2)
      .query(`INSERT INTO tblAttributeFields (AttributeTemplateID,FieldName,DataType,IsRequired,DisplayOrder) VALUES (@t,@n,@dt,@r,@o)`);
    await pool.request()
      .input('t', sql.Int, tid1).input('n', sql.NVarChar(100), 'צריך חידוש שנתי')
      .input('dt', sql.NVarChar(20), 'BOOL').input('r', sql.Bit, 0).input('o', sql.TinyInt, 3)
      .query(`INSERT INTO tblAttributeFields (AttributeTemplateID,FieldName,DataType,IsRequired,DisplayOrder) VALUES (@t,@n,@dt,@r,@o)`);
    console.log('  ✓ מפרט כשרות (3 שדות + 4 ערכי LIST)');

    // Template 2: הטבעת לוגו (simple)
    const t2 = await pool.request()
      .input('n', sql.NVarChar(100), 'הטבעת לוגו').input('d', sql.NVarChar(500), 'כולל הטבעת לוגו לקוח על הפריט')
      .input('c', sql.Bit, 0).input('m', sql.Bit, 0)
      .query(`INSERT INTO tblAttributeTemplates (TemplateName,Description,IsComposite,IsMandatory)
              OUTPUT INSERTED.AttributeTemplateID VALUES (@n,@d,@c,@m)`);
    const tid2 = t2.recordset[0].AttributeTemplateID;
    await pool.request()
      .input('t', sql.Int, tid2).input('n', sql.NVarChar(100), 'כולל הטבעת לוגו')
      .input('dt', sql.NVarChar(20), 'BOOL').input('r', sql.Bit, 1).input('o', sql.TinyInt, 1)
      .query(`INSERT INTO tblAttributeFields (AttributeTemplateID,FieldName,DataType,IsRequired,DisplayOrder) VALUES (@t,@n,@dt,@r,@o)`);
    console.log('  ✓ הטבעת לוגו (1 שדה BOOL)');

    // Template 3: מפרט אריזה (composite)
    const t3 = await pool.request()
      .input('n', sql.NVarChar(100), 'מפרט אריזה').input('d', sql.NVarChar(500), 'פרטי האריזה הנדרשים ללקוח')
      .input('c', sql.Bit, 1).input('m', sql.Bit, 0)
      .query(`INSERT INTO tblAttributeTemplates (TemplateName,Description,IsComposite,IsMandatory)
              OUTPUT INSERTED.AttributeTemplateID VALUES (@n,@d,@c,@m)`);
    const tid3 = t3.recordset[0].AttributeTemplateID;
    const f3 = await pool.request()
      .input('t', sql.Int, tid3).input('n', sql.NVarChar(100), 'סוג אריזה')
      .input('dt', sql.NVarChar(20), 'LIST').input('r', sql.Bit, 1).input('o', sql.TinyInt, 1)
      .query(`INSERT INTO tblAttributeFields (AttributeTemplateID,FieldName,DataType,IsRequired,DisplayOrder) OUTPUT INSERTED.AttributeFieldID VALUES (@t,@n,@dt,@r,@o)`);
    const fid3 = f3.recordset[0].AttributeFieldID;
    for (const [i, v] of ['קרטון','פלסטיק','עץ','בד'].entries()) {
      await pool.request().input('f', sql.Int, fid3).input('v', sql.NVarChar(100), v).input('o', sql.TinyInt, i+1)
        .query(`INSERT INTO tblAttributeFieldOptions (AttributeFieldID,OptionValue,DisplayOrder) VALUES (@f,@v,@o)`);
    }
    await pool.request()
      .input('t', sql.Int, tid3).input('n', sql.NVarChar(100), 'כמות ביחידת אריזה')
      .input('dt', sql.NVarChar(20), 'NUMBER').input('r', sql.Bit, 0).input('o', sql.TinyInt, 2)
      .query(`INSERT INTO tblAttributeFields (AttributeTemplateID,FieldName,DataType,IsRequired,DisplayOrder) VALUES (@t,@n,@dt,@r,@o)`);
    await pool.request()
      .input('t', sql.Int, tid3).input('n', sql.NVarChar(100), 'הוראות אריזה מיוחדות')
      .input('dt', sql.NVarChar(20), 'TEXT').input('r', sql.Bit, 0).input('o', sql.TinyInt, 3)
      .query(`INSERT INTO tblAttributeFields (AttributeTemplateID,FieldName,DataType,IsRequired,DisplayOrder) VALUES (@t,@n,@dt,@r,@o)`);
    console.log('  ✓ מפרט אריזה (3 שדות)');
  }

  console.log('\n✅ Migration complete.');
  process.exit(0);
}
run().catch(e => { console.error('❌', e.message); process.exit(1); });
