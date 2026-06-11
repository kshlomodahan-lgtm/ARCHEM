import '@progress/kendo-angular-intl/locales/he/all';
import { registerLocaleData } from '@angular/common';
import localeHe from '@angular/common/locales/he';
registerLocaleData(localeHe);

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { pdf } from '@progress/kendo-drawing';

// טעינת פונט עברי ל-PDF export (Kendo Drawing)
pdf.defineFont({
  'NotoSansHebrew': 'https://fonts.gstatic.com/s/notosanshebrew/v38/or3HQ7v33eiDljA1IufXTtVf7V6RvEEdhQlk0LlGxCyaeNKYZC0miQ.woff2',
});

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
