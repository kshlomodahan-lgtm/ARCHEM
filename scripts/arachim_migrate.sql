-- =============================================================================
-- DB_ARACHIM_TEST — Full Migration Script
-- Magic XPA / Btrieve → SQUADFLOW Standard (tbl* naming)
-- Generated: 2026-06-12
-- =============================================================================
USE DB_ARACHIM_TEST;
GO

-- Helper macro for char(8) YYYYMMDD date conversion
-- Used inline below: CASE WHEN LEN(RTRIM(col))=8 AND RTRIM(col)<>'00000000'
--                    THEN TRY_CONVERT(date, RTRIM(col), 112) ELSE NULL END

-- =============================================================================
-- 1. tblCompanies  (← A_COMPANIES)
-- =============================================================================
IF OBJECT_ID('dbo.tblCompanies','U') IS NULL
BEGIN
  CREATE TABLE dbo.tblCompanies (
    CompanyID   int          NOT NULL,
    NameHE      nvarchar(50) NULL,
    NameEN      nvarchar(50) NULL,
    Address1    nvarchar(60) NULL,
    Phone1      nvarchar(20) NULL,
    IsActive    bit          NOT NULL DEFAULT 1,
    CONSTRAINT PK_tblCompanies PRIMARY KEY (CompanyID)
  );
  PRINT 'Created tblCompanies';
END
INSERT INTO dbo.tblCompanies (CompanyID, NameHE, NameEN, Address1, Phone1, IsActive)
SELECT
  KOD_TAVLA,
  RTRIM(SHEM_HEVRA_H),
  RTRIM(SHEM_HEVRA_E),
  RTRIM(KTOVET_HEVRA1),
  RTRIM(TEL1),
  CO_IsActive
FROM A_COMPANIES c
WHERE NOT EXISTS (SELECT 1 FROM dbo.tblCompanies WHERE CompanyID = c.KOD_TAVLA);
PRINT 'Inserted tblCompanies: ' + CAST(@@ROWCOUNT AS varchar);
GO

-- =============================================================================
-- 2. tblCurrencies  (← A_CURRENCIES)
-- =============================================================================
IF OBJECT_ID('dbo.tblCurrencies','U') IS NULL
BEGIN
  CREATE TABLE dbo.tblCurrencies (
    CurrencyID     smallint     NOT NULL,
    CurrencyDesc   nvarchar(40) NULL,
    CurrencySymbol nvarchar(5)  NULL,
    IsBase         bit          NOT NULL DEFAULT 0,
    IsActive       bit          NOT NULL DEFAULT 1,
    CONSTRAINT PK_tblCurrencies PRIMARY KEY (CurrencyID)
  );
  PRINT 'Created tblCurrencies';
END
INSERT INTO dbo.tblCurrencies (CurrencyID, CurrencyDesc, CurrencySymbol, IsBase, IsActive)
SELECT
  KOD_TAVLA,
  RTRIM(TEUR_MATBEA),
  RTRIM(SIMUL_MATBEA),
  MATBEA_YIHUS,
  BESHIMUSH
FROM A_CURRENCIES c
WHERE NOT EXISTS (SELECT 1 FROM dbo.tblCurrencies WHERE CurrencyID = c.KOD_TAVLA);
PRINT 'Inserted tblCurrencies: ' + CAST(@@ROWCOUNT AS varchar);
GO

-- =============================================================================
-- 3. tblPaymentTerms  (← A_TNAEY_TASHLUM)
-- Note: PK column name is the Hebrew word מספר
-- =============================================================================
IF OBJECT_ID('dbo.tblPaymentTerms','U') IS NULL
BEGIN
  CREATE TABLE dbo.tblPaymentTerms (
    PaymentTermID smallint      NOT NULL,
    Description1  nvarchar(100) NULL,
    Description2  nvarchar(100) NULL,
    CreditDays    smallint      NULL,
    CONSTRAINT PK_tblPaymentTerms PRIMARY KEY (PaymentTermID)
  );
  PRINT 'Created tblPaymentTerms';
END
INSERT INTO dbo.tblPaymentTerms (PaymentTermID, Description1, Description2, CreditDays)
SELECT
  [מספר],
  RTRIM(TEUR1),
  RTRIM(TEUR2),
  YEMEY_ASHRAI
FROM A_TNAEY_TASHLUM t
WHERE NOT EXISTS (SELECT 1 FROM dbo.tblPaymentTerms WHERE PaymentTermID = t.[מספר]);
PRINT 'Inserted tblPaymentTerms: ' + CAST(@@ROWCOUNT AS varchar);
GO

