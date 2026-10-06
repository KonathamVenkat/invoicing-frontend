import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CompanyService } from '../../core/services/company.service';
import { AuthService } from '../../core/services/auth.service';
import { Company } from '../../core/models/company.model';

@Component({
  selector: 'app-company-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatCardModule, MatProgressBarModule],
  templateUrl: './company-settings.component.html',
  styleUrl: './company-settings.component.css',
})
export class CompanySettingsComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly service = inject(CompanyService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly auth = inject(AuthService);

  /** The saved company profile, or null until one exists. */
  private readonly company = signal<Company | null>(null);
  readonly hasProfile = computed(() => !!this.company()?.id);
  readonly isAdmin = computed(() => this.auth.hasRole('ADMIN'));
  readonly saving = signal(false);

  readonly form = this.fb.group({
    legalName: ['', Validators.required],
    addressLine: [''],
    poBox: [''],
    postalCode: [''],
    city: [''],
    phone: [''],
    email: ['', Validators.email],
    vatNumber: [''],
    taxCardNumber: [''],
    mofCode: [''],
    bankName: [''],
    bankAccountName: [''],
    bankAccountNumber: [''],
    bankIban: [''],
    invoiceFooterNote: [''],
  });

  ngOnInit(): void {
    // Non-admins can view the profile but not edit it; the backend enforces this too.
    if (!this.isAdmin()) {
      this.form.disable();
    }
    this.service.list().subscribe({
      next: (companies) => {
        if (companies.length > 0) {
          this.company.set(companies[0]);
          // reset() puts any field the backend left empty back to its '' default.
          this.form.reset(companies[0]);
        }
      },
      error: () =>
        this.snackBar.open("Couldn't load the company profile. Refresh the page to try again.", 'Close', {
          duration: 6000,
        }),
    });
  }

  /** Puts the form back to the last saved profile (or empty, if there isn't one yet). */
  discardChanges(): void {
    this.form.reset(this.company() ?? undefined);
  }

  save(): void {
    if (!this.isAdmin()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Some fields need attention. Check the highlighted fields and try again.', 'Close', {
        duration: 6000,
      });
      return;
    }
    const existing = this.company();
    // Merge onto the existing record so fields not shown in this form are kept on update.
    const value: Company = { ...existing, ...this.form.getRawValue() };

    const request = existing?.id
      ? this.service.update(existing.id, value)
      : this.service.create(value);

    this.saving.set(true);
    request.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.company.set(saved);
        this.form.markAsPristine();
        this.snackBar.open('Company profile saved', 'Close', { duration: 3000 });
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.snackBar.open(
          err.error?.detail ??
            "Couldn't save the company profile. Your changes are still in the form. Check your connection and try again.",
          'Close',
          { duration: 6000 },
        );
      },
    });
  }
}
