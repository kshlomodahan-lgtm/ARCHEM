---
name: arachim-db-rename-mapping
description: "מיפוי שמות DB ישנים (Magic XPA / Btrieve) לשמות חדשים לפי סטנדרט SQUADFLOW — טבלאות, עמודות, אינדקסים"
metadata: 
  node_type: memory
  type: project
  originSessionId: 63a148ef-833c-4415-9121-d1c33f81b24c
---

# Arachim — DB Rename Mapping
**תאריך:** 2026-06-11 | **סטנדרט:** SQUADFLOW DB Standards

## כללי שמות (SQUADFLOW Standard)
- טבלה: `tbl[EntityName]` — PascalCase
- PK: `[EntityName]ID` — `OrderID`, `SupplierID`
- FK: `[ReferencedEntity]ID`
- Boolean: `Is[State]` — `IsActive`, `IsCancelled`
- תאריכים: `[Action]At` / `[Action]Date` — `CreatedAt`, `OrderDate`
- Audit בכל טבלה ראשית: `CreatedAt datetime2`, `UpdatedAt datetime2`
- אין hard deletes: `IsActive bit DEFAULT 1`
- Index: `IX_tbl[Entity]_[Column(s)]`
- Unique: `UQ_tbl[Entity]_[Column(s)]`
- PK constraint: `PK_tbl[Entity]`

---

## 1. מיפוי שמות טבלאות

| שם ישן | שם חדש | הערה |
|--------|--------|------|
| `A_HAZMANOT` | `tblOrders` | כותרת הזמנה |
| `A_SHUROT_HAZMANA` | `tblOrderLines` | שורות פריטים |
| `A_MAAKAV_SHUROT1` | `tblShipmentTracking` | מעקב משלוח per group |
| `A_MAAKAV_SHUROT2` | `tblOrderFinancials` | חשבוניות + עמלות (נשאר מאוחד) |
| `A_HESKEMEY_MISGERET` | `tblFrameContractDraws` | משיכות ממסגרת |
| `A_LAKOHOT` | `tblCustomers` | לקוחות |
| `A_SAPAKIM` | `tblSuppliers` | ספקים |
| `A_ANSHEY_KESHER_LAKOAHOT` | `tblCustomerContacts` | אנשי קשר לקוחות |
| `A_ANSHEY_KESHER_SAPAKIM` | `tblSupplierContacts` | אנשי קשר ספקים |
| `A_PRITIM_LESAPAK` | `tblSupplierItems` | קטלוג פריטי ספק |
| `tblSupplierCustomerPSNs` | `tblItemLinks` | קישור ספק↔לקוח (ITEM_LINK) |
| `A_TCHUMEY_MECHIRA` | `tblSalesDomains` | תחומי מכירה |
| `A_TCHUMEY_MECHIRA_MISHTAMESH` | `tblUserSalesDomains` | M:N משתמש↔תחום |
| `A_COMPANIES` | `tblCompanies` | חברות (02/05/06) |
| `A_CURRENCIES` | `tblCurrencies` | מטבעות |
| `A_RATES` | `tblExchangeRates` | שערי חליפין |
| `A_BANK_ISRAEL_RATES` | `tblBankIsraelRates` | שערי בנק ישראל |
| `A_TNAEY_TASHLUM` | `tblPaymentTerms` | תנאי תשלום |
| `A_MISHLOCHIM` | `tblShippingAgents` | חברות שילוח |
| `A_DOCUMENTIM` | `tblDocumentTypes` | סוגי מסמכים (lookup) |
| `A_ANSHEY_MECHIRA` | `tblSalesPersons` | אנשי מכירה |
| `A_AMALOT_MEKUTZAR` | `tblCommissionSummary` | סיכום עמלות חודשי |
| `A_AMALOT_TZFUYOT` | `tblExpectedCommissions` | עמלות צפויות |
| `A_AMILEY_MECHES` | `tblCustomsAgents` | סוכני מכס |
| `A_HANCHAYOT` | `tblOrderInstructions` | הנחיות הדפסה |
| `A_SIOMET_HAZMANA` | `tblOrderFooters` | סיומת הזמנה |
| `A_KOTAROT_TAFRITIM` | `tblMenuHeaders` | כותרות תפריטים |
| `tblOrderPaymentStatus` | `tblOrderPaymentStatuses` | סטטוסי תשלום הזמנה |
| `tblTermsOfSale` | `tblSaleTerms` | Incoterms |
| `tblTypesOfKosher` | `tblKosherTypes` | סוגי כשרות |
| `tblUnitsOfMeasure` | `tblUOM` | יחידות מידה |
| `tblWareHouseList` | `tblWarehouses` | מחסנים |
| `tblCustomerStatus` | `tblCustomerStatuses` | סטטוסי לקוח |
| `tblContainerTypes` | `tblContainerTypes` | ✓ שם תקני |
| `B_CHECKBOXES_OREDR` | ~~deprecated~~ | מוחלף ע"י `tblItemLinkAttributes` |
| `B_PRITIM1_REGULATION` | `tblItemRegulations` | רגולציות פר פריט |
| `tblDataTracker` | ~~deprecated~~ | מוחלף ע"י SQUADFLOW `tblAuditLog` |
| `tblDataTrackerFields` | ~~deprecated~~ | מוחלף ע"י SQUADFLOW `tblAuditEntityTypes` |