-- =============================================================================
-- 4. tblSalesDomains  (← A_TCHUMEY_MECHIRA)
-- =============================================================================
IF OBJECT_ID('dbo.tblSalesDomains','U') IS NULL
BEGIN
  CREATE TABLE dbo.tblSalesDomains (
    SalesDomainID smallint     NOT NULL,
    DomainName    nvarchar(50) NULL,
    Prefix        nvarchar(15) NULL,
    IsActive      bit          NOT NULL DEFAULT 1,
    CONSTRAINT PK_tblSalesDomains PRIMARY KEY (SalesDomainID)
  );
  PRINT 'Created tblSalesDomains';
END
INSERT INTO dbo.tblSalesDomains (SalesDomainID, DomainName, Prefix, IsActive)
SELECT
  TCHUM_MECHIRA_MURSHE,
  RTRIM(SHEM),
  RTRIM(KIDOMET),
  SFT_isActive
FROM A_TCHUMEY_MECHIRA t
WHERE NOT EXISTS (SELECT 1 FROM dbo.tblSalesDomains WHERE SalesDomainID = t.TCHUM_MECHIRA_MURSHE);
PRINT 'Inserted tblSalesDomains: ' + CAST(@@ROWCOUNT AS varchar);
GO

-- =============================================================================
-- 5. tblSalesPersons  (← A_ANSHEY_MECHIRA)
-- =============================================================================
IF OBJECT_ID('dbo.tblSalesPersons','U') IS NULL
BEGIN
  CREATE TABLE dbo.tblSalesPersons (
    SalesPersonID smallint     NOT NULL,
    NameHE        nvarchar(40) NULL,
    NameEN        nvarchar(40) NULL,
    RoleCode      char(1)      NULL,
    IsActive      bit          NOT NULL DEFAULT 1,
    CONSTRAINT PK_tblSalesPersons PRIMARY KEY (SalesPersonID)
  );
  PRINT 'Created tblSalesPersons';
END
INSERT INTO dbo.tblSalesPersons (SalesPersonID, NameHE, NameEN, RoleCode, IsActive)
SELECT
  KOD_TAVLA,
  RTRIM(SHEM_H),
  RTRIM(SHEM_E),
  RTRIM(ORECH_MOCHER),
  PAIL
FROM A_ANSHEY_MECHIRA a
WHERE NOT EXISTS (SELECT 1 FROM dbo.tblSalesPersons WHERE SalesPersonID = a.KOD_TAVLA);
PRINT 'Inserted tblSalesPersons: ' + CAST(@@ROWCOUNT AS varchar);
GO

-- =============================================================================
-- 6. tblSuppliers  (← A_SAPAKIM)
-- =============================================================================
IF OBJECT_ID('dbo.tblSuppliers','U') IS NULL
BEGIN
  CREATE TABLE dbo.tblSuppliers (
    SupplierID    int          NOT NULL,
    ShortName     nvarchar(30) NULL,
    FullName      nvarchar(80) NULL,
    Address1      nvarchar(60) NULL,
    Address2      nvarchar(60) NULL,
    City          nvarchar(30) NULL,
    Country       nvarchar(30) NULL,
    ZipCode       nvarchar(20) NULL,
    Phone1        nvarchar(25) NULL,
    Phone2        nvarchar(25) NULL,
    Fax           nvarchar(25) NULL,
    VATNumber     nvarchar(20) NULL,
    PSNPrefix     nvarchar(10) NULL,
    PSNNumerator  int          NULL,
    IsActive      bit          NOT NULL DEFAULT 1,
    CreatedAt     datetime2    NOT NULL DEFAULT SYSDATETIME(),
    UpdatedAt     datetime2    NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT PK_tblSuppliers PRIMARY KEY (SupplierID)
  );
  CREATE INDEX IX_tblSuppliers_FullName ON dbo.tblSuppliers (FullName);
  PRINT 'Created tblSuppliers';
END
INSERT INTO dbo.tblSuppliers
  (SupplierID, ShortName, FullName, Address1, Address2, City, Country, ZipCode,
   Phone1, Phone2, Fax, VATNumber, PSNPrefix, PSNNumerator, IsActive)
SELECT
  KOD_SAPAK,
  RTRIM(SHEM_SAPAK_MEKUTZAR),
  RTRIM(SHEM_SAPAK_MALE),
  RTRIM(KTOVET1),
  RTRIM(KTOVET2),
  RTRIM(IR),
  RTRIM(ERETZ),
  RTRIM(MIKUD),
  RTRIM(TEL1),
  RTRIM(TEL2),
  RTRIM(FAX),
  RTRIM(VAT_NO),
  SUP_PSN_Prefix,
  SUP_PSN_Auto_Numerator,
  1
