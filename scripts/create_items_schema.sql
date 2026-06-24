-- =============================================================================
-- ARCHEM — Item Management Schema
-- Database: ARCHEM (new)
-- Created: 2026-06-17
-- Migrated from: DB_ARACHIM_TEST.dbo.B_PRITIM + B_PRITIM1 + B_SIVUGIM
-- =============================================================================
-- ERD (see bottom of file for full diagram)
-- =============================================================================
USE ARCHEM;
GO

-- =============================================================================
-- 1. tblUnitsOfMeasure
--    Source: DB_ARACHIM_TEST.dbo.B_Y_MIDA
--    Referenced by: tblItems.UOMID
-- =============================================================================
IF OBJECT_ID('dbo.tblUnitsOfMeasure','U') IS NULL
BEGIN
  CREATE TABLE dbo.tblUnitsOfMeasure (
    UOMID       SMALLINT      IDENTITY(1,1) NOT NULL,
    UOMCode     NVARCHAR(10)  NOT NULL,
    NameHE      NVARCHAR(40)  NOT NULL,
    NameEN      NVARCHAR(40)  NOT NULL,
    IsActive    BIT           NOT NULL DEFAULT 1,
    CreatedAt   DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT PK_tblUnitsOfMeasure PRIMARY KEY (UOMID),
    CONSTRAINT UQ_tblUnitsOfMeasure_Code UNIQUE (UOMCode)
  );
  PRINT 'Created tblUnitsOfMeasure';
END
GO

-- Seed common units (extend as needed from B_Y_MIDA)
IF NOT EXISTS (SELECT 1 FROM tblUnitsOfMeasure WHERE UOMCode = 'UNIT')
BEGIN
  SET IDENTITY_INSERT dbo.tblUnitsOfMeasure ON;
  INSERT INTO dbo.tblUnitsOfMeasure (UOMID, UOMCode, NameHE, NameEN) VALUES
    (1,  'UNIT', 'יחידה',       'Unit'),
    (2,  'Kg',   'ק"ג',          'Kg'),
    (3,  'g',    'גרם',          'Gram'),
    (4,  'MT',   'טון',          'Metric Ton'),
    (5,  'L',    'ליטר',         'Liter'),
    (6,  'mL',   'מיליליטר',    'mL'),
    (7,  'Box',  'קרטון',        'Box'),
    (8,  'Pcs',  'חתיכה',       'Piece'),
    (9,  'Bag',  'שק',           'Bag'),
    (10, 'Can',  'פחית',         'Can'),
    (11, 'Drum', 'חבית',         'Drum'),
    (12, 'Pail', 'דלי',          'Pail');
  SET IDENTITY_INSERT dbo.tblUnitsOfMeasure OFF;
  PRINT 'Seeded tblUnitsOfMeasure';
END
GO

-- =============================================================================
-- 2. tblItemCategories
--    Source: DB_ARACHIM_TEST.dbo.B_SIVUGIM
--    Purpose: Classification lookup table per supplier × level
--    Note: In old system SIVUG1-SIVUG10 were INT codes per supplier.
--          This table stores the code↔name mapping.
-- =============================================================================
IF OBJECT_ID('dbo.tblItemCategories','U') IS NULL
BEGIN
  CREATE TABLE dbo.tblItemCategories (
    CategoryID    INT           IDENTITY(1,1) NOT NULL,
    SupplierID    INT           NULL,                    -- NULL = global category
    LevelNo       TINYINT       NOT NULL,                -- 1–10 (was SIVUG_NO)
    LevelName     NVARCHAR(40)  NULL,                    -- e.g. 'FORMAT','KOSHER' (SHEM_SIVUG)
    CategoryCode  INT           NOT NULL,                -- numeric code (KOD)
    CategoryName  NVARCHAR(80)  NOT NULL,                -- human name  (KOD_NAME)
    IsActive      BIT           NOT NULL DEFAULT 1,
    CreatedAt     DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT PK_tblItemCategories PRIMARY KEY (CategoryID),
    CONSTRAINT UQ_tblItemCategories_Key UNIQUE (SupplierID, LevelNo, CategoryCode),
    CONSTRAINT FK_tblItemCategories_Supplier
      FOREIGN KEY (SupplierID) REFERENCES dbo.tblSuppliers(SupplierID)
  );
  PRINT 'Created tblItemCategories';
