import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  GridModule, CellClickEvent, RowClassArgs, PageChangeEvent,
} from '@progress/kendo-angular-grid';
import { SortDescriptor, orderBy } from '@progress/kendo-data-query';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { MatIconModule } from '@angular/material/icon';
import { ArachimOrder, OrderStatus, CommissionType } from '../../core/models/arachim/order.model';
import { OrderDrawerComponent } from './order-drawer/order-drawer.component';
import { ArachimOrdersService } from '../../core/services/arachim-orders.service';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    GridModule, ButtonsModule,
    MatIconModule,
    OrderDrawerComponent,
    DatePipe,
  ],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
})
export class OrdersComponent implements OnInit {

  private allOrders = signal<ArachimOrder[]>([]);
  selectedOrder     = signal<ArachimOrder | null>(null);
  loading           = signal(true);
  error             = signal('');
  loadingDetail     = signal(false);

  searchTerm     = '';
  filterSupplier = '';
  filterStatus   = '';
  filterYear     = '';

  gridData: ArachimOrder[] = [];
  sort: SortDescriptor[]   = [{ field: 'orderDate', dir: 'desc' }];
  skip     = 0;
  pageSize = 25;

  // ── KPIs ─────────────────────────────────────────────────────────
  openCount = computed(() =>
    this.allOrders().filter(o => o.status !== 'cancelled').length,
  );

  awaitingShipment = computed(() =>
    this.allOrders().filter(o =>
      (o.status === 'active' || o.status === 'important') && !o.ata,
    ).length,
  );

  expectedCommission = computed(() =>
    this.allOrders()
      .filter(o => o.status !== 'cancelled')
      .reduce((s, o) => s + o.commissionAmount, 0),
  );

  receivedCommission = computed(() =>
    this.allOrders().reduce((s, o) => s + (o.commissionAmtReceived || 0), 0),
  );

  // ── Filter options ────────────────────────────────────────────────
  supplierOptions = computed(() =>
    [...new Set(this.allOrders().map(o => o.supplierShort))].filter(Boolean).sort(),
  );

  yearOptions = computed(() =>
    [...new Set(this.allOrders().map(o => o.orderYear))].sort((a, b) => b - a),
  );

  constructor(private svc: ArachimOrdersService) {}

  ngOnInit() {
    this.svc.getOrders().subscribe({
      next: orders => {
        this.allOrders.set(orders);
        this.loading.set(false);
        this.applyFilters();
      },
      error: () => {
        this.error.set('שגיאה בטעינת הזמנות');
        this.loading.set(false);
      },
    });
  }

  // ── Grid data ─────────────────────────────────────────────────────
  get pagedData() {
    return this.gridData.slice(this.skip, this.skip + this.pageSize);
  }

  applyFilters() {
    let data = this.allOrders();
    if (this.searchTerm) {
      const q = this.searchTerm.toLowerCase();
      data = data.filter(o =>
        o.supplierShort?.toLowerCase().includes(q) ||
        o.supplierFull?.toLowerCase().includes(q)  ||
        o.customerShort?.toLowerCase().includes(q) ||
        o.customerFull?.toLowerCase().includes(q)  ||
        o.orderNumber.toString().includes(q),
      );
    }
    if (this.filterSupplier) data = data.filter(o => o.supplierShort === this.filterSupplier);
    if (this.filterStatus)   data = data.filter(o => o.status === this.filterStatus);
    if (this.filterYear)     data = data.filter(o => o.orderYear === +this.filterYear);

    this.gridData = orderBy(data, this.sort) as ArachimOrder[];
    this.skip = 0;
  }

  onSearch(v: string)               { this.searchTerm = v;  this.applyFilters(); }
  onFilterChange()                  { this.applyFilters(); }
  onSortChange(s: SortDescriptor[]) { this.sort = s;        this.applyFilters(); }
  onPageChange(e: PageChangeEvent)  { this.skip = e.skip;   this.pageSize = e.take; }
  clearFilters()                    { this.searchTerm = ''; this.filterSupplier = ''; this.filterStatus = ''; this.filterYear = ''; this.applyFilters(); }

  // ── Drawer ────────────────────────────────────────────────────────
  onCellClick(e: CellClickEvent) {
    const target = e.originalEvent?.target as HTMLElement;
    if (target?.closest('.k-checkbox-wrap, .grid-act-btn')) return;

    const row = e.dataItem as ArachimOrder;
    // If already loaded (has shipment), open immediately
    if (row.shipment) {
      this.selectedOrder.set(row);
      return;
    }
    // Load detail
    this.loadingDetail.set(true);
    this.svc.getOrder(row.orderId).subscribe({
      next: full => {
        this.loadingDetail.set(false);
        this.selectedOrder.set(full);
        // update the list cache too
        const updated = this.allOrders().map(o => o.orderId === full.orderId ? full : o);
        this.allOrders.set(updated);
      },
      error: () => {
        this.loadingDetail.set(false);
        // Open with partial data anyway
        this.selectedOrder.set(row);
      },
    });
  }

  closeDrawer() { this.selectedOrder.set(null); }

  // ── Display helpers ───────────────────────────────────────────────
  readonly statusLabels: Record<OrderStatus, string> = {
    active: 'פעיל', important: 'חשוב', frozen: 'מוקפא',
    cancelled: 'בוטל', frame: 'מסגרת',
  };

  statusLabel(s: OrderStatus) { return this.statusLabels[s]; }

  commBadge(o: ArachimOrder): string {
    if (o.commissionType === 'PCT')       return `${(o.commissionPct || 0).toFixed(1)}%`;
    if (o.commissionType === 'FIXED')     return 'קבוע';
    if (o.commissionType === 'PER_PRICE') return '×מ"מ';
    return '—';
  }

  dateClass(d: Date | null): string {
    if (!d) return '';
    const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
    if (days < 0)  return 'date-overdue';
    if (days < 30) return 'date-soon';
    return '';
  }

  orderBadge(o: ArachimOrder): string {
    return `${o.orderYear}-${o.orderNumber.toString().padStart(3, '0')}`;
  }

  rowClass = (ctx: RowClassArgs): Record<string, boolean> => {
    const o = ctx.dataItem as ArachimOrder;
    return {
      'row-cancelled': o.status === 'cancelled',
      'row-important': o.status === 'important',
      'row-frozen':    o.status === 'frozen',
      'row-selected':  this.selectedOrder()?.orderId === o.orderId,
    };
  };

  hasActiveFilters(): boolean {
    return !!(this.searchTerm || this.filterSupplier || this.filterStatus || this.filterYear);
  }
}