FROM A_SAPAKIM s
WHERE NOT EXISTS (SELECT 1 FROM dbo.tblSuppliers WHERE SupplierID = s.KOD_SAPAK);
PRINT 'Inserted tblSuppliers: ' + CAST(@@ROWCOUNT AS varchar);
GO

-- =============================================================================
-- 7. tblCustomers  (← A_LAKOHOT)
-- =============================================================================
IF OBJECT_ID('dbo.tblCustomers','U') IS NULL
BEGIN
  CREATE TABLE dbo.tblCustomers (
    CustomerID           int          NOT NULL,
    ShortNameEN          nvarchar(30) NULL,
    FullNameEN           nvarchar(80) NULL,
    ShortNameHE          nvarchar(30) NULL,
    FullNameHE           nvarchar(80) NULL,
    Address1EN           nvarchar(60) NULL,
    CityEN               nvarchar(30) NULL,
    CountryEN            nvarchar(20) NULL,
    ZipCode              nvarchar(15) NULL,
    Phone1               nvarchar(25) NULL,
    Phone2               nvarchar(25) NULL,
    Fax                  nvarchar(25) NULL,
    VATRate              decimal(7,4) NULL,
    CompanyRegNo         nvarchar(20) NULL,
    StatusID             smallint     NULL,
    DefaultCurrencyID    int          NULL,
    DefaultPaymentTermID int          NULL,
    DefaultSalesDomainID int          NULL,
    DeliveryAddressLine1 nvarchar(100) NULL,
    DeliveryAddressLine2 nvarchar(100) NULL,
    DeliveryAddressCity  nvarchar(80) NULL,
    DeliveryAddressZIP   nvarchar(20) NULL,
    Notes                nvarchar(500) NULL,
    PSNPrefix            nvarchar(10) NULL,
    PSNNumerator         int          NULL,
    IsActive             bit          NOT NULL DEFAULT 1,
    CreatedAt            datetime2    NOT NULL DEFAULT SYSDATETIME(),
    UpdatedAt            datetime2    NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT PK_tblCustomers PRIMARY KEY (CustomerID)
  );
  CREATE INDEX IX_tblCustomers_FullNameHE ON dbo.tblCustomers (FullNameHE);
  CREATE INDEX IX_tblCustomers_FullNameEN ON dbo.tblCustomers (FullNameEN);
  PRINT 'Created tblCustomers';
END
INSERT INTO dbo.tblCustomers
  (CustomerID, ShortNameEN, FullNameEN, ShortNameHE, FullNameHE,
   Address1EN, CityEN, CountryEN, ZipCode, Phone1, Phone2, Fax,
   VATRate, CompanyRegNo, StatusID, DefaultCurrencyID, DefaultPaymentTermID,
   DefaultSalesDomainID, DeliveryAddressLine1, DeliveryAddressLine2,
   DeliveryAddressCity, DeliveryAddressZIP, Notes, PSNPrefix, PSNNumerator, IsActive)
SELECT
  KOD_LAKOAH,
  RTRIM(SHEM_LAKOAH_MEKUTZAR_E),
  RTRIM(SHEM_LAKOAH_MURCHAV_E),
  RTRIM(SHEM_LAKOAH_MEKUTZAR_H),
  RTRIM(SHEM_LAKOAH_MURCHAV_H),
  RTRIM(KTOVET1_E),
  RTRIM(IR_E),
  RTRIM(ERETZ_E),
  RTRIM(MIKUD),
  RTRIM(TEL1),
  RTRIM(TEL2),
  RTRIM(FAX),
  CAST(VAT AS decimal(7,4)),
  CompanyNumber,
  CustomerStatus,
  DefaultCurrency,
  CustomerPaymentsTerm,
  SaleCategory,
  DeliveryAddress_Line1,
  DeliveryAddress_Line2,
  DeliveryAddress_City,
  DeliveryAddress_ZIP,
  Remarks,
  CUS_PSN_Prefix,
  CUS_PSN_Auto_Numerator,
  1
FROM A_LAKOHOT l
WHERE NOT EXISTS (SELECT 1 FROM dbo.tblCustomers WHERE CustomerID = l.KOD_LAKOAH);
PRINT 'Inserted tblCustomers: ' + CAST(@@ROWCOUNT AS varchar);
GO