END
GO

-- =============================================================================
-- 3. tblItems
--    Source: DB_ARACHIM_TEST.dbo.B_PRITIM (primary)
--            DB_ARACHIM_TEST.dbo.B_PRITIM1 (Hebrew name, additional fields)
--    PK: ItemID (IDENTITY) — new surrogate key
--    LegacyItemNo: preserved from B_PRITIM.Item_No for cross-reference
-- =============================================================================
IF OBJECT_ID('dbo.tblItems','U') IS NULL
BEGIN
  CREATE TABLE dbo.tblItems (
    -- PK
    ItemID                INT           IDENTITY(1,1) NOT NULL,

    -- Legacy reference (B_PRITIM.Item_No — kept for migration traceability)
    LegacyItemNo          INT           NULL,

    -- Part codes
    ItemCode              NVARCHAR(20)  NULL,            -- Makat_Arachim (internal code)
    BarCode               NVARCHAR(30)  NULL,            -- future use

    -- Names
    NameEN                NVARCHAR(100) NOT NULL,        -- Shem_Parit / Part_Name_ENG
    NameHE                NVARCHAR(100) NULL,            -- Part_Name_HEB (from B_PRITIM1)

    -- Default supplier & pricing (can override in tblItemSupplierLinks)
    DefaultSupplierID     INT           NULL,
    DefaultCurrencyID     SMALLINT      NULL,
    UnitPrice             DECIMAL(18,4) NULL,            -- supplier price
    UnitPriceCustomer     DECIMAL(18,4) NULL,            -- customer price
    PricePerQty           INT           NULL DEFAULT 1,  -- denominator: 1000 = per 1000 units

    -- Logistics
    ProductionCountryID   INT           NULL,            -- Production_Country → tblCountries
    UOMID                 SMALLINT      NULL,            -- Unit → tblUnitsOfMeasure
    ShelfLifeMonths       SMALLINT      NULL,            -- Pag_Tokef_Hodashim
    MinOrderLevel         DECIMAL(18,4) NULL,            -- Minmal_Level_To_OIrder
    ReorderQty            DECIMAL(18,4) NULL,            -- Qty_To_Order

    -- Customs
    CustomsCode           NVARCHAR(20)  NULL,            -- Prat_Meches (פרט מכס)
    CustomsPayer          NVARCHAR(10)  NULL,            -- Meshalem_Meches (ממשלם מכס)

    -- Free-text fields (T1-T6 from old system)
    TextNote1             NVARCHAR(100) NULL,
    TextNote2             NVARCHAR(100) NULL,
    TextNote3             NVARCHAR(100) NULL,
    Notes                 NVARCHAR(1000) NULL,

    -- Audit
    IsActive              BIT           NOT NULL DEFAULT 1,
    CreatedAt             DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    UpdatedAt             DATETIME2     NULL,
    CreatedByUserID       INT           NULL,

    CONSTRAINT PK_tblItems PRIMARY KEY (ItemID),
    CONSTRAINT UQ_tblItems_LegacyNo   UNIQUE (LegacyItemNo),
    CONSTRAINT FK_tblItems_Supplier   FOREIGN KEY (DefaultSupplierID)   REFERENCES dbo.tblSuppliers(SupplierID),
    CONSTRAINT FK_tblItems_Currency   FOREIGN KEY (DefaultCurrencyID)   REFERENCES dbo.tblCurrencies(CurrencyID),
    CONSTRAINT FK_tblItems_Country    FOREIGN KEY (ProductionCountryID) REFERENCES dbo.tblCountries(CountryID),
    CONSTRAINT FK_tblItems_UOM        FOREIGN KEY (UOMID)               REFERENCES dbo.tblUnitsOfMeasure(UOMID)
  );
  CREATE INDEX IX_tblItems_ItemCode    ON dbo.tblItems (ItemCode);
  CREATE INDEX IX_tblItems_LegacyNo   ON dbo.tblItems (LegacyItemNo);
  CREATE INDEX IX_tblItems_NameEN     ON dbo.tblItems (NameEN);
  PRINT 'Created tblItems';