### טבלאות חדשות (לא קיימות ב-DB ישן)
| שם חדש | תיאור |
|--------|--------|
| `tblItemAttributeDefs` | הגדרת מאפיינים דינאמיים למק"ט |
| `tblItemLinkAttributes` | ערכי מאפיינים per ITEM_LINK |
| `tblCatalogTasks` | תהליך המקטלג — מק"ט זמני → אמיתי |
| `tblOrderDocuments` | צרופות הזמנה (במקום DOCUMENTIM1-10 בכותרת) |

---

## 2. מיפוי עמודות — tblOrders (מ-A_HAZMANOT)

| שם ישן | שם חדש | טיפוס חדש | הערה |
|--------|--------|-----------|------|
| `HEVRA` | `CompanyID` | int FK | |
| `SHANA` | `OrderYear` | smallint | |
| `MISPAR_HAZMANA` | `OrderNumber` | int | |
| — | `OrderID` | bigint IDENTITY PK | **חדש** — surrogate PK |
| `TAARICH_HAZMANA` | `OrderDate` | date | CONVERT מ-char(8) |
| `TAARICH_HATZAA` | `EntryDate` | date | CONVERT מ-char(8) |
| `SAPAK` | `SupplierID` | int FK |  |
| `ISH_KESHER_SAPAK` | `SupplierContactID` | smallint FK | |
| `MISPAR_HAZMANA_LESAPAK` | `SupplierOCNumber` | smallint | אישור ספק |
| `LAKOAH` | `CustomerID` | int FK | |
| `ISH_KESHER_LAKOAH` | `CustomerContactID` | smallint FK | |
| `BANK_LAKOAH` | `CustomerBankID` | smallint | |
| `ASMACHTA_LAKOAH` | `CustomerRef` | nvarchar(15) | |
| `TNAEY_TASHLUM1` | `PaymentTerms1` | nvarchar(100) | טקסט חופשי — בכוונה |
| `TNAEY_TASHLUM2` | `PaymentTerms2` | nvarchar(100) | |
| `YEMEY_ASHRAI` | `CreditDays` | smallint | |
| `BASIS_TASHLUM` | `PaymentBasis` | char(1) | |
| `NAMAL_MOTZA1` | `PortOfOrigin1` | nvarchar(10) | |
| `NAMAL_MOTZA2` | `PortOfOrigin2` | nvarchar(10) | |
| `MEDINAT_MOTZA` | `CountryOfOrigin` | nvarchar(10) | |
| `NAMAL_YAAD` | `PortOfDestination` | nvarchar(10) | |
| `AVIR_YAM` | `TransportMode` | char(1) | A=Air, Y=Sea |
| `MESHALEACH_CHUL` | `ShippingAgentID` | smallint FK | |
| `AMIL_MECHES` | `CustomsAgentID` | smallint FK | |
| `HEAROT1` | `Notes1` | nvarchar(200) | הרחבה מ-char(54) |
| `HEAROT2` | `Notes2` | nvarchar(200) | |
| `HEAROT3` | `Notes3` | nvarchar(200) | |
| `HEAROT4` | `Notes4` | nvarchar(200) | |
| `HANCHAYOT1` | `Instructions1` | nvarchar(200) | |
| `HANCHAYOT2` | `Instructions2` | nvarchar(200) | |
| `DOCUMENTIM1–10` | ~~dropped~~ | — | → `tblOrderDocuments` |
| `SIOMET_HAZMANA1` | `FooterText1ID` | smallint FK | |
| `SIOMET_HAZMANA2` | `FooterText2ID` | smallint FK | |
| `ISH_MECHIRA` | `SalesPersonID` | smallint FK | עורך ראשי |
| `ORECH_HAZMANA` | `ActualEditorID` | smallint FK | עורך בפועל |
| `HAZMANA_MEVUTELET` | `IsCancelled` | bit | |
| `HAZMANA_MUKPET` | `IsFrozen` | bit | |
| `HAZMANA_HASHUVA` | `IsImportant` | bit | |
| `HESKEMEY_MISGERET` | `IsFrameContract` | bit | |
| `SACH_HAKOL_BAHAZMANA` | `TotalValue` | decimal(18,3) | מ-float |
| `SACH_HAKOL_AMALA` | `TotalCommission` | decimal(18,3) | מ-float |
| `MATBEA` | `CurrencyID` | smallint FK | |
| `THUM_MECHIRA` | `SalesDomainID` | smallint FK | |
| `Order_Type` | `OrderTypeID` | smallint FK | |
| `OnBehalfOf` | `OnBehalfOfID` | smallint | |
| — | `SaleTermsID` | smallint FK | **חדש** — Incoterms |
| — | `IsActive` | bit DEFAULT 1 | **חדש** |
| — | `CreatedAt` | datetime2 | **חדש** |
| — | `UpdatedAt` | datetime2 | **חדש** |