-- =============================================================================
-- 8. tblItemLinks  (← tblSupplierCustomerPSNs)
-- =============================================================================
IF OBJECT_ID('dbo.tblItemLinks','U') IS NULL
BEGIN
  CREATE TABLE dbo.tblItemLinks (
    ItemLinkID        bigint        NOT NULL IDENTITY(1,1),
    SupplierID        int           NOT NULL,
    SupplierSKU       nvarchar(25)  NULL,
    CustomerID        int           NOT NULL,
    CustomerSKU       nvarchar(25)  NULL,
    CustomerSKUDesc   nvarchar(100) NULL,
    UOMID             int           NULL,
    ResponsibleUserID int           NULL,
    CreatedByUserID   int           NULL,
    IsActive          bit           NOT NULL DEFAULT 1,
    IsTempSKU         bit           NOT NULL DEFAULT 0,
    IsGlobalSKU       bit           NOT NULL DEFAULT 0,
    CreatedAt         datetime2     NOT NULL DEFAULT SYSDATETIME(),
    UpdatedAt         datetime2     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT PK_tblItemLinks PRIMARY KEY (ItemLinkID)
  );
  CREATE UNIQUE INDEX UQ_tblItemLinks_SupplierSKU ON dbo.tblItemLinks (SupplierID, SupplierSKU) WHERE SupplierSKU IS NOT NULL;
  CREATE INDEX IX_tblItemLinks_CustomerSKU ON dbo.tblItemLinks (CustomerID, CustomerSKU);
  PRINT 'Created tblItemLinks';
END
INSERT INTO dbo.tblItemLinks
  (SupplierID, SupplierSKU, CustomerID, CustomerSKU, CustomerSKUDesc,
   UOMID, ResponsibleUserID, CreatedByUserID, IsActive)
SELECT
  SCP_SupplierID,
  NULLIF(RTRIM(SCP_SupplierPSN), ''),
  SCP_CustomerID,
  NULLIF(RTRIM(SCP_CustomerPSN), ''),
  SCP_CustomerPSNDesc,
  SCP_UnitsOfMeasure,
  SCP_ResponsableID,
  SCP_UserCreate,
  SCP_IsActive
FROM tblSupplierCustomerPSNs p
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.tblItemLinks
  WHERE SupplierID = p.SCP_SupplierID
    AND ISNULL(SupplierSKU,'') = ISNULL(NULLIF(RTRIM(p.SCP_SupplierPSN),''),'')
    AND CustomerID = p.SCP_CustomerID
);
PRINT 'Inserted tblItemLinks: ' + CAST(@@ROWCOUNT AS varchar);
GO

-- =============================================================================
-- 9. tblOrders  (← A_MAAKAV_SHUROT1 + first line of A_SHUROT_HAZMANA + A_MAAKAV_SHUROT2)
-- A_HAZMANOT does not exist in this DB; MAAKAV_SHUROT1 is the closest order header.
-- =============================================================================
IF OBJECT_ID('dbo.tblOrders','U') IS NULL
BEGIN
  CREATE TABLE dbo.tblOrders (
    OrderID              bigint        NOT NULL IDENTITY(1,1),
    -- Natural key (from old system)
    CompanyID            int           NOT NULL,
    OrderYear            smallint      NOT NULL,
    OrderNumber          int           NOT NULL,
    GroupNo              smallint      NOT NULL DEFAULT 1,
    -- Header (from first order line)
    SupplierID           int           NULL,
    CustomerID           int           NULL,
    CurrencyID           smallint      NULL,
    -- Dates (from A_MAAKAV_SHUROT1)
    OrderDate            date          NULL,
    SupplierOC           nvarchar(20)  NULL,
    SupplierOCDate       date          NULL,
    DesiredDeliveryDate  date          NULL,
    UpdatedDeliveryDate  date          NULL,
    HandoverToShipperDate date         NULL,
    GoodsLeftFactoryDate date          NULL,
    BLNumber             nvarchar(25)  NULL,
    VesselName           nvarchar(60)  NULL,
    ETD                  date          NULL,
    ETA                  date          NULL,
    ATA                  date          NULL,
    HasDocuments         bit           NOT NULL DEFAULT 0,
    PaymentStatusID      int           NULL,
    TransportMode        char(1)       NULL,
    -- Financial summary (from A_MAAKAV_SHUROT2)
    SupplierInvoiceNo    nvarchar(20)  NULL,
    SupplierInvoiceDate  date          NULL,
    InvoiceAmount        decimal(18,3) NULL,
    CustomerPaid         bit           NULL,
    AmountPaidByCustomer decimal(18,3) NULL,
    CommissionReceived   bit           NULL,
    CommissionAmtReceived decimal(18,3) NULL,
    InvoiceIssuedToSupplier bit        NULL,
    -- Aggregated from lines
    TotalValue           decimal(18,3) NULL,
    TotalCommission      decimal(18,3) NULL,
    -- Status flags
    IsFrozen             bit           NOT NULL DEFAULT 0,
    IsCancelled          bit           NOT NULL DEFAULT 0,
    IsImportant          bit           NOT NULL DEFAULT 0,
    IsFrameContract      bit           NOT NULL DEFAULT 0,
    IsActive             bit           NOT NULL DEFAULT 1,
    CreatedAt            datetime2     NOT NULL DEFAULT SYSDATETIME(),
    UpdatedAt            datetime2     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT PK_tblOrders PRIMARY KEY (OrderID)
  );
  CREATE UNIQUE INDEX UQ_tblOrders_NaturalKey
    ON dbo.tblOrders (CompanyID, OrderYear, OrderNumber, GroupNo);
  CREATE INDEX IX_tblOrders_SupplierID   ON dbo.tblOrders (SupplierID);
  CREATE INDEX IX_tblOrders_CustomerID   ON dbo.tblOrders (CustomerID);
  CREATE INDEX IX_tblOrders_OrderDate    ON dbo.tblOrders (OrderDate DESC);
  CREATE INDEX IX_tblOrders_StatusFlags  ON dbo.tblOrders (IsCancelled, IsFrozen, IsImportant);
  PRINT 'Created tblOrders';