END
GO

-- =============================================================================
-- 4. tblItemClassifications
--    Replaces SIVUG1-SIVUG10 columns — normalized link table
--    One row per (item, level) → references tblItemCategories
-- =============================================================================
IF OBJECT_ID('dbo.tblItemClassifications','U') IS NULL
BEGIN
  CREATE TABLE dbo.tblItemClassifications (
    ItemClassificationID INT      IDENTITY(1,1) NOT NULL,
    ItemID               INT      NOT NULL,
    CategoryID           INT      NOT NULL,
    CONSTRAINT PK_tblItemClassifications PRIMARY KEY (ItemClassificationID),
    CONSTRAINT UQ_tblItemClassifications UNIQUE (ItemID, CategoryID),
    CONSTRAINT FK_tblItemClass_Item     FOREIGN KEY (ItemID)     REFERENCES dbo.tblItems(ItemID),
    CONSTRAINT FK_tblItemClass_Category FOREIGN KEY (CategoryID) REFERENCES dbo.tblItemCategories(CategoryID)
  );
  PRINT 'Created tblItemClassifications';
END
GO

-- =============================================================================
-- 5. tblItemSupplierLinks
--    Many-to-many: item ↔ supplier, with part number and pricing per supplier
--    Source: B_PRITIM.Supplier_No + Makat_Sapak (primary supplier row)
--            B_PRITIM1_SUPPLIERS (additional supplier rows — if exists)
-- =============================================================================
IF OBJECT_ID('dbo.tblItemSupplierLinks','U') IS NULL
BEGIN
  CREATE TABLE dbo.tblItemSupplierLinks (
    ItemSupplierID  INT           IDENTITY(1,1) NOT NULL,
    ItemID          INT           NOT NULL,
    SupplierID      INT           NOT NULL,
    SupplierPartNo  NVARCHAR(30)  NULL,            -- Makat_Sapak (מק"ט ספק)
    UnitPrice       DECIMAL(18,4) NULL,
    CurrencyID      SMALLINT      NULL,
    IsPrimary       BIT           NOT NULL DEFAULT 0,
    IsActive        BIT           NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    UpdatedAt       DATETIME2     NULL,
    CONSTRAINT PK_tblItemSupplierLinks PRIMARY KEY (ItemSupplierID),
    CONSTRAINT UQ_tblItemSupplierLinks  UNIQUE (ItemID, SupplierID),
    CONSTRAINT FK_tblISL_Item       FOREIGN KEY (ItemID)     REFERENCES dbo.tblItems(ItemID),
    CONSTRAINT FK_tblISL_Supplier   FOREIGN KEY (SupplierID) REFERENCES dbo.tblSuppliers(SupplierID),
    CONSTRAINT FK_tblISL_Currency   FOREIGN KEY (CurrencyID) REFERENCES dbo.tblCurrencies(CurrencyID)
  );
  PRINT 'Created tblItemSupplierLinks';
END
GO

-- =============================================================================
-- 6. tblItemRegulations
--    One row per (item × regulation type) — replaces 14 DARUSH_*/MEUSHAR_* columns
--    RegulationCode values: HEALTH_MINISTRY | STANDARDS_INST | HAZARDOUS |
--                           KOSHER | VETERINARY | PHARMACY | PLANT_PROT
-- =============================================================================
IF OBJECT_ID('dbo.tblItemRegulations','U') IS NULL
BEGIN
  CREATE TABLE dbo.tblItemRegulations (
    ItemRegulationID  INT           IDENTITY(1,1) NOT NULL,
    ItemID            INT           NOT NULL,
    RegulationCode    NVARCHAR(30)  NOT NULL,   -- see constants above
    IsRequired        BIT           NOT NULL DEFAULT 0,    -- DARUSH_*
    IsApproved        BIT           NOT NULL DEFAULT 0,    -- MEUSHAR_*
    ApprovalType      SMALLINT      NULL,                  -- MEUSHAR_*_SUG
    ExpiryDate        DATE          NULL,                  -- TAARICH_TOKEF_* (was char 8 YYYYMMDD)
    UpdatedAt         DATETIME2     NULL,
    CONSTRAINT PK_tblItemRegulations PRIMARY KEY (ItemRegulationID),
    CONSTRAINT UQ_tblItemRegulations  UNIQUE (ItemID, RegulationCode),
    CONSTRAINT FK_tblItemReg_Item FOREIGN KEY (ItemID) REFERENCES dbo.tblItems(ItemID)
  );
  PRINT 'Created tblItemRegulations';
END
GO

-- =============================================================================
-- 7. FK: tblOrderLines.ItemID → tblItems (add column if not exists)
--    In the old design ItemLinkID was used. We add ItemID as a proper FK.
-- =============================================================================
IF COL_LENGTH('dbo.tblOrderLines','ItemID') IS NULL
BEGIN
  ALTER TABLE dbo.tblOrderLines
    ADD ItemID INT NULL
    CONSTRAINT FK_tblOrderLines_Item FOREIGN KEY REFERENCES dbo.tblItems(ItemID);
  PRINT 'Added ItemID FK to tblOrderLines';
END
GO


-- =============================================================================
-- MIGRATION SECTION
-- Runs once: copies data from DB_ARACHIM_TEST into ARCHEM
-- =============================================================================

-- ── 7. Migrate categories from B_SIVUGIM ─────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.tblItemCategories)
BEGIN
  -- Map old Supplier_No (SAPAK) → SupplierID via tblSuppliers.LegacySupplierNo
  -- (assumes tblSuppliers was already migrated and has a LegacySupplierNo column)
  INSERT INTO dbo.tblItemCategories
    (SupplierID, LevelNo, LevelName, CategoryCode, CategoryName)
  SELECT
    s.SupplierID,
    sv.SIVUG_NO,
    NULLIF(RTRIM(sv.SHEM_SIVUG), ''),
    sv.KOD,
    ISNULL(NULLIF(RTRIM(sv.KOD_NAME), ''), '—')
  FROM DB_ARACHIM_TEST.dbo.B_SIVUGIM sv
  LEFT JOIN dbo.tblSuppliers s
         ON TRY_CAST(s.Notes AS NVARCHAR(20)) = CAST(sv.SAPAK AS NVARCHAR(20))
         -- Fallback join: if Notes doesn't hold legacy no, join via LegacySupplierNo column
  WHERE sv.SIVUG_NO BETWEEN 1 AND 10
    AND sv.KOD > 0;                   -- skip placeholder code 0

  PRINT CONCAT('Migrated ', @@ROWCOUNT, ' category rows into tblItemCategories');
