import {
  Component, signal, computed, OnInit, HostListener, ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  GridModule, CellClickEvent, RowClassArgs, PageChangeEvent,
} from '@progress/kendo-angular-grid';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { SortDescriptor, orderBy } from '@progress/kendo-data-query';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { MatIconModule } from '@angular/material/icon';
import {
  ArachimOrder, OrderStatus, CommissionType,
} from '../../core/models/arachim/order.model';
import { ArachimOrdersService, OrderFilters } from '../../core/services/arachim-orders.service';
import { OrderDrawerComponent } from './order-drawer/order-drawer.component';
import { OrderDialogComponent } from './order-dialog/order-dialog.component';
import { ListPickerDialogComponent, PickerItem } from '../../shared/components/list-picker/list-picker-dialog.component';
import { OrderIntakeComponent } from '../order-intake/order-intake.component';
import { DialogModule } from '@progress/kendo-angular-dialog';

interface ContextMenuItem { label: string; icon: string; action: () => void; danger?: boolean; }
interface MetaOption      { id: number; name: string; }

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    GridModule, ButtonsModule, DropDownsModule, DialogModule,
    MatIconModule,
    OrderDrawerComponent, OrderDialogComponent,
    ListPickerDialogComponent, OrderIntakeComponent,
  ],
  templateUrl: './orders.component.html',
  styleUrl:    './orders.component.scss',
})
export class OrdersComponent implements OnInit {

  private allOrders  = signal<ArachimOrder[]>([]);
  selectedOrder      = signal<ArachimOrder | null>(null);
  loading            = signal(true);
  error              = signal('');
  loadingDetail      = signal(false);
  actionLoading      = signal<number | null>(null);

  // ── Filters ───────────────────────────────────────────────────────────────
  filterYear         = new Date().getFullYear();
  filterFromDate     = `${new Date().getFullYear()}-01-01`;
  filterToDate       = new Date().toISOString().split('T')[0];
  filterCompanyId    = 0;
  filterSupplierId   = 0;
  filterCustomerId   = 0;
  filterSalesDomain  = 0;
  filterShowFrozen:    0|1|2 = 2;
  filterShowCancelled: 0|1|2 = 2;
  filterShowImportant: 0|1|2 = 2;
  filterShowFrame:     0|1|2 = 2;
  searchTerm         = '';

  // ── Meta options (full + filtered for dropdown search) ───────────────────
  companies         = signal<MetaOption[]>([]);
  suppliersAll      = signal<MetaOption[]>([]);
  suppliersFiltered = signal<MetaOption[]>([]);
  customersAll      = signal<MetaOption[]>([]);
  customersFiltered = signal<MetaOption[]>([]);
  salesDomains      = signal<MetaOption[]>([]);

  readonly nullOption: MetaOption = { id: 0, name: 'הכל' };

  selectedSupplier  = signal<MetaOption>(this.nullOption);
  selectedCustomer  = signal<MetaOption>(this.nullOption);

  onSupplierFilter(q: string) {
    const lq = q.toLowerCase();
    this.suppliersFiltered.set(
      this.suppliersAll().filter(s => s.name.toLowerCase().includes(lq))
    );
  }

  onCustomerFilter(q: string) {
    const lq = q.toLowerCase();
    this.customersFiltered.set(
      this.customersAll().filter(c => c.name.toLowerCase().includes(lq))
    );
  }

  onSupplierChange(item: MetaOption | null) {
    const sel = item ?? this.nullOption;
    this.selectedSupplier.set(sel);
    this.filterSupplierId = sel.id;
    this.loadOrders();
  }

  onCustomerChange(item: MetaOption | null) {
    const sel = item ?? this.nullOption;
    this.selectedCustomer.set(sel);
    this.filterCustomerId = sel.id;
    this.loadOrders();
  }

  // ── Grid ──────────────────────────────────────────────────────────────────
  gridData: ArachimOrder[] = [];
  sort: SortDescriptor[]   = [{ field: 'orderDate', dir: 'desc' }];
  skip     = 0;
  pageSize = 50;

  get pagedData() { return this.gridData.slice(this.skip, this.skip + this.pageSize); }