---

## 3. מיפוי עמודות — tblOrderLines (מ-A_SHUROT_HAZMANA)

| שם ישן | שם חדש | טיפוס חדש | הערה |
|--------|--------|-----------|------|
| — | `OrderLineID` | bigint IDENTITY PK | **חדש** surrogate |
| `HEVRA` | `CompanyID` | int FK | |
| `SHANA` | `OrderYear` | smallint | |
| `MISPAR_HAZMANA_HATZAA` | `OrderNumber` | int | |
| `KVUTZA` | `GroupNo` | smallint | קבוצת שורות |
| `MISPAR` | `LineNo` | smallint | מספר בתוך קבוצה |
| `KOD_SAPAK` | `SupplierID` | int FK | |
| `KOD_LAKOAH` | `CustomerID` | int FK | |
| `MAKAT_SAPAK` | `SupplierSKU` | nvarchar(25) | |
| `MAKAT_MEKOMI` | `CustomerSKU` | nvarchar(25) | nullable |
| `TEUR` | `Description` | nvarchar(100) | הרחבה מ-char(40) |
| `MECHIR` | `Price` | decimal(18,3) | מ-float |
| `LEKAMUT` | `PerQty` | smallint | |
| `YEHIDAT_MIDA` | `UOM` | nvarchar(10) | |
| `KOD_MATBEA` | `CurrencyID` | smallint FK | |
| `KAMUT_BAHAZMANA` | `QtyOrdered` | decimal(18,3) | |
| `KAMUT_NISHEERET` | `QtyRemaining` | decimal(18,3) | |
| `AHUZ_HANAHA` | `DiscountPct` | decimal(7,4) | |
| `SACH_HAKOL_LESHURA` | `LineValue` | decimal(18,3) | |
| `SUG_AMALA` | `CommissionType` | char(1) | א=%, ק=fixed, מ=price×qty |
| `AHUZ_AMALA` | `CommissionPct` | decimal(7,4) | |
| `SCHUM_AMALA_MISPARI` | `CommissionFixed` | decimal(18,3) | לסוג ק |
| `AMALA_MISPARIT_MECHIR` | `CommissionPerPrice` | decimal(18,3) | לסוג מ |
| `AMALA_MISPARIT_LEKAMUT` | `CommissionPerQty` | smallint | לסוג מ |
| `MOED_ASPAKA` | `DeliveryDate` | date | CONVERT מ-char(8) |
| `HESKEMEY_MISGERET` | `IsFrameContract` | bit | |
| `CreateAutoSuppllierPSN` | `AutoCreateSupplierSKU` | bit | תיקון שגיאת כתיב |
| `CreateAutoCustomerPSN` | `AutoCreateCustomerSKU` | bit | |
| — | `ItemLinkID` | bigint FK nullable | **חדש** → tblItemLinks |
| — | `SupplierDescSnapshot` | nvarchar(100) | **חדש** — תמונת מצב בעת ההזמנה |
| — | `CreatedAt` | datetime2 | **חדש** |
| — | `UpdatedAt` | datetime2 | **חדש** |