END
GO

-- ── 8. Migrate items from B_PRITIM + B_PRITIM1 ───────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.tblItems)
BEGIN
  -- Resolve UOM: map old char(4) unit codes to UOMID
  ;WITH UOMMap AS (
    SELECT UOMCode, UOMID FROM dbo.tblUnitsOfMeasure
  ),
  OldItems AS (
    SELECT
      p.Item_No,
      RTRIM(p.Shem_Parit)                            AS NameEN,
      ISNULL(RTRIM(p1.Part_Name_HEB), '')            AS NameHE,
      RTRIM(NULLIF(p.Makat_Arachim,''))              AS ItemCode,
      p.Supplier_No                                  AS LegacySupplierNo,
      p.Currency                                     AS LegacyCurrencyID,
      p.Production_Country                           AS LegacyCountryID,
      RTRIM(NULLIF(p.Unit,''))                       AS UOMCode,
      p.Price_Per_Qty,
      p.Unit_Price,
      p.Unit_Price_Lakoah,
      p.Pag_Tokef_Hodashim,
      p.Minmal_Level_To_OIrder,
      p.Qty_To_Order,
      RTRIM(NULLIF(p.Prat_Meches,''))                AS CustomsCode,
      ISNULL(NULLIF(RTRIM(p1.Meshalem_Meches),''),NULL) AS CustomsPayer,
      RTRIM(NULLIF(p.T1,''))                         AS TextNote1,
      RTRIM(NULLIF(p.T2,''))                         AS TextNote2,
      RTRIM(NULLIF(p.T3,''))                         AS TextNote3
    FROM DB_ARACHIM_TEST.dbo.B_PRITIM p
    LEFT JOIN DB_ARACHIM_TEST.dbo.B_PRITIM1 p1 ON p1.Part_No = p.Item_No
  )
  INSERT INTO dbo.tblItems
    (LegacyItemNo, ItemCode, NameEN, NameHE,
     DefaultSupplierID, DefaultCurrencyID, ProductionCountryID, UOMID,
     PricePerQty, UnitPrice, UnitPriceCustomer,
     ShelfLifeMonths, MinOrderLevel, ReorderQty,
     CustomsCode, CustomsPayer,
     TextNote1, TextNote2, TextNote3,
     IsActive)
  SELECT
    o.Item_No,
    o.ItemCode,
    ISNULL(NULLIF(o.NameEN,''), '(no name)'),
    NULLIF(o.NameHE,''),
    s.SupplierID,
    c.CurrencyID,
    co.CountryID,
    u.UOMID,
    NULLIF(o.Price_Per_Qty, 0),
    NULLIF(o.Unit_Price, 0),
    NULLIF(o.Unit_Price_Lakoah, 0),
    NULLIF(o.Pag_Tokef_Hodashim, 0),
    NULLIF(o.Minmal_Level_To_OIrder, 0),
    NULLIF(o.Qty_To_Order, 0),
    o.CustomsCode,
    o.CustomsPayer,
    o.TextNote1,
    o.TextNote2,
    o.TextNote3,
    1
  FROM OldItems o
  LEFT JOIN dbo.tblSuppliers s
         ON s.LegacySupplierNo = o.LegacySupplierNo    -- adjust if column name differs
  LEFT JOIN dbo.tblCurrencies c
         ON c.LegacyCurrencyID = o.LegacyCurrencyID    -- adjust if column name differs
  LEFT JOIN dbo.tblCountries co
         ON co.LegacyCountryID = o.LegacyCountryID     -- adjust if column name differs
  LEFT JOIN UOMMap u
         ON u.UOMCode = o.UOMCode;

  PRINT CONCAT('Migrated ', @@ROWCOUNT, ' rows into tblItems');
