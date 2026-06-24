# ARCHEM — מסמך ידע פרויקט
**עודכן:** 2026-06-18 | **מקור:** שיחות + זיכרון + אפיון

---

## 1. סביבה טכנית

| רכיב | פרטים |
|------|--------|
| Backend | Node.js 24 + Express — `C:\Users\Administrator\ARCHEM\backend\` |
| Frontend | Angular 17+ Standalone + Signals — `C:\Users\Administrator\ARCHEM\frontend\` |
| DB | SQL Server על `192.168.1.2`, DB: `ARCHEM`, user: `sa` |
| Backend Port | **3001** |
| Frontend Port | **4201** |
| DB ישן (מקור) | `DB_ARACHIM_TEST` — Btrieve/Magic XPA (קריאה בלבד, cross-DB) |

### הפעלת שרתים
```
Backend:  node server.js  (מתיקיית backend)
Frontend: node node_modules\@angular\cli\bin\ng.js serve --port 4201
```

### .env (backend)
```
PORT=3001
DB_SERVER=192.168.1.2
DB_NAME=ARCHEM
DB_USER=sa
DB_PASSWORD=Ksd_5149577
JWT_SECRET=ARCHEM_JWT_Secret_2026!
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### Connectors (ב-SQUADFLOW)
| Connector | UUID | מטרה |
|-----------|------|-------|
| DB ישן | `7c8347be-b872-428a-a66c-59327fcdbacc` | ARCHEM DB ישן |
| DB חדש | `742aef38-fd91-43cb-8697-477f2d385126` | ARCHEM DB חדש (נוצר 2026-06-16) |
| AI | `5823d49d-fe67-49cf-92b0-1f1475dc04ad` | Anthropic Claude API |

---

## 2. ארכיטקטורת ה-DB — ARCHEM (חדש)

### סטנדרט שמות
- טבלה: `tbl[EntityName]` — PascalCase
- PK: `[EntityName]ID`
- Boolean: `Is[State]` — `IsActive`, `IsCancelled`
- Audit: `CreatedAt datetime2`, `UpdatedAt datetime2` בכל טבלה ראשית
- אין hard deletes — תמיד `IsActive bit DEFAULT 1`

### טבלאות קיימות (מועברות מ-DB ישן)

| טבלה חדשה | טבלה ישנה | תיאור | סטטוס |
|-----------|-----------|--------|--------|
| `tblOrders` | `A_HAZMANOT` | כותרת הזמנה | ✅ קיים |
| `tblOrderLines` | `A_SHUROT_HAZMANA` | שורות פריטים | ✅ קיים |
| `tblSuppliers` | `A_SAPAKIM` | ספקים | ✅ קיים |
| `tblCustomers` | `A_LAKOHOT` | לקוחות | ✅ קיים |
| `tblCompanies` | `A_COMPANIES` | חברות (02/05/06) | ✅ קיים |
| `tblItemLinks` | `tblSupplierCustomerPSNs` | קישור ספק↔לקוח (SKU) | ✅ קיים |
| `tblCurrencies` | `A_CURRENCIES` | מטבעות — ISO 4217 מלא | ✅ שודרג |
| `tblUnitsOfMeasure` | `B_Y_MIDA` | יחידות מידה | ✅ קיים |

### טבלאות פריטים — נוצרו 2026-06-17

| טבלה | תיאור | שורות שהוכנסו |
|------|--------|----------------|
| `tblItems` | מאסטר פריטים (מ-B_PRITIM + B_PRITIM1) | 113 |
| `tblItemCategories` | קטגוריות סיווג (מ-B_SIVUGIM) | 415 |
| `tblItemClassifications` | סיווגי פריט per level | 429 |
| `tblItemSupplierLinks` | קישור פריט↔ספק | 101 |
| `tblItemRegulations` | רגולציות (DARUSH_*/MEUSHAR_*/TAARICH_TOKEF_*) | — |

### tblCurrencies — שודרג לISO 4217 (2026-06-17/18)
**165 מטבעות סך הכל | 156 פעילים**

