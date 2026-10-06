import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { AuthService } from '../../../core/services/auth.service';
import { IconComponent } from '../../../shared/icon/icon.component';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    IconComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly usernameField = viewChild.required<ElementRef<HTMLInputElement>>('usernameField');
  private readonly passwordField = viewChild.required<ElementRef<HTMLInputElement>>('passwordField');

  readonly error = signal<string | null>(null);
  readonly signingIn = signal(false);

  readonly form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
    remember: [false],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // Moving focus makes screen readers read out the field and its error message.
      const firstEmpty = this.form.controls.username.invalid ? this.usernameField() : this.passwordField();
      firstEmpty.nativeElement.focus();
      return;
    }
    const { username, password } = this.form.getRawValue();

    this.error.set(null);
    this.signingIn.set(true);
    this.auth.login(username, password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err: HttpErrorResponse) => {
        this.signingIn.set(false);
        this.error.set(
          err.error?.detail ?? "Couldn't sign you in. Check your username and password and try again.",
        );
      },
    });
  }
}
