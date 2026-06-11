export type OrderStatus = 'active' | 'important' | 'frozen' | 'cancelled' | 'frame';
export type CommissionType = 'PCT' | 'FIXED' | 'PER_PRICE' | 'NONE';

export interface ArachimOrderLine {
  orderLineId: number;
  groupNo: number;
  lineNo: number;
  supplierSKU: string;
  customerSKU: string;
  description: string;
  price: number;
  qtyOrdered: number;
  qtyDispatched: number;
  uom: string;
  currency: string;
  discountPct: number;
  lineValue: number;
  commissionType: CommissionType;
  commissionPct: number;
  commissionFixed: number;
  commissionAmount: number;
  deliveryDate: Date | null;
  itemLinkId: number | null;
}

export interface ArachimOrderFinancial {
  supplierInvoiceNo: string;
  supplierInvoiceDate: Date | null;
  invoiceAmount: number;
  customerPaid: boolean;
  amountPaidByCustomer: number;
  invoiceIssuedToSupplier: boolean;
  commissionReceived: boolean;
  commissionAmountReceived: number;
  currency: string;
}

export interface ArachimShipment {
  supplierOC: string;
  supplierOCDate: Date | null;
  desiredDeliveryDate: Date | null;
  updatedDeliveryDate: Date | null;
  handoverToShipperDate: Date | null;
  goodsLeftFactoryDate: Date | null;
  etd: Date | null;
  eta: Date | null;
  ata: Date | null;
  blNumber: string;
  vesselName: string;
  transportMode: 'A' | 'Y' | null;
  hasDocuments: boolean;
  paymentStatusId: number | null;
}

export interface ArachimOrder {
  orderId: number;
  orderNumber: number;
  orderYear: number;
  companyId: number;
  groupNo: number;
  status: OrderStatus;
  supplierID: number;
  supplierShort: string;
  supplierFull: string;
  customerID: number;
  customerShort: string;
  customerFull: string;
  salesDomain: string;
  salesDomainPrefix: string;
  salesPerson: string;
  orderDate: Date | null;
  deliveryDate: Date | null;
  eta: Date | null;
  ata: Date | null;
  totalValue: number;
  currency: string;
  commissionType: CommissionType;
  commissionPct: number;
  commissionAmount: number;
  commissionReceived: boolean;
  commissionAmtReceived: number;
  customerRef: string;
  isFrameContract: boolean;
  lineCount: number;
  lines: ArachimOrderLine[];
  financial: ArachimOrderFinancial | null;
  shipment: ArachimShipment | null;
}
