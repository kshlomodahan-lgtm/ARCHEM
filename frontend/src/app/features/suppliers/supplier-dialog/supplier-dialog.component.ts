import {
  Component, Input, Output, EventEmitter, OnInit, signal, inject, computed,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { DialogModule } from '@progress/kendo-angular-dialog';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { MatIconModule } from '@angular/material/icon';
import { Observable } from 'rxjs';
import { SuppliersService, SupplierSavePayload } from '../../../core/services/suppliers.service';
import { MetaService, Country, City, ContactMethodType, GeoPoint } from '../../../core/services/meta.service';
import { Supplier, SupplierContact } from '../../../core/models/arachim/supplier.model';

interface ExtraContactRow {
  methodTypeID: number;
  nameHE: string;
  icon: string | null;
  valueFormat: string;
  value: string;
  dialCountryID: number | null;
}

interface NavGroup { id: string; text: string; icon: string; }

@Component({
  selector: 'app-supplier-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    DialogModule, InputsModule, ButtonsModule, DropDownsModule, MatIconModule,
  ],
  templateUrl: './supplier-dialog.component.html',
  styleUrl: './supplier-dialog.component.scss',
})
export class SupplierDialogComponent implements OnInit {
  @Input() supplierId: number | null = null;
  @Output() saved     = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private fb        = inject(FormBuilder);
  private svc       = inject(SuppliersService);
  private meta      = inject(MetaService);
  private sanitizer = inject(DomSanitizer);

  activeGroup    = signal('general');
  saving         = signal(false);
  loadingData    = signal(false);
  enriching      = signal(false);
  enrichMsg      = signal('');
  enrichResult   = signal<any>(null);
  enrichSelected = signal<Set<string>>(new Set());
  showEnrichDlg  = signal(false);
  errorMsg       = '';

  private readonly ISRAEL_ID = 81;
  private readonly FIXED_METHOD_IDS = new Set([1, 2, 4, 10, 14]);

  countries         = signal<Country[]>([]);
  cities            = signal<City[]>([]);
  filteredCountries = signal<Country[]>([]);
  filteredCities    = signal<City[]>([]);
  selectedCountry   = signal<number | null>(81);
  contactTypes      = signal<ContactMethodType[]>([]);
  extraContacts     = signal<ExtraContactRow[]>([]);
  showPicker        = signal(false);

  // ── Map ──────────────────────────────────────────────────────────
  showMap     = signal(false);
  mapLoading  = signal(false);
  mapError    = signal('');
  mapCoords   = signal<GeoPoint | null>(null);

