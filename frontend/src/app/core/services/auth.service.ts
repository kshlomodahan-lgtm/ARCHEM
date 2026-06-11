import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { LoginRequest, LoginResponse, LoginUser } from '../models/auth.model';
import { ThemeService } from './theme.service';

const TOKEN_KEY = 'archem_token';
const USER_KEY  = 'archem_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user = signal<LoginUser | null>(this.loadUser());

  readonly user       = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);

  constructor(private http: HttpClient, private router: Router, private theme: ThemeService) {}

  login(req: LoginRequest) {
    return this.http.post<LoginResponse>('/api/auth/login', req).pipe(
      tap(res => {
        if (res.success) {
          localStorage.setItem(TOKEN_KEY, res.token);
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));
          this._user.set(res.user);
          if (res.theme) {
            this.theme.applyFromServer(res.theme.colorScheme, res.theme.darkMode);
          }
        }
      })
    );
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private loadUser(): LoginUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