END
GO

-- ── 9. Migrate primary supplier links ─────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.tblItemSupplierLinks)
BEGIN
  INSERT INTO dbo.tblItemSupplierLinks
    (ItemID, SupplierID, SupplierPartNo, UnitPrice, CurrencyID, IsPrimary)
  SELECT
    i.ItemID,
    s.SupplierID,
    RTRIM(NULLIF(p.Makat_Sapak,'')),
    NULLIF(p.Unit_Price, 0),
    c.CurrencyID,
    1   -- primary supplier
  FROM DB_ARACHIM_TEST.dbo.B_PRITIM p
  JOIN  dbo.tblItems     i ON i.LegacyItemNo      = p.Item_No
  LEFT JOIN dbo.tblSuppliers s ON s.LegacySupplierNo = p.Supplier_No
  LEFT JOIN dbo.tblCurrencies c ON c.LegacyCurrencyID = p.Currency
  WHERE s.SupplierID IS NOT NULL;

  PRINT CONCAT('Migrated ', @@ROWCOUNT, ' rows into tblItemSupplierLinks');
END
GO

-- ── 10. Migrate item classifications (SIVUG1-SIVUG10) ─────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.tblItemClassifications)
BEGIN
  -- Unpivot SIVUG1-SIVUG10 → one row per non-zero classification
  ;WITH Unpivoted AS (
    SELECT Item_No, 1 AS LevelNo, SIVUG1  AS Code FROM DB_ARACHIM_TEST.dbo.B_PRITIM WHERE SIVUG1  > 0 UNION ALL
    SELECT Item_No, 2,            SIVUG2          FROM DB_ARACHIM_TEST.dbo.B_PRITIM WHERE SIVUG2  > 0 UNION ALL
    SELECT Item_No, 3,            SIVUG3          FROM DB_ARACHIM_TEST.dbo.B_PRITIM WHERE SIVUG3  > 0 UNION ALL
    SELECT Item_No, 4,            SIVUG4          FROM DB_ARACHIM_TEST.dbo.B_PRITIM WHERE SIVUG4  > 0 UNION ALL
    SELECT Item_No, 5,            SIVUG5          FROM DB_ARACHIM_TEST.dbo.B_PRITIM WHERE SIVUG5  > 0 UNION ALL
    SELECT Item_No, 6,            SIVUG6          FROM DB_ARACHIM_TEST.dbo.B_PRITIM WHERE SIVUG6  > 0 UNION ALL
    SELECT Item_No, 7,            SIVUG7          FROM DB_ARACHIM_TEST.dbo.B_PRITIM WHERE SIVUG7  > 0 UNION ALL
    SELECT Item_No, 8,            SIVUG8          FROM DB_ARACHIM_TEST.dbo.B_PRITIM WHERE SIVUG8  > 0 UNION ALL
    SELECT Item_No, 9,            SIVUG9          FROM DB_ARACHIM_TEST.dbo.B_PRITIM WHERE SIVUG9  > 0 UNION ALL
    SELECT Item_No, 10,           SIVUG10         FROM DB_ARACHIM_TEST.dbo.B_PRITIM WHERE SIVUG10 > 0
  )
  INSERT INTO dbo.tblItemClassifications (ItemID, CategoryID)
  SELECT i.ItemID, cat.CategoryID
  FROM Unpivoted u
  JOIN dbo.tblItems            i   ON i.LegacyItemNo  = u.Item_No
  JOIN dbo.tblItems            ii  ON ii.ItemID = i.ItemID   -- item exists
  JOIN dbo.tblItemCategories   cat ON cat.LevelNo = u.LevelNo AND cat.CategoryCode = u.Code
  -- Join on supplier for correct category bucket
  JOIN DB_ARACHIM_TEST.dbo.B_PRITIM p ON p.Item_No = u.Item_No
  -- Match category to the item's supplier
  WHERE cat.SupplierID = (
    SELECT TOP 1 SupplierID FROM dbo.tblItemSupplierLinks WHERE ItemID = i.ItemID AND IsPrimary=1
  )
  OR cat.SupplierID IS NULL;

  PRINT CONCAT('Migrated ', @@ROWCOUNT, ' rows into tblItemClassifications');