END

-- Populate tblOrders
;WITH FirstLine AS (
  -- Get header-level info (supplier, customer, currency) from the first line per order group
  SELECT
    HEVRA, SHANA, MISPAR_HAZMANA_HATZAA, KVUTZA,
    KOD_SAPAK, KOD_LAKOAH, KOD_MATBEA,
    ROW_NUMBER() OVER (PARTITION BY HEVRA,SHANA,MISPAR_HAZMANA_HATZAA,KVUTZA ORDER BY MISPAR) AS rn
  FROM A_SHUROT_HAZMANA
),
LineTotals AS (
  -- Aggregate totals per order group
  SELECT
    HEVRA, SHANA, MISPAR_HAZMANA_HATZAA, KVUTZA,
    SUM(CAST(SACH_HAKOL_LESHURA AS decimal(18,3))) AS TotalValue,
    SUM(CASE SUG_AMALA
      WHEN N'א' THEN CAST(SACH_HAKOL_LESHURA * AHUZ_AMALA / 100.0 AS decimal(18,3))
      WHEN N'ק' THEN CAST(SCHUM_AMALA_MISPARI * KAMUT_BAHAZMANA AS decimal(18,3))
      WHEN N'מ' THEN CAST(AMALA_MISPARIT_MECHIR * AMALA_MISPARIT_LEKAMUT AS decimal(18,3))
      ELSE 0
    END) AS TotalCommission,
    MAX(CASE WHEN HESKEMEY_MISGERET = 1 THEN 1 ELSE 0 END) AS IsFrameContract
  FROM A_SHUROT_HAZMANA
  GROUP BY HEVRA, SHANA, MISPAR_HAZMANA_HATZAA, KVUTZA
)
INSERT INTO dbo.tblOrders
  (CompanyID, OrderYear, OrderNumber, GroupNo,
   SupplierID, CustomerID, CurrencyID,
   OrderDate, SupplierOC, SupplierOCDate, DesiredDeliveryDate, UpdatedDeliveryDate,
   HandoverToShipperDate, GoodsLeftFactoryDate, BLNumber, VesselName,
   ETD, ETA, HasDocuments, PaymentStatusID,
   SupplierInvoiceNo, SupplierInvoiceDate, InvoiceAmount,
   CustomerPaid, AmountPaidByCustomer, CommissionReceived, CommissionAmtReceived,
   InvoiceIssuedToSupplier, TransportMode,
   TotalValue, TotalCommission, IsFrameContract,
   IsFrozen, IsCancelled, IsImportant, IsActive)
