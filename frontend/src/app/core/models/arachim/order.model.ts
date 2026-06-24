export type OrderStatus    = 'active' | 'important' | 'frozen' | 'cancelled' | 'frame' | 'inactive';
export type CommissionType = 'PCT' | 'FIXED' | 'PER_PRICE' | 'NONE';

export interface ArachimOrderLine {
  orderLineId:      number;
  groupNo:          number;
  lineNo:           number;
  supplierSKU:      string;
  customerSKU:      string;
  description:      string;
  price:            number;
  qtyOrdered:       number;
  qtyDispatched:    number;
  uom:              string;
  currencyId:       number | null;
  currency:         string;
  discountPct:      number;
  lineValue:        number;
  commissionType:   CommissionType;
  commissionPct:    number;
  commissionFixed:  number;
  commissionPerPrice?: number;
  commissionAmount: number;
  deliveryDate:     Date | null;
  itemLinkId:       number | null;
  isFrameContract:  boolean;
}

export interface ArachimOrderFinancial {
  supplierInvoiceNo:        string;
  supplierInvoiceDate:      Date | null;
  invoiceAmount:            number;
  customerPaid:             boolean;
  amountPaidByCustomer:     number;
  invoiceIssuedToSupplier:  boolean;
  commissionReceived:       boolean;
  commissionAmountReceived: number;
  currency:                 string;
}

export interface ArachimShipment {
  supplierOC:            string;
  supplierOCDate:        Date | null;
  desiredDeliveryDate:   Date | null;
  updatedDeliveryDate:   Date | null;
  handoverToShipperDate: Date | null;
  goodsLeftFactoryDate:  Date | null;
  etd:                   Date | null;
  eta:                   Date | null;
  ata:                   Date | null;
  blNumber:              string;
  vesselName:            string;
  transportMode:         'A' | 'Y' | null;
  hasDocuments:          boolean;
  paymentStatusId:       number | null;
}

export interface ArachimOrder {
  orderId:               number;
  orderNumber:           number;
  orderYear:             number;
  companyId:             number;
  companyName:           string;
  groupNo:               string | null;
  status:                OrderStatus;
  supplierID:            number;
  supplierShort:         string;
  supplierFull:          string;
  customerID:            number;
  customerShort:         string;
  customerFull:          string;
  customerRef:           string;
  salesDomainId:         number | null;
  salesDomainName:       string;
  salesDomainPrefix:     string;
  editorId:              number | null;
  editorName:            string;
  paymentTermsId:        number | null;
  paymentTermsDesc:      string;
  creditDays:            number | null;
  incotermsId:           number | null;
  incotermsDesc:         string;
  supplierContactName:   string;
  orderDate:             Date | null;
  deliveryDate:          Date | null;
  eta:                   Date | null;
  ata:                   Date | null;
  currencyId:            number;
  currency:              string;
  currencyCode:          string;
  totalValue:            number;
  commissionType:        CommissionType;
  commissionPct:         number;
  commissionAmount:      number;
  commissionReceived:    boolean;
  commissionAmtReceived: number;
  isFrameContract:       boolean;
  isImportant:           boolean;
  isFrozen:              boolean;
  isCancelled:           boolean;
  isActive:              boolean;
  lineCount:             number;
  lines:                 ArachimOrderLine[];
  financial:             ArachimOrderFinancial | null;
  shipment:              ArachimShipment | null;
}