---

## 4. מיפוי עמודות — tblItemLinks (מ-tblSupplierCustomerPSNs)

| שם ישן | שם חדש | טיפוס חדש | הערה |
|--------|--------|-----------|------|
| — | `ItemLinkID` | bigint IDENTITY PK | **חדש** surrogate PK |
| `SCP_SupplierID` | `SupplierID` | int FK | |
| `SCP_SupplierPSN` | `SupplierSKU` | nvarchar(25) | nullable |
| `SCP_CustomerID` | `CustomerID` | int FK | |
| `SCP_CustomerPSN` | `CustomerSKU` | nvarchar(25) | nullable |
| `SCP_CustomerPSNDesc` | `CustomerSKUDesc` | nvarchar(100) | |
| `SCP_UnitsOfMeasure` | `UOMID` | int FK | |
| `SCP_ResponsableID` | `ResponsibleUserID` | int FK | תיקון שגיאת כתיב |
| `SCP_UserCreate` | `CreatedByUserID` | int FK | |
| `SCP_IsActive` | `IsActive` | bit | |
| `SCP_PrintLogo` | ~~moved~~ | — | → tblItemLinkAttributes |
| `SCP_PrintYear` | ~~moved~~ | — | → tblItemLinkAttributes |
| `SCP_RinsingRequired` | ~~moved~~ | — | → tblItemLinkAttributes |
| `SCP_Tradition` | ~~moved~~ | — | → tblItemLinkAttributes |
| `SCP_BurningRequired` | ~~moved~~ | — | → tblItemLinkAttributes |
| `SCP_KosherRequired` | ~~moved~~ | — | → tblItemLinkAttributes |
| — | `IsTempSKU` | bit DEFAULT 0 | **חדש** |
| — | `IsGlobalSKU` | bit DEFAULT 0 | **חדש** — GEN_ prefix |
| — | `CreatedAt` | datetime2 | **חדש** |
| — | `UpdatedAt` | datetime2 | **חדש** |

---

## 5. מיפוי עמודות — tblShipmentTracking (מ-A_MAAKAV_SHUROT1)