SELECT
  m1.HEVRA,
  m1.SHANA,
  m1.MISPAR_HAZMANA,
  m1.KVUTZA,
  -- from first line
  fl.KOD_SAPAK,
  fl.KOD_LAKOAH,
  fl.KOD_MATBEA,
  -- dates from m1 (char8 YYYYMMDD)
  CASE WHEN LEN(RTRIM(m1.TAARICH_HAZMANA))=8 AND RTRIM(m1.TAARICH_HAZMANA)<>'00000000'
       THEN TRY_CONVERT(date, RTRIM(m1.TAARICH_HAZMANA), 112) ELSE NULL END,
  NULLIF(RTRIM(m1.ISHUR_SAPAK_AL_HAZMANA), ''),
  CASE WHEN LEN(RTRIM(m1.TAARICH_ISHUR_SAPAK))=8 AND RTRIM(m1.TAARICH_ISHUR_SAPAK)<>'00000000'
       THEN TRY_CONVERT(date, RTRIM(m1.TAARICH_ISHUR_SAPAK), 112) ELSE NULL END,
  CASE WHEN LEN(RTRIM(m1.TAARICH_ASPAKA_RATZUI))=8 AND RTRIM(m1.TAARICH_ASPAKA_RATZUI)<>'00000000'
       THEN TRY_CONVERT(date, RTRIM(m1.TAARICH_ASPAKA_RATZUI), 112) ELSE NULL END,
  CASE WHEN LEN(RTRIM(m1.TAARICH_ASPAKA_MEUDKAN))=8 AND RTRIM(m1.TAARICH_ASPAKA_MEUDKAN)<>'00000000'
       THEN TRY_CONVERT(date, RTRIM(m1.TAARICH_ASPAKA_MEUDKAN), 112) ELSE NULL END,
  CASE WHEN LEN(RTRIM(m1.TAARICH_MESIRA_LAMESHAGER))=8 AND RTRIM(m1.TAARICH_MESIRA_LAMESHAGER)<>'00000000'
       THEN TRY_CONVERT(date, RTRIM(m1.TAARICH_MESIRA_LAMESHAGER), 112) ELSE NULL END,
  CASE WHEN LEN(RTRIM(m1.TAARICH_YETZIAT_HASCHORA))=8 AND RTRIM(m1.TAARICH_YETZIAT_HASCHORA)<>'00000000'
       THEN TRY_CONVERT(date, RTRIM(m1.TAARICH_YETZIAT_HASCHORA), 112) ELSE NULL END,
  NULLIF(RTRIM(m1.MISPAR_SHTAR_MITAAN), ''),
  NULLIF(RTRIM(m1.SHEM_ONIYA_HEVRAT_TEUFA), ''),
  CASE WHEN LEN(RTRIM(m1.TAARICH_HAFLAGA_TISA))=8 AND RTRIM(m1.TAARICH_HAFLAGA_TISA)<>'00000000'
       THEN TRY_CONVERT(date, RTRIM(m1.TAARICH_HAFLAGA_TISA), 112) ELSE NULL END,
  CASE WHEN LEN(RTRIM(m1.TAARICH_HAGAA_TZAFUI))=8 AND RTRIM(m1.TAARICH_HAGAA_TZAFUI)<>'00000000'
       THEN TRY_CONVERT(date, RTRIM(m1.TAARICH_HAGAA_TZAFUI), 112) ELSE NULL END,
  m1.DOKUMENTIM_KEN_LO,
  m1.OrderPaymentStatusID,
  -- financials from m2 (LEFT JOIN — may not exist)
  NULLIF(RTRIM(m2.HESHBONIT_SAPAK), ''),
  CASE WHEN m2.TAARICH_HESHBONIT_SAPAK IS NOT NULL
            AND LEN(RTRIM(m2.TAARICH_HESHBONIT_SAPAK))=8
            AND RTRIM(m2.TAARICH_HESHBONIT_SAPAK)<>'00000000'
       THEN TRY_CONVERT(date, RTRIM(m2.TAARICH_HESHBONIT_SAPAK), 112) ELSE NULL END,
  CAST(ISNULL(m2.SCHUM_HESHBONIT, 0) AS decimal(18,3)),
  CASE WHEN m2.LAKOAH_SHILEM = 'Y' THEN 1 ELSE 0 END,
  CAST(ISNULL(m2.SCHUM_SHELAKOAH_SHILEM, 0) AS decimal(18,3)),
  CASE WHEN m2.AMALA_HITKABLA = 'Y' THEN 1 ELSE 0 END,
  CAST(ISNULL(m2.SCHUM_AMALA_SHEHITKABLA, 0) AS decimal(18,3)),
  ISNULL(m2.YATZA_HESHBON_LASAPAK, 0),
  NULLIF(RTRIM(ISNULL(m2.AVIR_YAM,'')), ''),
  -- totals from lines
  lt.TotalValue,
  lt.TotalCommission,
  ISNULL(lt.IsFrameContract, 0),
  -- status flags
  ISNULL(m2.MUKPAOT, 0),
  0,  -- IsCancelled: no source column, default 0
  0,  -- IsImportant: no source column, default 0
  1   -- IsActive
FROM A_MAAKAV_SHUROT1 m1
LEFT JOIN A_MAAKAV_SHUROT2 m2
  ON m2.HEVRA = m1.HEVRA AND m2.SHANA = m1.SHANA
 AND m2.MISPAR_HAZMANA_HATZAA = m1.MISPAR_HAZMANA AND m2.KVUTZA = m1.KVUTZA