  // ── KPIs ─────────────────────────────────────────────────────────────────
  openCount = computed(() =>
    this.allOrders().filter(o => !o.isCancelled && !o.isFrozen && o.isActive).length
  );
  frozenCount = computed(() =>
    this.allOrders().filter(o => o.isFrozen && o.isActive).length
  );
  cancelledCount = computed(() =>
    this.allOrders().filter(o => o.isCancelled && o.isActive).length
  );
  frameCount = computed(() =>
    this.allOrders().filter(o => o.isFrameContract && o.isActive).length
  );
  importantCount = computed(() =>
    this.allOrders().filter(o => o.isImportant && !o.isCancelled && o.isActive).length
  );
  expectedCommission = computed(() =>
    this.allOrders().filter(o => !o.isCancelled && o.isActive)
      .reduce((s, o) => s + o.commissionAmount, 0)
  );
  receivedCommission = computed(() =>
    this.allOrders().reduce((s, o) => s + (o.commissionAmtReceived || 0), 0)
  );
  totalOrderValue = computed(() =>
    this.allOrders().filter(o => !o.isCancelled && o.isActive)
      .reduce((s, o) => s + (o.totalValue || 0), 0)
  );

  // ── Context menu ──────────────────────────────────────────────────────────
  contextOrder = signal<ArachimOrder | null>(null);
  contextMenuItems = signal<ContextMenuItem[]>([]);
  contextPos       = signal({ x: 0, y: 0 });
  showContextMenu  = signal(false);

  // ── Order dialog ──────────────────────────────────────────────────────────
  dialogOrder  = signal<ArachimOrder | null>(null);
  showDialog   = signal(false);

  // ── AI Intake modal ───────────────────────────────────────────────────────
  showAiModal  = signal(false);

  // ── Picker dialogs ────────────────────────────────────────────────────────
  showSupplierPicker = signal(false);
  showCustomerPicker = signal(false);

  openSupplierPicker() { this.showSupplierPicker.set(true); }
  openCustomerPicker() { this.showCustomerPicker.set(true); }

  onSupplierPicked(item: PickerItem) {
    this.showSupplierPicker.set(false);
    this.selectedSupplier.set(item);
    this.filterSupplierId = item.id;
    this.loadOrders();
  }
  onCustomerPicked(item: PickerItem) {
    this.showCustomerPicker.set(false);
    this.selectedCustomer.set(item);
    this.filterCustomerId = item.id;
    this.loadOrders();
  }
  clearSupplier() {
    this.selectedSupplier.set(this.nullOption);
    this.filterSupplierId = 0;
    this.loadOrders();
  }
  clearCustomer() {
    this.selectedCustomer.set(this.nullOption);
    this.filterCustomerId = 0;
    this.loadOrders();
  }

  constructor(
    private svc: ArachimOrdersService,
    private elRef: ElementRef,
    private router: Router,
  ) {}

  openAiIntake() { this.showAiModal.set(true); }

  ngOnInit() {
    this.loadMeta();
    this.loadOrders();
  }

  private loadMeta() {
    this.svc.getCompanies().subscribe(d =>
      this.companies.set(d.map(c => ({ id: c.CompanyID, name: c.Name })))
    );
    this.svc.getSuppliers().subscribe(d => {
      const list = d.map((s: any) => ({
        id:    s.SupplierID,
        name:  s.Name,
        extra: s.FullName && s.FullName !== s.Name ? s.FullName : undefined,
        badge: s.VATNumber ? `ע.מ ${s.VATNumber}` : `#${s.SupplierID}`,
      }));
      this.suppliersAll.set(list);
      this.suppliersFiltered.set(list);
    });
    this.svc.getCustomers().subscribe(d => {
      const list = d.map((c: any) => ({
        id:    c.CustomerID,
        name:  c.Name,
        extra: c.FullName && c.FullName !== c.Name ? c.FullName : undefined,
        badge: c.CompanyRegNo ? `ח.פ ${c.CompanyRegNo}` : `#${c.CustomerID}`,
      }));
      this.customersAll.set(list);
      this.customersFiltered.set(list);
    });
    this.svc.getSalesDomains().subscribe(d =>
      this.salesDomains.set(d.map(sd => ({ id: sd.SalesDomainID, name: sd.DomainName })))
    );
  }

