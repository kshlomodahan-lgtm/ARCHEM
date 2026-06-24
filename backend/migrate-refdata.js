require('dotenv').config();
const sql = require('mssql');

const cfg = {
  server: process.env.DB_SERVER, database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  options: { trustServerCertificate: true, encrypt: false }
};

async function run() {
  const pool = await sql.connect(cfg);

  const tables = [
    // 1. Banks
    `IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='tblBanks')
     CREATE TABLE dbo.tblBanks (
       BankID      INT           IDENTITY(1,1) NOT NULL PRIMARY KEY,
       BankCode    NVARCHAR(10)  NOT NULL,
       NameHE      NVARCHAR(100) NOT NULL,
       NameEN      NVARCHAR(100) NULL,
       SwiftCode   NVARCHAR(11)  NULL,
       BranchNo    NVARCHAR(10)  NULL,
       IsActive    BIT           NOT NULL DEFAULT 1,
       CreatedAt   DATETIME      NOT NULL DEFAULT GETDATE(),
       UpdatedAt   DATETIME      NOT NULL DEFAULT GETDATE()
     )`,
    // 2. Customs Brokers
    `IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='tblCustomsBrokers')
     CREATE TABLE dbo.tblCustomsBrokers (
       BrokerID    INT           IDENTITY(1,1) NOT NULL PRIMARY KEY,
       NameHE      NVARCHAR(100) NOT NULL,
       NameEN      NVARCHAR(100) NULL,
       LicenseNo   NVARCHAR(30)  NULL,
       ContactName NVARCHAR(100) NULL,
       Phone       NVARCHAR(30)  NULL,
       Email       NVARCHAR(100) NULL,
       Address     NVARCHAR(200) NULL,
       IsActive    BIT           NOT NULL DEFAULT 1,
       CreatedAt   DATETIME      NOT NULL DEFAULT GETDATE(),
       UpdatedAt   DATETIME      NOT NULL DEFAULT GETDATE()
     )`,
    // 3. Forwarders / Freight Forwarders (משלחים)
    `IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='tblForwarders')
     CREATE TABLE dbo.tblForwarders (
       ForwarderID INT           IDENTITY(1,1) NOT NULL PRIMARY KEY,
       NameHE      NVARCHAR(100) NOT NULL,
       NameEN      NVARCHAR(100) NULL,
       ContactName NVARCHAR(100) NULL,
       Phone       NVARCHAR(30)  NULL,
       Email       NVARCHAR(100) NULL,
       Country     NVARCHAR(60)  NULL,
       IsActive    BIT           NOT NULL DEFAULT 1,
       CreatedAt   DATETIME      NOT NULL DEFAULT GETDATE(),
       UpdatedAt   DATETIME      NOT NULL DEFAULT GETDATE()
     )`,
    // 4. Discount Rules (הנחיות - discount terms per supplier/customer)
    `IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='tblDiscountRules')
     CREATE TABLE dbo.tblDiscountRules (
       DiscountID   INT           IDENTITY(1,1) NOT NULL PRIMARY KEY,
       RuleCode     NVARCHAR(20)  NOT NULL,
       Description  NVARCHAR(200) NOT NULL,
       DiscountPct  DECIMAL(5,2)  NOT NULL DEFAULT 0,
       AppliesTo    NVARCHAR(20)  NOT NULL DEFAULT 'ALL',
       ValidFrom    DATE          NULL,
       ValidTo      DATE          NULL,
       Notes        NVARCHAR(500) NULL,
       IsActive     BIT           NOT NULL DEFAULT 1,
       CreatedAt    DATETIME      NOT NULL DEFAULT GETDATE(),
       UpdatedAt    DATETIME      NOT NULL DEFAULT GETDATE()
     )`,
    // 5. Document Types (סוגי מסמכים)
    `IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='tblDocumentTypes')
     CREATE TABLE dbo.tblDocumentTypes (
       DocTypeID    INT           IDENTITY(1,1) NOT NULL PRIMARY KEY,
       DocCode      NVARCHAR(20)  NOT NULL,
       NameHE       NVARCHAR(100) NOT NULL,
       NameEN       NVARCHAR(100) NULL,
       IsMandatory  BIT           NOT NULL DEFAULT 0,
       SortOrder    INT           NOT NULL DEFAULT 0,
       IsActive     BIT           NOT NULL DEFAULT 1,
       CreatedAt    DATETIME      NOT NULL DEFAULT GETDATE(),
       UpdatedAt    DATETIME      NOT NULL DEFAULT GETDATE()
     )`,
    // 6. Printer Parameters (פרמטרים למדפסת)
    `IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='tblPrinterParams')
     CREATE TABLE dbo.tblPrinterParams (
       ParamID      INT           IDENTITY(1,1) NOT NULL PRIMARY KEY,
       CompanyID    INT           NULL,
       ParamKey     NVARCHAR(50)  NOT NULL,
       ParamValue   NVARCHAR(500) NULL,
       Description  NVARCHAR(200) NULL,
       SortOrder    INT           NOT NULL DEFAULT 0,
       IsActive     BIT           NOT NULL DEFAULT 1,
       CreatedAt    DATETIME      NOT NULL DEFAULT GETDATE(),
       UpdatedAt    DATETIME      NOT NULL DEFAULT GETDATE()
     )`,
    // 7. Currency Exchange Rates (שערי מטבע)
    `IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='tblCurrencyRates')
     CREATE TABLE dbo.tblCurrencyRates (
       RateID       INT           IDENTITY(1,1) NOT NULL PRIMARY KEY,
       CurrencyID   INT           NOT NULL,
       RateDate     DATE          NOT NULL,
       RateToILS    DECIMAL(18,6) NOT NULL,
       Source       NVARCHAR(50)  NULL DEFAULT 'MANUAL',
       CreatedAt    DATETIME      NOT NULL DEFAULT GETDATE(),
       CONSTRAINT UQ_CurrencyRate UNIQUE (CurrencyID, RateDate)
     )`,
  ];

  for (const t of tables) {
    await pool.request().query(t);
    const name = (t.match(/name='(\w+)'/) || [])[1];
    console.log(`  ✅ ${name}`);
  }

  // Seed some document types
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM tblDocumentTypes WHERE DocCode='INVOICE')
    INSERT INTO tblDocumentTypes (DocCode, NameHE, NameEN, IsMandatory, SortOrder)
    VALUES
      ('INVOICE',    N'חשבונית',          'Invoice',          1, 10),
      ('PACKING',    N'רשימת אריזה',       'Packing List',     1, 20),
      ('BL',         N'מסמך משלוח B/L',    'Bill of Lading',   1, 30),
      ('COO',        N'תעודת מקור',        'Certificate of Origin', 0, 40),
      ('CERTIFICATE',N'תעודת בדיקה',      'Test Certificate',  0, 50),
      ('INSURANCE',  N'פוליסת ביטוח',     'Insurance Policy',  0, 60),
      ('CUSTOMS',    N'מסמך מכס',         'Customs Document',  1, 70),
      ('CONTRACT',   N'חוזה',             'Contract',          0, 80)
  `);
  console.log('  ✅ DocTypes seeded');

  console.log('\n✅ All migrations complete');
  await pool.close();
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