  mapSrc = computed((): SafeResourceUrl | null => {
    const c = this.mapCoords();
    if (!c) return null;
    const { lat, lon } = c;
    const d = 0.006;
    const url = `https://www.openstreetmap.org/export/embed.html`
      + `?bbox=${lon-d},${lat-d},${lon+d},${lat+d}`
      + `&layer=mapnik&marker=${lat},${lon}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  isIsrael = computed(() => this.selectedCountry() === this.ISRAEL_ID);

  dialItems = computed(() =>
    this.countries().filter(c => c.DialCode).map(c => ({
      CountryID: c.CountryID,
      label: `${c.DialCode} ${c.NameHE}`,
    }))
  );

  availableTypes = computed(() =>
    this.contactTypes().filter(t =>
      !this.FIXED_METHOD_IDS.has(t.MethodTypeID) &&
      !this.extraContacts().some(ec => ec.methodTypeID === t.MethodTypeID)
    )
  );


  readonly groups: NavGroup[] = [
    { id: 'general',  text: 'פרטי ספק',   icon: 'business'            },
    { id: 'business', text: 'עסקי',        icon: 'account_balance'     },
    { id: 'address',  text: 'כתובת',       icon: 'location_on'         },
    { id: 'contacts', text: 'התקשרות',     icon: 'phone'               },
    { id: 'sku',      text: 'מק"ט זמני',  icon: 'format_list_numbered'},
    { id: 'notes',    text: 'הערות',       icon: 'notes'               },
  ];

  private readonly groupFields: Record<string, string[]> = {
    general:  ['shortNameEN'],
    business: [],
    address:  [],
    contacts: [],
    notes:    [],
  };

  form = this.fb.group({
    // general
    shortNameEN:    ['', Validators.required],
    shortNameHE:    [''],
    fullNameEN:     [''],
    fullNameHE:     [''],
    isActive:       [true],
    // business
    vatNumber:      [''],
    psnPrefix:      [''],
    psnNumerator:   [null as number | null],
    // address
    addrCountryID:  [this.ISRAEL_ID as number | null],
    addrLine1:      [''],
    addrLine2:      [''],
    addrCityID:     [null as number | null],
    addrCityFree:   [''],
    addrZipCode:    [''],
    // contacts
    phone:          [''],
    phoneDial:      [this.ISRAEL_ID as number | null],
    mobile:         [''],
    mobileDial:     [this.ISRAEL_ID as number | null],
    fax:            [''],
    faxDial:        [this.ISRAEL_ID as number | null],
    email:          [''],
    website:        [''],
    // notes
    notes:          [''],
  });

  get isEdit() { return !!this.supplierId; }
  get title()  { return this.isEdit ? `עריכת ספק #${this.supplierId}` : 'ספק חדש'; }

  ngOnInit() {
    this.meta.getCountries().subscribe(list => {
      this.countries.set(list);
      this.filteredCountries.set(list);
    });

    this.meta.getContactMethodTypes().subscribe(types => this.contactTypes.set(types));

    this._loadCities(this.ISRAEL_ID);

    // האזן לשינוי מדינה
    this.form.get('addrCountryID')!.valueChanges.subscribe(countryId => {
      this.selectedCountry.set(countryId);
      this.form.patchValue({ addrCityID: null, addrCityFree: '' }, { emitEvent: false });
      if (countryId) this._loadCities(countryId);
      else this.cities.set([]);
    });

    if (this.supplierId) {
      this.loadingData.set(true);
      this.svc.getById(this.supplierId).subscribe({
        next: s => {
          this.loadingData.set(false);
          this._patchForm(s);
        },
        error: () => {
          this.loadingData.set(false);
          this.errorMsg = 'שגיאה בטעינת הספק';
        },
      });
    }
  }

  private _patchForm(s: Supplier) {
    this.form.patchValue({
      shortNameEN:  s.shortNameEN  || '',
      shortNameHE:  s.shortNameHE  || '',
      fullNameEN:   s.fullNameEN   || '',
      fullNameHE:   s.fullNameHE   || '',
      isActive:     s.isActive,
      vatNumber:    s.vatNumber    || '',
      psnPrefix:    s.psnPrefix    || '',
      psnNumerator: s.psnNumerator || null,
      notes:        s.notes        || '',
    });

    const addr = s.addresses?.find(a => a.isPrimary) ?? s.addresses?.[0];
    if (addr) {
      const countryId = addr.countryID ?? this.ISRAEL_ID;
      this.selectedCountry.set(countryId);
      if (countryId) this._loadCities(countryId);
      this.form.patchValue({
        addrCountryID: countryId,
        addrLine1:     addr.line1    || '',
        addrLine2:     addr.line2    || '',
        addrCityID:    addr.cityID   || null,
        addrCityFree:  addr.cityFree || '',
        addrZipCode:   addr.zipCode  || '',
      });
    }

    this._patchContacts(s.contactMethods || []);
  }

  private _patchContacts(contacts: SupplierContact[]) {
    // mssql returns PascalCase column names; support both PascalCase and camelCase
    const id  = (c: any) => c.MethodTypeID  ?? c.methodTypeID;
    const val = (c: any) => c?.Value        ?? c?.value        ?? '';
    const dial= (c: any) => c?.DialCountryID ?? c?.dialCountryID ?? this.ISRAEL_ID;

    const byId = (typeId: number) => contacts.find(c => id(c) === typeId);
    const phone   = byId(1);
    const mobile  = byId(2);
    const fax     = byId(4);
    const email   = byId(10);
    const website = byId(14);

    this.form.patchValue({
      phone:      val(phone),
      phoneDial:  dial(phone),
      mobile:     val(mobile),
      mobileDial: dial(mobile),
      fax:        val(fax),
      faxDial:    dial(fax),
      email:      val(email),
      website:    val(website),
    });

    // Extra contacts = all non-fixed types
    const extras = contacts.filter(c => !this.FIXED_METHOD_IDS.has(id(c)));
    if (extras.length) {
      this.extraContacts.set(extras.map(c => ({
        methodTypeID: id(c),
        nameHE:       (c as any).MethodTypeName ?? c.methodTypeName ?? '',
        icon:         (c as any).Icon           ?? c.icon           ?? null,
        valueFormat:  (c as any).ValueFormat    ?? c.valueFormat    ?? 'TEXT',
        value:        val(c),
        dialCountryID: (c as any).DialCountryID ?? c.dialCountryID  ?? null,
      })));
    }
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this._navigateToFirstError();
      this.errorMsg = 'יש שדות חובה שלא מולאו';
      return;
    }
    this.errorMsg = '';
    this.saving.set(true);

    const v = this.form.value;

    const payload: SupplierSavePayload = {
      supplier: {
        shortNameEN:    v.shortNameEN    || null,
        shortNameHE:    v.shortNameHE    || null,
        fullNameEN:     v.fullNameEN     || null,
        fullNameHE:     v.fullNameHE     || null,
        vatNumber:      v.vatNumber      || null,
        supplierTypeID: null,
        paymentBankID:  null,
        psnPrefix:      v.psnPrefix      || null,
        psnNumerator:   v.psnNumerator   || null,
        notes:          v.notes          || null,
        isActive:       v.isActive !== false,
      },
      address: {
        line1:     v.addrLine1    || null,
        line2:     v.addrLine2    || null,
        cityID:    this.isIsrael() ? (v.addrCityID || null) : null,
        cityFree:  this.isIsrael()
                     ? (this.cities().find(c => c.CityID === v.addrCityID)?.NameHE || null)
                     : (v.addrCityFree || null),
        zipCode:   v.addrZipCode  || null,
        countryID: v.addrCountryID || null,
      },
      contacts: this._buildContacts(v),
    };

    const call: Observable<unknown> = this.isEdit
      ? this.svc.update(this.supplierId!, payload)
      : this.svc.create(payload);

    call.subscribe({
      next: () => { this.saving.set(false); this.saved.emit(); },
      error: (err: any) => {
        this.saving.set(false);
        this.errorMsg = err?.error?.message || 'שגיאה בשמירה';
      },
    });
  }

  private _buildContacts(v: typeof this.form.value) {
    const list: SupplierSavePayload['contacts'] = [];
    if (v.phone)   list.push({ methodTypeID: 1,  value: v.phone,   dialCountryID: v.phoneDial  ?? null, label: null, isPrimary: true  });
    if (v.mobile)  list.push({ methodTypeID: 2,  value: v.mobile,  dialCountryID: v.mobileDial ?? null, label: null, isPrimary: false });
    if (v.fax)     list.push({ methodTypeID: 4,  value: v.fax,     dialCountryID: v.faxDial    ?? null, label: null, isPrimary: false });
    if (v.email)   list.push({ methodTypeID: 10, value: v.email,   dialCountryID: null,                  label: null, isPrimary: true  });
    if (v.website) list.push({ methodTypeID: 14, value: v.website, dialCountryID: null,                  label: null, isPrimary: false });
    for (const ec of this.extraContacts()) {
      if (ec.value.trim()) {
        list.push({ methodTypeID: ec.methodTypeID, value: ec.value, dialCountryID: ec.dialCountryID, label: null, isPrimary: false });
      }
    }
    return list;
  }

  private _navigateToFirstError() {
    for (const [group, fields] of Object.entries(this.groupFields)) {
      if (fields.some(f => this.form.get(f)?.invalid)) {
        this.activeGroup.set(group);
        return;
      }
    }
  }

  onCountryFilter(value: string) {
    const q = value.toLowerCase();
    this.filteredCountries.set(
      this.countries().filter(c => c.NameHE.toLowerCase().includes(q) || c.NameEN?.toLowerCase().includes(q))
    );
  }

  onCityFilter(value: string) {
    const q = value.toLowerCase();
    this.filteredCities.set(
      this.cities().filter(c => c.NameHE.toLowerCase().includes(q) || c.NameEN?.toLowerCase().includes(q))
    );
  }

  private _loadCities(countryId: number) {
    this.meta.getCities(countryId).subscribe(list => {
      this.cities.set(list);
      this.filteredCities.set(list);
    });
  }

  addExtraContact(type: ContactMethodType) {
    this.extraContacts.update(list => [...list, {
      methodTypeID:  type.MethodTypeID,
      nameHE:        type.NameHE,
      icon:          type.Icon,
      valueFormat:   type.ValueFormat,
      value:         '',
      dialCountryID: type.ValueFormat === 'PHONE' ? this.ISRAEL_ID : null,
    }]);
    this.showPicker.set(false);
  }

  removeExtraContact(index: number) {
    this.extraContacts.update(list => list.filter((_, i) => i !== index));
  }

  updateExtraValue(index: number, value: string) {
    this.extraContacts.update(list =>
      list.map((ec, i) => i === index ? { ...ec, value } : ec)
    );
  }

  updateExtraDial(index: number, dialCountryID: number | null) {
    this.extraContacts.update(list =>
      list.map((ec, i) => i === index ? { ...ec, dialCountryID } : ec)
    );
  }

  toggleMap() {
    if (this.showMap()) { this.showMap.set(false); return; }
    this.showMap.set(true);
    if (this.mapCoords()) return; // כבר נטען
    this._loadMapCoords();
  }

  private _loadMapCoords() {
    const v = this.form.value;
    const city = this.isIsrael()
      ? (this.cities().find(c => c.CityID === v.addrCityID)?.NameHE || v.addrCityFree || '')
      : (v.addrCityFree || '');
    const country = this.countries().find(c => c.CountryID === v.addrCountryID)?.NameEN || '';
    const parts = [v.addrLine1, city, country].map(s => (s || '').trim()).filter(Boolean);

    if (!parts.length) { this.mapError.set('אין כתובת להצגה'); return; }

    this.mapLoading.set(true);
    this.mapError.set('');
    this.meta.geocode(parts.join(', '), city, country).subscribe({
      next: pt => {
        this.mapLoading.set(false);
        if (pt) this.mapCoords.set(pt);
        else this.mapError.set('הכתובת לא נמצאה במפה');
      },
      error: () => { this.mapLoading.set(false); this.mapError.set('שגיאה בטעינת מפה'); },
    });
  }

  refreshMap() {
    this.mapCoords.set(null);
    this.mapError.set('');
    this._loadMapCoords();
  }

  enrichFromAI() {
    const v = this.form.value;
    const nameParts = [v.shortNameEN, v.fullNameEN, v.shortNameHE, v.fullNameHE]
      .map(s => (s || '').trim()).filter(Boolean);
    const name = [...new Set(nameParts)].join(' / ');
    if (!name) return;

    this.enriching.set(true);
    this.enrichMsg.set('');

    this.svc.aiLookup(name).subscribe({
      next: data => {
        this.enriching.set(false);
        if (!data) { this.enrichMsg.set('לא נמצאו פרטים'); return; }
        this.enrichResult.set(data);
        const fields = ['fullNameEN','fullNameHE','vatNumber','phone','email','website','addressLine1','city','country','notes'];
        this.enrichSelected.set(new Set(fields.filter(f => data[f])));
        this.showEnrichDlg.set(true);
      },
      error: (err: any) => {
        this.enriching.set(false);
        this.enrichMsg.set(err?.error?.message || 'שגיאה בחיפוש AI');
      },
    });
  }

  toggleEnrichField(field: string) {
    const s = new Set(this.enrichSelected());
    s.has(field) ? s.delete(field) : s.add(field);
    this.enrichSelected.set(s);
  }

  isEnrichSelected(field: string) { return this.enrichSelected().has(field); }

  applyEnrichment() {
    const d = this.enrichResult();
    const sel = this.enrichSelected();
    if (!d) return;

    const patch: any = {};
    if (sel.has('fullNameEN')   && d.fullNameEN)   patch.fullNameEN = d.fullNameEN;
    if (sel.has('fullNameHE')   && d.fullNameHE)   patch.fullNameHE = d.fullNameHE;
    if (sel.has('vatNumber')    && d.vatNumber)    patch.vatNumber  = d.vatNumber;
    if (sel.has('website')      && d.website)      patch.website    = d.website;
    if (sel.has('phone')        && d.phone)        patch.phone      = d.phone;
    if (sel.has('email')        && d.email)        patch.email      = d.email;
    if (sel.has('addressLine1') && d.addressLine1) patch.addrLine1  = d.addressLine1;
    if (sel.has('notes')        && d.notes)        patch.notes      = d.notes;

    // Resolve country name → CountryID
    let resolvedCountryID: number | null = null;
    if (sel.has('country') && d.country) {
      const q = d.country.trim().toLowerCase();
      const matched = this.countries().find(c =>
        c.NameEN?.toLowerCase() === q || c.NameHE?.toLowerCase() === q
      );
      if (matched) {
        resolvedCountryID = matched.CountryID;
        patch.addrCountryID = matched.CountryID;
      }
    }

    // Helper: resolve city name → CityID if the cities list has entries, else free text
    const resolveCity = (citiesList: City[]) => {
      if (!sel.has('city') || !d.city) return;
      if (!citiesList.length) {
        this.form.patchValue({ addrCityFree: d.city });
        return;
      }
      const q = d.city.trim().toLowerCase();
      const matched = citiesList.find(c =>
        c.NameHE?.toLowerCase() === q || c.NameEN?.toLowerCase() === q
      );
      if (matched) {
        this.form.patchValue({ addrCityID: matched.CityID, addrCityFree: matched.NameHE });
      } else {
        this.form.patchValue({ addrCityFree: d.city });
      }
    };

    this.form.patchValue(patch);
    this.showEnrichDlg.set(false);
    this.enrichResult.set(null);

    // If country changed, load cities for new country then resolve city
    if (resolvedCountryID && resolvedCountryID !== this.selectedCountry()) {
      this.meta.getCities(resolvedCountryID).subscribe(cities => {
        this.cities.set(cities);
        this.filteredCities.set(cities);
        resolveCity(cities);
      });
    } else {
      resolveCity(this.cities());
    }

    const count = sel.size;
    this.enrichMsg.set(`✓ ${count} פרטים מולאו אוטומטית`);
    setTimeout(() => this.enrichMsg.set(''), 4000);
  }

  closeEnrichDlg() {
    this.showEnrichDlg.set(false);
    this.enrichResult.set(null);
  }

  cancel() { this.cancelled.emit(); }
}