  loadOrders() {
    this.loading.set(true);
    this.error.set('');

    const filters: OrderFilters = {
      year:          this.filterYear    || undefined,
      fromDate:      this.filterFromDate || undefined,
      toDate:        this.filterToDate   || undefined,
      companyId:     this.filterCompanyId    || undefined,
      supplierId:    this.filterSupplierId   || undefined,
      customerId:    this.filterCustomerId   || undefined,
      salesDomainId: this.filterSalesDomain  || undefined,
      showFrozen:    this.filterShowFrozen,
      showCancelled: this.filterShowCancelled,
      showImportant: this.filterShowImportant,
      showFrame:     this.filterShowFrame,
      search:        this.searchTerm || undefined,
    };

    this.svc.getOrders(filters).subscribe({
      next: orders => {
        this.allOrders.set(orders);
        this.loading.set(false);
        this.applyLocalFilter();
      },
      error: () => {
        this.error.set('שגיאה בטעינת הזמנות');
        this.loading.set(false);
      },
    });
  }

  applyLocalFilter() {
    let data = this.allOrders();
    if (this.searchTerm) {
      const q = this.searchTerm.toLowerCase();
      data = data.filter(o =>
        o.supplierShort?.toLowerCase().includes(q) ||
        o.supplierFull?.toLowerCase().includes(q)  ||
        o.customerShort?.toLowerCase().includes(q) ||
        o.customerFull?.toLowerCase().includes(q)  ||
        o.customerRef?.toLowerCase().includes(q)   ||
        o.orderNumber.toString().includes(q)
      );
    }
    this.gridData = orderBy(data, this.sort) as ArachimOrder[];
    this.skip = 0;
  }

  onSearch(v: string)               { this.searchTerm = v; this.applyLocalFilter(); }
  onSortChange(s: SortDescriptor[]) { this.sort = s;       this.applyLocalFilter(); }
  onPageChange(e: PageChangeEvent)  { this.skip = e.skip;  this.pageSize = e.take; }
  onFilterApply()                   { this.loadOrders(); }

  // ── Row class ─────────────────────────────────────────────────────────────
  rowClass = (ctx: RowClassArgs): Record<string, boolean> => {
    const o = ctx.dataItem as ArachimOrder;
    return {
      'row-cancelled':  o.isCancelled,
      'row-important':  o.isImportant && !o.isCancelled,
      'row-frozen':     o.isFrozen    && !o.isCancelled,
      'row-frame':      o.isFrameContract && !o.isCancelled && !o.isFrozen && !o.isImportant,
      'row-selected':   this.selectedOrder()?.orderId === o.orderId,
    };
  };

  // ── Drawer ────────────────────────────────────────────────────────────────
  onCellClick(e: CellClickEvent) {
    const target = e.originalEvent?.target as HTMLElement;
    if (target?.closest('.act-btn, .k-checkbox-wrap')) return;

    const row = e.dataItem as ArachimOrder;
    if (row.shipment) { this.selectedOrder.set(row); return; }

    this.loadingDetail.set(true);
    this.svc.getOrder(row.orderId).subscribe({
      next: full => {
        this.loadingDetail.set(false);
        this.selectedOrder.set(full);
        this.allOrders.update(list => list.map(o => o.orderId === full.orderId ? full : o));
      },
      error: () => { this.loadingDetail.set(false); this.selectedOrder.set(row); },
    });
  }

  closeDrawer() { this.selectedOrder.set(null); }

  // ── Actions: Edit, Deactivate, Context menu ───────────────────────────────
  openEdit(o: ArachimOrder, event: Event) {
    event.stopPropagation();
    this.selectedOrder.set(null);
    this._openEditById(o);
  }

  openEditFromDrawer(o: ArachimOrder) {
    this.selectedOrder.set(null);
    this._openEditById(o);
  }