END
GO

-- ── 11. Migrate regulatory approvals ──────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.tblItemRegulations)
BEGIN
  -- Helper: convert old char(8) date 'YYYYMMDD' → DATE (null if 00000000)
  INSERT INTO dbo.tblItemRegulations
    (ItemID, RegulationCode, IsRequired, IsApproved, ApprovalType, ExpiryDate)
  SELECT i.ItemID, r.RegulationCode, r.IsRequired, r.IsApproved, r.ApprovalType, r.ExpiryDate
  FROM DB_ARACHIM_TEST.dbo.B_PRITIM p
  JOIN dbo.tblItems i ON i.LegacyItemNo = p.Item_No
  CROSS APPLY (VALUES
    ('HEALTH_MINISTRY', p.DARUSH_ISHUR_MISRAD_BRIUT,   p.MEUSHAR_MISRAD_BRIUT,    p.MEUSHAR_MISRAD_BRIUT_SUG, CASE WHEN LEN(RTRIM(p.TAARICH_TOKEF_MISRAD_BRIUT ))=8 AND RTRIM(p.TAARICH_TOKEF_MISRAD_BRIUT )<>'00000000' THEN TRY_CONVERT(DATE,RTRIM(p.TAARICH_TOKEF_MISRAD_BRIUT ), 112) END),
    ('STANDARDS_INST',  p.DARUSH_ISHUR_MACHON_TKANIM,  p.MEUASHAR_MACHON_TKANIM,  p.MEUSHAR_TEKEN_SUG,        CASE WHEN LEN(RTRIM(p.TAARICH_TOKEF_MACHON_TKANIM))=8 AND RTRIM(p.TAARICH_TOKEF_MACHON_TKANIM)<>'00000000' THEN TRY_CONVERT(DATE,RTRIM(p.TAARICH_TOKEF_MACHON_TKANIM), 112) END),
    ('HAZARDOUS',       p.DARUSH_HOMER_MESUKAN,        p.MEUSHAR_HOMER_MESUKAN,   NULL,                       CASE WHEN LEN(RTRIM(p.TAARICH_TOKEF_HOMER_MESUKAN))=8 AND RTRIM(p.TAARICH_TOKEF_HOMER_MESUKAN)<>'00000000' THEN TRY_CONVERT(DATE,RTRIM(p.TAARICH_TOKEF_HOMER_MESUKAN), 112) END),
    ('KOSHER',          p.DARUSH_KASHRUT,              p.MEUSHAR_KASHRUT,         p.MEUSHAR_KASHRUT_SUG,      CASE WHEN LEN(RTRIM(p.TAARICH_TOKEF_KASHRUT     ))=8 AND RTRIM(p.TAARICH_TOKEF_KASHRUT     )<>'00000000' THEN TRY_CONVERT(DATE,RTRIM(p.TAARICH_TOKEF_KASHRUT     ), 112) END),
    ('VETERINARY',      p.DARUSH_VETERINARI,           p.MEUSHAR_VETERINARI,      NULL,                       CASE WHEN LEN(RTRIM(p.TAARICH_TOKEF_VETERINARI   ))=8 AND RTRIM(p.TAARICH_TOKEF_VETERINARI   )<>'00000000' THEN TRY_CONVERT(DATE,RTRIM(p.TAARICH_TOKEF_VETERINARI   ), 112) END),
    ('PHARMACY',        p.DARUSH_RIKCHUT,              p.MEUSHAR_ROKCHUT,         NULL,                       CASE WHEN LEN(RTRIM(p.TAARICH_ROKCHUT           ))=8 AND RTRIM(p.TAARICH_ROKCHUT           )<>'00000000' THEN TRY_CONVERT(DATE,RTRIM(p.TAARICH_ROKCHUT           ), 112) END),
    ('PLANT_PROT',      p.DARUSH_HAGANAT_HATZOMEACH,   p.MEUSHAR_HAGANAT_TZOMEACH,NULL,                       CASE WHEN LEN(RTRIM(p.TAARICH_HACHANAT_TZOMEACH ))=8 AND RTRIM(p.TAARICH_HACHANAT_TZOMEACH )<>'00000000' THEN TRY_CONVERT(DATE,RTRIM(p.TAARICH_HACHANAT_TZOMEACH ), 112) END)
  ) r (RegulationCode, IsRequired, IsApproved, ApprovalType, ExpiryDate)
  WHERE r.IsRequired = 1 OR r.IsApproved = 1;   -- only insert rows where there's actual data

  PRINT CONCAT('Migrated ', @@ROWCOUNT, ' rows into tblItemRegulations');
