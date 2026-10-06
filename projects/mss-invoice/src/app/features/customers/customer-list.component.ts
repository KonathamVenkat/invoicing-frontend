import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { IconComponent } from '../../shared/icon/icon.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';

import { CustomerService } from '../../core/services/customer.service';
import { Customer, CustomerType } from '../../core/models/customer.model';

@Component({
  selector: 'app-customer-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatTableModule,
    MatButtonModule,
    MatCardModule,
    IconComponent,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatPaginatorModule,
  ],
  templateUrl: './customer-list.component.html',
  styleUrl: './customer-list.component.css',
})
export class CustomerListComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly service = inject(CustomerService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly injector = inject(Injector);

  private readonly firstField = viewChild<ElementRef<HTMLInputElement>>('firstField');
  private readonly newButton = viewChild.required('newButton', { read: ElementRef<HTMLElement> });
  private returnFocusTo: HTMLElement | null = null;

  readonly columns = ['name', 'customerType', 'vatNumber', 'actions'];
  readonly customers = signal<Customer[]>([]);
  readonly totalElements = signal(0);
  readonly pageSize = signal(20);
  readonly pageIndex = signal(0);
  readonly editing = signal(false);
  /** The customer being edited, or null when creating a new one. */
  readonly editingCustomer = signal<Customer | null>(null);
  readonly formTitle = computed(() => (this.editingCustomer() ? 'Edit Customer' : 'New Customer'));

  readonly filterForm = this.fb.group({
    search: [''],
  });

  /** Filter value as a signal, so OnPush views update on every keystroke. */
  private readonly filters = toSignal(
    this.filterForm.valueChanges.pipe(map(() => this.filterForm.getRawValue())),
    { initialValue: this.filterForm.getRawValue() },
  );

  readonly hasActiveFilters = computed(() => !!this.filters().search);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    customerCode: ['', Validators.required],
    customerType: this.fb.control<CustomerType>('COMPANY', Validators.required),
    vatNumber: [''],
    email: ['', Validators.email],
    phone: [''],
    addressLine: [''],
    poBox: [''],
    postalCode: [''],
    city: [''],
  });

  /** Keeps table rows (and their focusable buttons) stable across reloads. */
  readonly trackById = (_: number, customer: Customer) => customer.id ?? customer.name;

  ngOnInit(): void {
    this.load();

    // Debounced so we don't hit the backend on every keystroke.
    this.filterForm.controls.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => this.applyFilters());
  }

  load(): void {
    const { search } = this.filterForm.getRawValue();
    this.service.search(search || undefined, this.pageIndex(), this.pageSize()).subscribe({
      next: (r) => {
        this.customers.set(r.content);
        this.totalElements.set(r.totalElements);
      },
      error: () =>
        this.snackBar.open("Couldn't load customers. Refresh the page to try again.", 'Close', {
          duration: 6000,
        }),
    });
  }

  /** Any filter change resets to page 1 — staying on a later page of a now-much-shorter
   *  filtered result set would just show an empty page. */
  applyFilters(): void {
    this.pageIndex.set(0);
    this.load();
  }

  clearFilters(): void {
    // valueChanges (subscribed in ngOnInit) picks up this reset and calls applyFilters()
    // automatically — no need to call it again here.
    this.filterForm.reset();
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  startNew(event: Event): void {
    this.editingCustomer.set(null);
    this.form.reset();
    this.openForm(event);
  }

  edit(customer: Customer, event: Event): void {
    this.editingCustomer.set(customer);
    this.form.reset({
      name: customer.name,
      customerCode: customer.customerCode ?? '',
      customerType: customer.customerType,
      vatNumber: customer.vatNumber ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      addressLine: customer.addressLine ?? '',
      poBox: customer.poBox ?? '',
      postalCode: customer.postalCode ?? '',
      city: customer.city ?? '',
    });
    this.openForm(event);
  }

  cancelEdit(): void {
    this.closeForm();
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Some fields need attention. Check the highlighted fields and try again.', 'Close', {
        duration: 6000,
      });
      return;
    }
    const existing = this.editingCustomer();
    // Merge onto the existing record so fields not shown in this form are kept on update.
    const value: Customer = { ...existing, ...this.form.getRawValue(), active: existing?.active ?? true };

    const request = existing?.id
      ? this.service.update(existing.id, value)
      : this.service.create(value);
    request.subscribe({
      next: () => {
        this.snackBar.open('Customer saved', 'Close', { duration: 3000 });
        this.closeForm();
        this.load();
      },
      error: (err: HttpErrorResponse) =>
        this.snackBar.open(
          err.error?.detail ??
            "Couldn't save the customer. Your details are still in the form. Check your connection and try again.",
          'Close',
          { duration: 6000 },
        ),
    });
  }

  private openForm(event: Event): void {
    this.returnFocusTo = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.editing.set(true);
    afterNextRender(() => this.firstField()?.nativeElement.focus(), { injector: this.injector });
  }

  private closeForm(): void {
    this.editing.set(false);
    // The row button may have been re-rendered after a reload; fall back to the New button.
    const target = this.returnFocusTo?.isConnected ? this.returnFocusTo : this.newButton().nativeElement;
    this.returnFocusTo = null;
    afterNextRender(() => target.focus(), { injector: this.injector });
  }
}