  private _openEditById(o: ArachimOrder) {
    // Always fetch full order before opening dialog — grid rows don't carry lines
    this.loadingDetail.set(true);
    this.svc.getOrder(o.orderId).subscribe({
      next: full => {
        this.loadingDetail.set(false);
        this.allOrders.update(list => list.map(x => x.orderId === full.orderId ? full : x));
        this.dialogOrder.set(full);
        this.showDialog.set(true);
      },
      error: () => {
        this.loadingDetail.set(false);
        // Fallback: open with what we have
        this.dialogOrder.set(o);
        this.showDialog.set(true);
      },
    });
  }

  openNewDialog() {
    this.dialogOrder.set(null);
    this.showDialog.set(true);
  }

  onDeactivate(o: ArachimOrder, event: Event) {
    event.stopPropagation();
    if (!confirm(`האם להסיר הזמנה ${o.orderYear}-${o.orderNumber} מהרשימה?`)) return;
    this.actionLoading.set(o.orderId);
    this.svc.deactivateOrder(o.orderId).subscribe({
      next: () => { this.actionLoading.set(null); this.loadOrders(); },
      error: () => { this.actionLoading.set(null); },
    });
  }

  openContextMenu(o: ArachimOrder, event: MouseEvent) {
    event.stopPropagation();
    this.contextOrder.set(o);
    this.contextMenuItems.set(this.buildMenu(o));
    this.contextPos.set({ x: event.clientX, y: event.clientY });
    this.showContextMenu.set(true);
  }

  private buildMenu(o: ArachimOrder): ContextMenuItem[] {
    return [
      {
        label: o.isFrozen ? 'בטל הקפאה' : 'הקפא הזמנה',
        icon: o.isFrozen ? 'lock_open' : 'ac_unit',
        action: () => this.toggleFreeze(o),
      },
      {
        label: o.isCancelled ? 'שחזר הזמנה' : 'בטל הזמנה',
        icon: o.isCancelled ? 'restore' : 'cancel',
        action: () => this.toggleCancel(o),
        danger: !o.isCancelled,
      },
      {
        label: o.isImportant ? 'הסר חשיבות' : 'סמן כחשוב',
        icon: o.isImportant ? 'star_border' : 'star',
        action: () => this.toggleImportant(o),
      },
    ];
  }

  private toggleFreeze(o: ArachimOrder) {
    this.closeContextMenu();
    this.svc.freezeOrder(o.orderId, !o.isFrozen).subscribe({
      next: () => this.loadOrders(),
    });
  }

  private toggleCancel(o: ArachimOrder) {
    this.closeContextMenu();
    if (!o.isCancelled && !confirm(`לבטל הזמנה ${o.orderYear}-${o.orderNumber}?`)) return;
    this.svc.cancelOrder(o.orderId, !o.isCancelled).subscribe({
      next: () => this.loadOrders(),
    });
  }

  private toggleImportant(o: ArachimOrder) {
    this.closeContextMenu();
    const header = { ...o, isImportant: !o.isImportant, supplierId: o.supplierID, customerId: o.customerID, currencyId: o.currencyId };
    this.svc.updateOrder(o.orderId, { header }).subscribe({
      next: () => this.loadOrders(),
    });
  }

  closeContextMenu() { this.showContextMenu.set(false); }

  @HostListener('document:click')
  onDocumentClick() { this.closeContextMenu(); }

  // ── Dialog ────────────────────────────────────────────────────────────────
  onDialogSaved() {
    this.showDialog.set(false);
    this.loadOrders();
  }
  onDialogCancelled() { this.showDialog.set(false); }

  // ── Helpers ───────────────────────────────────────────────────────────────
  orderBadge(o: ArachimOrder): string {
    return `${o.orderYear}-${o.orderNumber.toString().padStart(3, '0')}`;
  }

  commDisplay(o: ArachimOrder): string {
    if (!o.commissionAmount) return '—';
    return o.commissionAmount.toLocaleString('he-IL', { maximumFractionDigits: 0 });
  }

  valueDisplay(o: ArachimOrder): string {
    if (!o.totalValue) return '—';
    return o.totalValue.toLocaleString('he-IL', { maximumFractionDigits: 0 });
  }

  dateDisplay(d: Date | null | undefined): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }
}
