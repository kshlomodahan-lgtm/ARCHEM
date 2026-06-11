import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  username = '';
  password = '';
  loading  = signal(false);
  error    = signal('');

  constructor(private auth: AuthService, private router: Router) {}

  login() {
    if (!this.username || !this.password) {
      this.error.set('יש למלא שם משתמש וסיסמה');
      return;
    }
    this.loading.set(true);
    this.error.set('');

    this.auth.login({ username: this.username, password: this.password }).subscribe({
      next: res => {
        this.loading.set(false);
        if (res.success) this.router.navigate(['/app/orders']);
        else this.error.set(res.message || 'שגיאה בהתחברות');
      },
      error: () => {
        this.loading.set(false);
        this.error.set('שגיאה בהתחברות — בדוק פרטים');
      },
    });
  }
}