| שם ישן | שם חדש | טיפוס חדש | הערה |
|--------|--------|-----------|------|
| — | `ShipmentTrackingID` | bigint IDENTITY PK | **חדש** |
| `HEVRA` | `CompanyID` | int FK | |
| `SHANA` | `OrderYear` | smallint | |
| `MISPAR_HAZMANA` | `OrderNumber` | int | |
| `KVUTZA` | `GroupNo` | smallint | |
| `ISHUR_SAPAK_AL_HAZMANA` | `SupplierOC` | nvarchar(15) | |
| `TAARICH_ISHUR_SAPAK` | `SupplierOCDate` | date | CONVERT |
| `TAARICH_ASPAKA_RATZUI` | `DesiredDeliveryDate` | date | CONVERT |
| `TAARICH_ASPAKA_MEUDKAN` | `UpdatedDeliveryDate` | date | CONVERT |
| `TAARICH_MESIRA_LAMESHAGER` | `HandoverToShipperDate` | date | CONVERT |
| `TAARICH_YETZIAT_HASCHORA` | `GoodsLeftFactoryDate` | date | CONVERT |
| `MISPAR_SHTAR_MITAAN` | `BLNumber` | nvarchar(20) | |
| `SHEM_ONIYA_HEVRAT_TEUFA` | `VesselName` | nvarchar(50) | הרחבה |
| `TAARICH_HAFLAGA_TISA` | `ETD` | date | CONVERT |
| `TAARICH_HAGAA_TZAFUI` | `ETA` | date | CONVERT |
| — | `ATA` | date | **חדש** — תאריך הגעה בפועל |
| `DOKUMENTIM_KEN_LO` | `HasDocuments` | bit | |
| `OrderPaymentStatusID` | `PaymentStatusID` | int FK | |
| `HEVRA_SHANA` | ~~dropped~~ | — | computed legacy |
| — | `CreatedAt` | datetime2 | **חדש** |
| — | `UpdatedAt` | datetime2 | **חדש** |

---

## 6. מיפוי עמודות — tblOrderFinancials (מ-A_MAAKAV_SHUROT2)

| שם ישן | שם חדש | טיפוס חדש | הערה |
|--------|--------|-----------|------|
| — | `OrderFinancialID` | bigint IDENTITY PK | **חדש** |
| `HEVRA` | `CompanyID` | int FK | |
| `SHANA` | `OrderYear` | smallint | |
| `MISPAR_HAZMANA_HATZAA` | `OrderNumber` | int | |
| `KVUTZA` | `GroupNo` | smallint | |
| `HESHBONIT_SAPAK` | `SupplierInvoiceNo` | nvarchar(20) | |
| `TAARICH_HESHBONIT_SAPAK` | `SupplierInvoiceDate` | date | CONVERT |
| `SCHUM_HESHBONIT` | `InvoiceAmount` | decimal(18,3) | |
| `LAKOAH_SHILEM` (char Y/N) | `CustomerPaid` | bit | CONVERT: 'Y'→1 |
| `SCHUM_SHELAKOAH_SHILEM` | `AmountPaidByCustomer` | decimal(18,3) | |
| `YATZA_HESHBON_LASAPAK` | `InvoiceIssuedToSupplier` | bit | |
| `MISPAR_HESHBON_LASAPAK` | `SupplierInvoiceOutNo` | int | |
| `AMALA_HITKABLA` (char Y/N) | `CommissionReceived` | bit | CONVERT: 'Y'→1 |
| `SCHUM_AMALA_SHEHITKABLA` | `CommissionAmountReceived` | decimal(18,3) | |
| `ON_CALL` | `IsOnCall` | bit | |
| `MUKPAOT` | `IsFrozen` | bit | |
| `AVIR_YAM` | `TransportMode` | char(1) | |
| `SAPAK` | `SupplierID` | int FK | |
| `MATBEA` | `CurrencyID` | smallint FK | |
| — | `CreatedAt` | datetime2 | **חדש** |
| — | `UpdatedAt` | datetime2 | **חדש** |

---

## 7. מיפוי עמודות — tblSuppliers (מ-A_SAPAKIM)