END
GO

-- ── 12. Link existing tblOrderLines to new tblItems via LegacyItemNo ──────────
-- (Run AFTER both tblItems migration and verifying tblItemLinks structure)
-- UPDATE dbo.tblOrderLines SET ItemID = i.ItemID
-- FROM dbo.tblOrderLines ol
-- JOIN dbo.tblItems i ON i.LegacyItemNo = ol.ItemLinkID   -- adjust join key
-- WHERE ol.ItemID IS NULL;
-- PRINT CONCAT('Linked ', @@ROWCOUNT, ' order lines to tblItems');
-- GO


-- =============================================================================
-- ERD — Entity Relationship Diagram
-- =============================================================================
--
--  tblCountries          tblCurrencies         tblUnitsOfMeasure
--       │  (CountryID)       │  (CurrencyID)        │  (UOMID)
--       │                    │                        │
--       └────────────┬───────┘                        │
--                    │                                │
--  tblSuppliers ─────┤──────────────────────┐         │
--  (SupplierID)      │                      │         │
--       │            │                      ▼         │
--       │            └────────────► tblItems ◄────────┘
--       │                          (ItemID)
--       │                              │
--       │           ┌──────────────────┤──────────────────────┐
--       │           │                  │                       │
--       ▼           ▼                  ▼                       ▼
--  tblItemCategories  tblItemSupplierLinks  tblItemRegulations  tblItemClassifications
--  (CategoryID)       (ItemSupplierID)      (ItemRegulationID)  (ItemClassificationID)
--       │  (SupplierID FK)  │ (SupplierID FK)                       │ (CategoryID FK)
--       │              tblSuppliers                                  │
--       │                                                            │
--       └────────────────────────────────────────────────────────────┘
--                    (tblItemCategories referenced by tblItemClassifications)
--
--  tblOrderLines ──► tblItems (ItemID FK)
--  tblOrders     ──► tblOrderLines (OrderID FK)
--
-- =============================================================================
-- COLUMN MAPPING: Old → New
-- =============================================================================
--
--  B_PRITIM.Item_No              → tblItems.LegacyItemNo
--  B_PRITIM.Shem_Parit           → tblItems.NameEN
--  B_PRITIM1.Part_Name_HEB       → tblItems.NameHE
--  B_PRITIM.Makat_Arachim        → tblItems.ItemCode
--  B_PRITIM.Makat_Sapak          → tblItemSupplierLinks.SupplierPartNo
--  B_PRITIM.Supplier_No          → tblItemSupplierLinks.SupplierID (primary)
--  B_PRITIM.Currency             → tblItems.DefaultCurrencyID
--  B_PRITIM.Production_Country   → tblItems.ProductionCountryID
--  B_PRITIM.Unit                 → tblItems.UOMID (via tblUnitsOfMeasure.UOMCode)
--  B_PRITIM.Price_Per_Qty        → tblItems.PricePerQty
--  B_PRITIM.Unit_Price           → tblItems.UnitPrice / tblItemSupplierLinks.UnitPrice
--  B_PRITIM.Unit_Price_Lakoah    → tblItems.UnitPriceCustomer
--  B_PRITIM.Pag_Tokef_Hodashim   → tblItems.ShelfLifeMonths
--  B_PRITIM.Minmal_Level_To_OIrder → tblItems.MinOrderLevel
--  B_PRITIM.Qty_To_Order         → tblItems.ReorderQty
--  B_PRITIM.Prat_Meches          → tblItems.CustomsCode
--  B_PRITIM1.Meshalem_Meches     → tblItems.CustomsPayer
--  B_PRITIM.T1/T2/T3             → tblItems.TextNote1/2/3
--  B_PRITIM.SIVUG1-SIVUG10       → tblItemClassifications (normalized)
--  B_SIVUGIM (SIVUG_NO+KOD+KOD_NAME+SAPAK) → tblItemCategories
--  B_PRITIM.DARUSH_*/MEUSHAR_*/TAARICH_* → tblItemRegulations (7 rows per item)
--
--  DROPPED (inventory snapshots — calculated from movement tables, not migrated):
--    Open_Balance, Total_Knisot, Total_Yetziot, Total_Hechzerim, Item_Qty
--    Inventory_Value
-- =============================================================================