LEFT JOIN (SELECT * FROM FirstLine WHERE rn = 1) fl
  ON fl.HEVRA = m1.HEVRA AND fl.SHANA = m1.SHANA
 AND fl.MISPAR_HAZMANA_HATZAA = m1.MISPAR_HAZMANA AND fl.KVUTZA = m1.KVUTZA
LEFT JOIN LineTotals lt
  ON lt.HEVRA = m1.HEVRA AND lt.SHANA = m1.SHANA
 AND lt.MISPAR_HAZMANA_HATZAA = m1.MISPAR_HAZMANA AND lt.KVUTZA = m1.KVUTZA
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.tblOrders
  WHERE CompanyID = m1.HEVRA AND OrderYear = m1.SHANA
    AND OrderNumber = m1.MISPAR_HAZMANA AND GroupNo = m1.KVUTZA
);
PRINT 'Inserted tblOrders: ' + CAST(@@ROWCOUNT AS varchar);
GO

-- =============================================================================
-- 10. tblOrderLines  (← A_SHUROT_HAZMANA)
-- =============================================================================
IF OBJECT_ID('dbo.tblOrderLines','U') IS NULL
BEGIN
  CREATE TABLE dbo.tblOrderLines (
    OrderLineID          bigint        NOT NULL IDENTITY(1,1),
    OrderID              bigint        NOT NULL,
    -- Natural key
    CompanyID            int           NOT NULL,
    OrderYear            smallint      NOT NULL,
    OrderNumber          int           NOT NULL,
    GroupNo              smallint      NOT NULL,
    LineNo               smallint      NOT NULL,
    -- Line data
    SupplierID           int           NULL,
    CustomerID           int           NULL,
    SupplierSKU          nvarchar(25)  NULL,
    CustomerSKU          nvarchar(25)  NULL,
    Description          nvarchar(100) NULL,
    Price                decimal(18,3) NULL,
    PerQty               smallint      NULL,
    UOM                  nvarchar(10)  NULL,
    CurrencyID           smallint      NULL,
    QtyOrdered           decimal(18,3) NULL,
    QtyRemaining         decimal(18,3) NULL,
    DiscountPct          decimal(7,4)  NULL,
    LineValue            decimal(18,3) NULL,
    DeliveryDate         date          NULL,
    -- Commission
    CommissionType       char(1)       NULL,  -- א=PCT, ק=FIXED, מ=PER_PRICE
    CommissionPct        decimal(7,4)  NULL,
    CommissionFixed      decimal(18,3) NULL,
    CommissionPerPrice   decimal(18,3) NULL,
    CommissionPerQty     smallint      NULL,
    -- Flags
    IsFrameContract      bit           NOT NULL DEFAULT 0,
    AutoCreateSupplierSKU bit          NOT NULL DEFAULT 0,
    AutoCreateCustomerSKU bit          NOT NULL DEFAULT 0,
    ItemLinkID           bigint        NULL,
    IsActive             bit           NOT NULL DEFAULT 1,
    CreatedAt            datetime2     NOT NULL DEFAULT SYSDATETIME(),
    UpdatedAt            datetime2     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT PK_tblOrderLines PRIMARY KEY (OrderLineID),
    CONSTRAINT FK_tblOrderLines_Order FOREIGN KEY (OrderID) REFERENCES dbo.tblOrders(OrderID)
  );
  CREATE UNIQUE INDEX UQ_tblOrderLines_NaturalKey
    ON dbo.tblOrderLines (CompanyID, OrderYear, OrderNumber, GroupNo, LineNo);
  CREATE INDEX IX_tblOrderLines_OrderID     ON dbo.tblOrderLines (OrderID);
  CREATE INDEX IX_tblOrderLines_SupplierSKU ON dbo.tblOrderLines (SupplierID, SupplierSKU);
  CREATE INDEX IX_tblOrderLines_ItemLinkID  ON dbo.tblOrderLines (ItemLinkID);
  PRINT 'Created tblOrderLines';
END

INSERT INTO dbo.tblOrderLines
  (OrderID, CompanyID, OrderYear, OrderNumber, GroupNo, LineNo,
   SupplierID, CustomerID, SupplierSKU, CustomerSKU, Description,
   Price, PerQty, UOM, CurrencyID, QtyOrdered, QtyRemaining,
   DiscountPct, LineValue, DeliveryDate,
   CommissionType, CommissionPct, CommissionFixed, CommissionPerPrice, CommissionPerQty,
   IsFrameContract, AutoCreateSupplierSKU, AutoCreateCustomerSKU)