| שם ישן | שם חדש |
|--------|--------|
| `KOD_SAPAK` | `SupplierID` |
| `SHEM_SAPAK_MEKUTZAR` | `ShortName` |
| `SHEM_SAPAK_MALE` | `FullName` |
| `KTOVET1` | `Address1` |
| `KTOVET2` | `Address2` |
| `IR` | `City` |
| `MEDINA` | `State` |
| `ERETZ` | `Country` |
| `MIKUD` | `ZipCode` |
| `TEL1` | `Phone1` |
| `TEL2` | `Phone2` |
| `FAX` | `Fax` |
| `KOD_BANK_LETASHLUM_ARACHIM` | `PaymentBankID` |
| `VAT_NO` | `VATNumber` |
| `SUP_PSN_Prefix` | `PSNPrefix` |
| `SUP_PSN_Auto_Numerator` | `PSNNumerator` |
| — | `IsActive` bit DEFAULT 1 |
| — | `CreatedAt` datetime2 |
| — | `UpdatedAt` datetime2 |

---

## 8. מיפוי עמודות — tblCustomers (מ-A_LAKOHOT)

| שם ישן | שם חדש |
|--------|--------|
| `KOD_LAKOAH` | `CustomerID` |
| `SHEM_LAKOAH_MEKUTZAR_E` | `ShortNameEN` |
| `SHEM_LAKOAH_MURCHAV_E` | `FullNameEN` |
| `SHEM_LAKOAH_MEKUTZAR_H` | `ShortNameHE` |
| `SHEM_LAKOAH_MURCHAV_H` | `FullNameHE` |
| `KTOVET1_E` | `Address1EN` |
| `KTOVET2_E` | `Address2EN` |
| `IR_E` | `CityEN` |
| `MEDINA_E` | `StateEN` |
| `ERETZ_E` | `CountryEN` |
| `MIKUD` | `ZipCode` |
| `TEL1` | `Phone1` |
| `TEL2` | `Phone2` |
| `FAX` | `Fax` |
| `VAT` | `VATRate` |
| `CustomerStatus` | `StatusID` |
| `CustomerGroup` | `GroupID` |
| `DefaultOrderType` | `DefaultOrderTypeID` |
| `DefaultCompanyCode` | `DefaultCompanyID` |
| `CustomerPaymentsTerm` | `DefaultPaymentTermID` |
| `SaleCategory` | `DefaultSalesDomainID` |
| `CompanyNumber` | `CompanyRegNo` |
| `DefaultCurrency` | `DefaultCurrencyID` |
| `Remarks` | `Notes` |
| `TermsOfSale` | `DefaultSaleTermsID` |
| `DeliveryAddress_Line1` | `DeliveryAddressLine1` |
| `DeliveryAddress_Line2` | `DeliveryAddressLine2` |
| `DeliveryAddress_City` | `DeliveryAddressCity` |
| `DeliveryAddress_Country` | `DeliveryAddressCountry` |
| `DeliveryAddress_ZIP` | `DeliveryAddressZIP` |
| `VatCode` | `VATCode` |
| `TransportationMethodCode` | `DefaultTransportModeID` |
| `CUS_PSN_Prefix` | `PSNPrefix` |
| `CUS_PSN_Auto_Numerator` | `PSNNumerator` |
| — | `IsActive` bit DEFAULT 1 |
| — | `CreatedAt` datetime2 |
| — | `UpdatedAt` datetime2 |

---

## 9. מיפוי עמודות — tblExchangeRates (מ-A_RATES)

| שם ישן | שם חדש | טיפוס חדש | הערה |
|--------|--------|-----------|------|
| — | `ExchangeRateID` | bigint IDENTITY PK | **חדש** |
| `KOD_MATBEA` | `CurrencyID` | smallint FK | |
| `R_DATE` | `RateDate` | date | CONVERT מ-char(8) |
| `RATE` | `Rate` | decimal(18,6) | הדיוק גדל |
| `MEKADEM` | `PreviousCurrencyID` | smallint | FK לוגי |
| — | `CreatedAt` | datetime2 | **חדש** |

---

## 10. הגדרת אינדקסים

