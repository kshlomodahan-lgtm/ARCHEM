import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../core/services/auth.service';
import { ThemeService } from '../core/services/theme.service';

interface NavItem { icon: string; label: string; route: string; badge?: string; }

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet, RouterLink, RouterLinkActive,
    MatIconModule, MatButtonModule, MatTooltipModule,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  sidebarOpen = true;
  infraOpen    = signal(false);
  catalogOpen  = signal(false);

  mainItems: NavItem[] = [
    { icon: 'receipt_long',   label: 'הזמנות',     route: '/app/orders'       },
    { icon: 'local_shipping', label: 'ספקים',      route: '/app/suppliers'    },
    { icon: 'people',         label: 'לקוחות',     route: '/app/customers'    },
    { icon: 'upload_file',    label: 'קליטת מסמך', route: '/app/order-intake' },
  ];

  infraItems: NavItem[] = [
    { icon: 'account_balance',   label: 'בנקים',             route: '/app/refdata/banks'           },
    { icon: 'local_police',      label: 'עמילי מכס',         route: '/app/refdata/customs-brokers' },
    { icon: 'flight_takeoff',    label: 'משלחים',            route: '/app/refdata/forwarders'      },
    { icon: 'percent',           label: 'הנחיות',            route: '/app/refdata/discount-rules'  },
    { icon: 'description',       label: 'סוגי מסמכים',       route: '/app/refdata/document-types'  },
    { icon: 'print',             label: 'פרמטרי מדפסת',     route: '/app/refdata/printer-params'  },
    { icon: 'currency_exchange', label: 'שערי מטבע',         route: '/app/refdata/currency-rates'  },
    { icon: 'public',            label: 'מדינות',            route: '/app/refdata/countries'       },
    { icon: 'straighten',        label: 'יחידות מידה',       route: '/app/refdata/uom'             },
    { icon: 'payments',          label: 'תנאי תשלום',        route: '/app/refdata/payment-terms'   },
    { icon: 'handshake',         label: 'תנאי מכירה',        route: '/app/refdata/terms-of-sale'   },
    { icon: 'inventory_2',       label: 'סוגי מכולות',       route: '/app/refdata/container-types' },
    { icon: 'warehouse',         label: 'מחסנים',            route: '/app/refdata/warehouses'      },
    { icon: 'import_export',     label: 'סטטוסי יבוא',       route: '/app/refdata/import-status'   },
    { icon: 'receipt',           label: 'סוגי הזמנות',       route: '/app/refdata/order-types'     },
    { icon: 'person',            label: 'אנשי מכירות',       route: '/app/refdata/sales-persons'   },
    { icon: 'location_city',     label: 'ערים',              route: '/app/refdata/cities'          },
    { icon: 'eco',               label: 'סוגי כשרות',        route: '/app/refdata/kosher-types'    },
    { icon: 'category',          label: 'קטגוריות פריטים',   route: '/app/refdata/item-categories' },
  ];

  catalogItems: NavItem[] = [
    { icon: 'auto_awesome',    label: 'תור המקטלג',       route: '/app/catalog/cataloger'            },
    { icon: 'label',           label: 'תבניות מאפיינים',  route: '/app/catalog/attribute-templates'  },
  ];

  constructor(public auth: AuthService, public theme: ThemeService) {}

  logout() { this.auth.logout(); }
}