SELECT
  o.OrderID,
  s.HEVRA,
  s.SHANA,
  s.MISPAR_HAZMANA_HATZAA,
  s.KVUTZA,
  s.MISPAR,
  s.KOD_SAPAK,
  s.KOD_LAKOAH,
  NULLIF(RTRIM(s.MAKAT_SAPAK), ''),
  NULLIF(RTRIM(s.MAKAT_MEKOMI), ''),
  RTRIM(s.TEUR),
  CAST(s.MECHIR AS decimal(18,3)),
  s.LEKAMUT,
  NULLIF(RTRIM(s.YEHIDAT_MIDA), ''),
  s.KOD_MATBEA,
  CAST(s.KAMUT_BAHAZMANA AS decimal(18,3)),
  CAST(s.KAMUT_NISHEERET AS decimal(18,3)),
  CAST(s.AHUZ_HANAHA AS decimal(7,4)),
  CAST(s.SACH_HAKOL_LESHURA AS decimal(18,3)),
  CASE WHEN LEN(RTRIM(s.MOED_ASPAKA))=8 AND RTRIM(s.MOED_ASPAKA)<>'00000000'
       THEN TRY_CONVERT(date, RTRIM(s.MOED_ASPAKA), 112) ELSE NULL END,
  NULLIF(RTRIM(s.SUG_AMALA), ''),
  CAST(s.AHUZ_AMALA AS decimal(7,4)),
  CAST(s.SCHUM_AMALA_MISPARI AS decimal(18,3)),
  CAST(s.AMALA_MISPARIT_MECHIR AS decimal(18,3)),
  s.AMALA_MISPARIT_LEKAMUT,
  s.HESKEMEY_MISGERET,
  s.CreateAutoSuppllierPSN,
  s.CreateAutoCustomerPSN
FROM A_SHUROT_HAZMANA s
JOIN dbo.tblOrders o
  ON o.CompanyID = s.HEVRA AND o.OrderYear = s.SHANA
 AND o.OrderNumber = s.MISPAR_HAZMANA_HATZAA AND o.GroupNo = s.KVUTZA
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.tblOrderLines
  WHERE CompanyID = s.HEVRA AND OrderYear = s.SHANA
    AND OrderNumber = s.MISPAR_HAZMANA_HATZAA AND GroupNo = s.KVUTZA AND LineNo = s.MISPAR
);
PRINT 'Inserted tblOrderLines: ' + CAST(@@ROWCOUNT AS varchar);
GO

-- =============================================================================
-- 11. Update tblOrderLines.ItemLinkID where SupplierSKU matches tblItemLinks
-- =============================================================================
UPDATE ol
SET ol.ItemLinkID = il.ItemLinkID,
    ol.UpdatedAt  = SYSDATETIME()
FROM dbo.tblOrderLines ol
JOIN dbo.tblItemLinks il
  ON il.SupplierID = ol.SupplierID
 AND il.SupplierSKU = ol.SupplierSKU
 AND il.CustomerID  = ol.CustomerID
WHERE ol.ItemLinkID IS NULL
  AND ol.SupplierSKU IS NOT NULL;
PRINT 'Updated tblOrderLines.ItemLinkID matches: ' + CAST(@@ROWCOUNT AS varchar);
GO

-- =============================================================================
-- 12. Summary report
-- =============================================================================
SELECT 'tblCompanies'     AS tbl, COUNT(*) AS cnt FROM tblCompanies     UNION ALL
SELECT 'tblCurrencies'    AS tbl, COUNT(*) AS cnt FROM tblCurrencies     UNION ALL
SELECT 'tblPaymentTerms'  AS tbl, COUNT(*) AS cnt FROM tblPaymentTerms   UNION ALL
SELECT 'tblSalesDomains'  AS tbl, COUNT(*) AS cnt FROM tblSalesDomains   UNION ALL
SELECT 'tblSalesPersons'  AS tbl, COUNT(*) AS cnt FROM tblSalesPersons   UNION ALL
SELECT 'tblSuppliers'     AS tbl, COUNT(*) AS cnt FROM tblSuppliers      UNION ALL
SELECT 'tblCustomers'     AS tbl, COUNT(*) AS cnt FROM tblCustomers      UNION ALL
SELECT 'tblItemLinks'     AS tbl, COUNT(*) AS cnt FROM tblItemLinks      UNION ALL
SELECT 'tblOrders'        AS tbl, COUNT(*) AS cnt FROM tblOrders         UNION ALL
SELECT 'tblOrderLines'    AS tbl, COUNT(*) AS cnt FROM tblOrderLines;
GO