### tblOrders
```sql
PK_tblOrders                    ON (OrderID)
UQ_tblOrders_CompanyYearNumber  ON (CompanyID, OrderYear, OrderNumber)
IX_tblOrders_CustomerID         ON (CustomerID)
IX_tblOrders_SupplierID         ON (SupplierID)
IX_tblOrders_SalesDomainID      ON (SalesDomainID)
IX_tblOrders_OrderDate          ON (OrderDate DESC)
IX_tblOrders_StatusFlags        ON (IsCancelled, IsFrozen, IsImportant)
```

### tblOrderLines
```sql
PK_tblOrderLines                      ON (OrderLineID)
UQ_tblOrderLines_Key                  ON (CompanyID, OrderYear, OrderNumber, GroupNo, LineNo)
IX_tblOrderLines_OrderRef             ON (CompanyID, OrderYear, OrderNumber)
IX_tblOrderLines_SupplierSKU          ON (SupplierID, SupplierSKU)
IX_tblOrderLines_ItemLinkID           ON (ItemLinkID)
```

### tblItemLinks
```sql
PK_tblItemLinks                       ON (ItemLinkID)
UQ_tblItemLinks_SupplierSKU           ON (SupplierID, SupplierSKU)
IX_tblItemLinks_CustomerSKU           ON (CustomerID, CustomerSKU)
IX_tblItemLinks_IsTempSKU             ON (IsTempSKU) WHERE IsTempSKU = 1
```

### tblShipmentTracking
```sql
PK_tblShipmentTracking                ON (ShipmentTrackingID)
UQ_tblShipmentTracking_Key            ON (CompanyID, OrderYear, OrderNumber, GroupNo)
IX_tblShipmentTracking_ETA            ON (ETA)
IX_tblShipmentTracking_PaymentStatus  ON (PaymentStatusID)
```

### tblOrderFinancials
```sql
PK_tblOrderFinancials                 ON (OrderFinancialID)
UQ_tblOrderFinancials_Key             ON (CompanyID, OrderYear, OrderNumber, GroupNo)
IX_tblOrderFinancials_CommissionRecv  ON (CommissionReceived) WHERE CommissionReceived = 0
```

### tblCatalogTasks
```sql
PK_tblCatalogTasks                    ON (CatalogTaskID)
IX_tblCatalogTasks_ItemLinkID         ON (ItemLinkID)
IX_tblCatalogTasks_SupplierStatus     ON (SupplierSKUStatus) WHERE SupplierSKUStatus <> 'CONFIRMED'
IX_tblCatalogTasks_CustomerStatus     ON (CustomerSKUStatus) WHERE CustomerSKUStatus <> 'CONFIRMED'
IX_tblCatalogTasks_AssignedTo         ON (SupplierAssignedTo, CustomerAssignedTo)
```

### tblExchangeRates
```sql
PK_tblExchangeRates                   ON (ExchangeRateID)
UQ_tblExchangeRates_CurrencyDate      ON (CurrencyID, RateDate)
IX_tblExchangeRates_RateDate          ON (RateDate DESC)
```

---

## 11. הערות העברה (Migration Notes)

| נושא | פעולה נדרשת |
|------|-------------|
| כל `char(8)` תאריך | `CONVERT(date, col, 112)` — format YYYYMMDD |
| `LAKOAH_SHILEM char(1)` Y/N | `CASE WHEN col='Y' THEN 1 ELSE 0 END` |
| `AMALA_HITKABLA char(1)` Y/N | `CASE WHEN col='Y' THEN 1 ELSE 0 END` |
| `float` לסכומים | `CAST(col AS decimal(18,3))` |
| `A_TNAEY_TASHLUM.מספר` | עמודת PK בעברית — `ALTER TABLE ... ADD PaymentTermID` |
| `HEVRA_SHANA` computed col | לא להעביר — computed בקוד |
| SCP_Print*/Tradition/* bits | להפוך ל-seed ב-`tblItemAttributeDefs` + rows ב-`tblItemLinkAttributes` |
| `DOCUMENTIM1-10` בכותרת | להמיר לשורות ב-`tblOrderDocuments` |
