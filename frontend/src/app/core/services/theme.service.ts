import { Injectable, effect, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type ThemeMode   = 'light' | 'dark';
export type ColorScheme = 'blue' | 'teal' | 'purple' | 'green' | 'rose' | 'amber';

export interface SchemeDef {
  id:      ColorScheme;
  label:   string;
  primary: string;
}

export const COLOR_SCHEMES: SchemeDef[] = [
  { id: 'blue',   label: 'כחול',  primary: '#0D47FF' },
  { id: 'teal',   label: 'תכלת',  primary: '#0891b2' },
  { id: 'purple', label: 'סגול',  primary: '#7c3aed' },
  { id: 'green',  label: 'ירוק',  primary: '#059669' },
  { id: 'rose',   label: 'אדום',  primary: '#e11d48' },
  { id: 'amber',  label: 'כתום',  primary: '#d97706' },
];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly MODE_KEY   = 'sf-theme-mode';
  private readonly SCHEME_KEY = 'sf-theme-scheme';

  mode   = signal<ThemeMode>  ((localStorage.getItem(this.MODE_KEY)   as ThemeMode)   ?? 'light');
  scheme = signal<ColorScheme>((localStorage.getItem(this.SCHEME_KEY) as ColorScheme) ?? 'blue');

  readonly schemes = COLOR_SCHEMES;

  constructor(private http: HttpClient) {
    effect(() => {
      const m = this.mode();
      const s = this.scheme();
      document.documentElement.setAttribute('data-theme',  m);
      document.documentElement.setAttribute('data-scheme', s);
      localStorage.setItem(this.MODE_KEY,   m);
      localStorage.setItem(this.SCHEME_KEY, s);
    });
  }

  // קריאה מהשרת (אחרי login) — מחליף localStorage
  applyFromServer(colorScheme: string, darkMode: boolean) {
    const scheme = (COLOR_SCHEMES.find(s => s.id === colorScheme)?.id ?? 'blue') as ColorScheme;
    this.scheme.set(scheme);
    this.mode.set(darkMode ? 'dark' : 'light');
  }

  toggleMode()              { this.mode.update(m => m === 'light' ? 'dark' : 'light'); }
  setScheme(s: ColorScheme) { this.scheme.set(s); }
  isDark()                  { return this.mode() === 'dark'; }

  // שמירת העדפה אישית לשרת
  saveUserTheme() {
    return this.http.put('/api/theme/user', {
      colorScheme: this.scheme(),
      darkMode:    this.isDark(),
    });
  }

  // שמירת ברירת מחדל לארגון (מנהל בלבד)
  saveOrgTheme() {
    return this.http.put('/api/theme/org', {
      colorScheme: this.scheme(),
      darkMode:    this.isDark(),
    });
  }
}
