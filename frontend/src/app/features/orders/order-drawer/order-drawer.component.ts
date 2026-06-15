import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ArachimOrder, ArachimOrderLine, OrderStatus, CommissionType } from '../../../core/models/arachim/order.model';

type DrawerTab = 'details' | 'lines' | 'shipment' | 'finance';

@Component({
  selector: 'app-order-drawer',
  standalone: true,
  imports: [CommonModule, MatIconModule, DecimalPipe],
  templateUrl: './order-drawer.component.html',
  styleUrl: './order-drawer.component.scss',
})
export class OrderDrawerComponent {
  @Input() order!: ArachimOrder;
  @Output() closed = new EventEmitter<void>();
  @Output() edit   = new EventEmitter<ArachimOrder>();

  tab = signal<DrawerTab>('details');

  readonly statusLabels: Record<OrderStatus, string> = {
    active: 'פעיל', important: 'חשוב', frozen: 'מוקפא',
    cancelled: 'בוטל', frame: 'מסגרת',
  };

  readonly commLabels: Record<CommissionType, string> = {
    PCT: 'אחוז', FIXED: 'סכום קבוע', PER_PRICE: 'לפי מחיר', NONE: 'ללא',
  };

  close() { this.closed.emit(); }

  orderBadge(): string {
    return `${this.order.orderYear}-${this.order.orderNumber.toString().padStart(3, '0')}`;
  }

  dispatchPct(line: ArachimOrderLine): number {
    if (!line.qtyOrdered) return 0;
    return Math.min(100, Math.round((line.qtyDispatched / line.qtyOrdered) * 100));
  }

  totalQtyOrdered(): number {
    return (this.order.lines || []).reduce((s, l) => s + l.qtyOrdered, 0);
  }

  totalQtyDispatched(): number {
    return (this.order.lines || []).reduce((s, l) => s + l.qtyDispatched, 0);
  }

  totalDispatchPct(): number {
    const total = this.totalQtyOrdered();
    return total ? Math.round((this.totalQtyDispatched() / total) * 100) : 0;
  }

  shipmentStepDone(step: 'oc' | 'etd' | 'eta' | 'ata'): boolean {
    const s = this.order.shipment;
    if (!s) return false;
    switch (step) {
      case 'oc':  return !!s.supplierOCDate;
      case 'etd': return !!s.etd;
      case 'eta': return !!s.eta;
      case 'ata': return !!s.ata;
    }
  }

  dateStr(d: Date | null | undefined): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  commDetail(): string {
    if (this.order.commissionType === 'PCT')   return `${(this.order.commissionPct || 0).toFixed(1)}%`;
    if (this.order.commissionType === 'FIXED') return `${this.order.currency} ${(this.order.commissionAmount || 0).toLocaleString()}`;
    return '—';
  }

  hasLines(): boolean    { return !!(this.order.lines?.length); }
  hasShipment(): boolean { return !!this.order.shipment; }
  hasFinancial(): boolean { return !!this.order.financial; }
}