עמודות: `CurrencyID`, `CurrencyCode CHAR(3) UNIQUE`, `CurrencyNumeric CHAR(3) UNIQUE`, `CurrencyName NVARCHAR(50)`, `CurrencySymbol`, `DecimalPlaces TINYINT`, `IsActive`, `CreatedAt`, `UpdatedAt`

הוסרו: `CurrencyDesc` (הוחלף ב-CurrencyName), `IsBase`

מטבעות מקוריים (IDs 1–18) שמרו CurrencyID לשמירת FK. נוסף AED (ID=19).

---

## 3. מיפוי טבלאות — ישן → חדש (קיצור)

| ישן | חדש |
|-----|-----|
| `A_HAZMANOT` | `tblOrders` |
| `A_SHUROT_HAZMANA` | `tblOrderLines` |
| `A_MAAKAV_SHUROT1` | `tblShipmentTracking` |
| `A_MAAKAV_SHUROT2` | `tblOrderFinancials` |
| `A_HESKEMEY_MISGERET` | `tblFrameContractDraws` |
| `A_LAKOHOT` | `tblCustomers` |
| `A_SAPAKIM` | `tblSuppliers` |
| `A_ANSHEY_KESHER_LAKOAHOT` | `tblCustomerContacts` |
| `A_ANSHEY_KESHER_SAPAKIM` | `tblSupplierContacts` |
| `A_CURRENCIES` | `tblCurrencies` |
| `A_RATES` | `tblExchangeRates` |
| `A_TNAEY_TASHLUM` | `tblPaymentTerms` |
| `A_MISHLOCHIM` | `tblShippingAgents` |
| `A_TCHUMEY_MECHIRA` | `tblSalesDomains` |
| `B_PRITIM` | `tblItems` |
| `B_SIVUGIM` | `tblItemCategories` |

מיפוי מלא של עמודות: ראה `arachim-db-rename-mapping.md`

---

## 4. Backend — routes קיימים

| Route | קובץ | תיאור |
|-------|------|--------|
| `/api/auth` | `auth.js` | JWT בלבד, אין DB |
| `/api/orders` | `orders.js` | ARCHEM: tblOrders, tblOrderLines |
| `/api/suppliers` | `suppliers.js` | ARCHEM: tblSuppliers |
| `/api/customers` | `customers.js` | ARCHEM: tblCustomers |
| `/api/meta` | `meta.js` | lookups (currencies, companies...) |
| `/api/order-intake` | `orderIntake.js` | PDF → Anthropic claude-haiku → הזמנה |

**הערה:** `orderIntake.js` עדיין קורא פריטים מ-`DB_ARACHIM_TEST.dbo.B_PRITIM` — צריך לעדכן ל-`tblItems`

### db.js — חיבור DB
```javascript
sql.connect(config)  // getPool() singleton
// Server: 192.168.1.2 | DB: ARCHEM | user: sa
```

---

## 5. מודל הנתונים — מודול עמלות (אפיון מקורי)

> **שים לב:** האפיון המלא נמצא ב-`commissions-data-model.md`. להלן תמצית.
> שינויים שנדונו בשיחות מאוחרות יותר **לא נשמרו** — יש לעדכן בנפרד.

### 5.1 טבלאות ליבה

| טבלה | תיאור |
|------|--------|
| `ORDERS` | כותרת הזמנה — company_id, supplier_id, customer_id, status, currency, total_value, total_commission |
| `ORDER_LINE` | שורת פריט — item_link_id, price, qty_ordered, qty_supplied, commission_type_id, line_value |
| `SHIPMENT_TRACKING` | מעקב משלוח — supplier_oc, ETD, ETA, ATA, bl_number |
| `INVOICE` | חשבונית ספק — supplier_invoice_no, amount, due_date, overdue, paid_by_customer |
| `COMMISSION_RECEIPT` | תקבול עמלה — received, amount_received, balance_due |
| `ORDER_DOCUMENT` | צרופות — doc_type, file_name, file_format |
| `ORDER_AUDIT_LOG` | יומן שינויים — field_name, value_before, value_after |
| `FRAME_CONTRACT` | חוזה מסגרת — total_qty, qty_supplied, qty_remaining, period_start/end |

### 5.2 Master Data

| טבלה | תיאור |
|------|--------|
| `CUSTOMER` | לקוח — customer_number, status, name, default_currency, default_company_id |
| `SUPPLIER` | ספק — supplier_number, status, name, default_company_id |
| `CONTACT` | איש קשר — owner_type (customer/supplier), contact_kind, name, phone, email |
| `ITEM_LINK` | קישור פריט ספק↔לקוח — supplier_sku, customer_sku, uom_id |
| `ITEM_NUANCE` | נואנסים לפריט (עד 12 סוגים) — nuance_type, input_kind, value |

### 5.3 Lookups

| טבלה | ערכים מרכזיים |
|------|----------------|
| `COMPANY` | 02=ארכים / 05=ירדן / 06=ספירא |
| `SALES_DOMAIN` | 22 תחומים |
| `COMMISSION_TYPE` | קבועה / אחוזים / כמות×מחיר |
| `PAYMENT_TERM` | 30+INV, 60+DEL, 90+BL, PIA, CUD |
| `SALE_TERMS` | FOB, CIF, EXW, DAP, DDP, FCA (Incoterms) |
| `TRANSPORT_MODE` | SEA / AIR / Courier |
| `UOM` | GR, KG, TON, PCS, BOX, MTR, KM, UNIT, REEL |

### 5.4 חוקים עסקיים מרכזיים

| # | חוק |
|---|-----|
| BR-1 | `line_value = price × qty` — אם יש qty_supplied, מחשב לפיו |
| BR-2 | 3 סוגי עמלה: קבועה / אחוזים / כמות×מחיר |
| BR-3 | `total_commission = Σ עמלות שורות` |
| BR-4 | אם `total_commission ≥ 5000` → status=important (אוטומטי) |
| BR-7 | overdue=true אוטומטי כש-due_date עבר |
| BR-9 | ביטול/הקפאה → status_reason חובה |
| BR-11 | משיכה מחוזה מסגרת → מעדכן qty_supplied/qty_remaining |

### 5.5 Angular Feature Modules (מתוכנן)

| Module | תוכן |
|--------|-------|
| `orders` | רשימת הזמנות, עריכה, שורות, עמלות |
| `tracking` | מעקב משלוח, חשבוניות, עמלות |
| `documents` | צרופות + תצוגת מסמכים |
| `audit` | יומן שינויים |
| `frame-contracts` | חוזות מסגרת + משיכות |
| `master-data` | ארכיסי לקוח, ספק, ITEM_LINK |
| `lookups` | טבלאות עזר |
| `admin` | משתמשים, הרשאות |

---

## 6. נקודות פתוחות ידועות

| נושא | מצב |
|------|-----|
| `orderIntake.js` — item lookup | עדיין מ-`DB_ARACHIM_TEST.dbo.B_PRITIM` — צריך מעבר ל-`tblItems` |
| שינויים לאפיון העמלות | נדונו בשיחה נפרדת — **לא שמורים** |
| tblItems.ItemID | מתחיל מ-273 (IDENTITY נצרך בניסיונות כושלים) — קוסמטי בלבד |
| NexusComponent TypeScript errors | שגיאות קיימות, לא חוסמות dev server |

---

## 7. פרויקט ARCHEM — הקשר עסקי

**מערכת:** מערכת עמלות לחברת ארכים וחברות קשורות (ירדן, ספירא)
**מקור:** מיגרציה ממערכת Magic XPA / Btrieve
**3 חברות:** 02=ארכים / 05=ירדן / 06=ספירא — נפרדות חשבונאית, ITEM_LINK משותף
**מטבע בסיס:** ILS (₪) — עם תמיכה ב-USD/EUR
**מודל עמלות:** ספק → ארכים → לקוח; ארכים מרוויחה עמלה על כל הזמנה
