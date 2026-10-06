import { DatePipe } from '@angular/common';
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
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { map } from 'rxjs';

import { IconComponent } from '../../shared/icon/icon.component';
import { AuthService } from '../../core/services/auth.service';
import { ContractService } from '../../core/services/contract.service';
import { CustomerService } from '../../core/services/customer.service';
import { ProductService } from '../../core/services/product.service';
import { Contract } from '../../core/models/contract.model';
import { Customer } from '../../core/models/customer.model';
import { Product } from '../../core/models/product.model';

// Local-time date helpers — see invoice-editor.component.ts for why these avoid
// toISOString()/new Date(isoString) (both round-trip through UTC and can shift the date).
function toIsoDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIsoDateLocal(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

@Component({
  selector: 'app-contract-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatTableModule,
    MatButtonModule,
    MatCardModule,
    IconComponent,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTooltipModule,
    MatPaginatorModule,
  ],
  templateUrl: './contract-list.component.html',
  styleUrl: './contract-list.component.css',
})
export class ContractListComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly service = inject(ContractService);
  private readonly customerService = inject(CustomerService);
  private readonly productService = inject(ProductService);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly injector = inject(Injector);

  private readonly firstField = viewChild<ElementRef<HTMLElement>>('firstField');
  private readonly newButton = viewChild.required('newButton', { read: ElementRef<HTMLElement> });
  private returnFocusTo: HTMLElement | null = null;

  readonly columns = ['contractCode', 'customerName', 'productName', 'startDate', 'endDate', 'actions'];
  readonly contracts = signal<Contract[]>([]);
  readonly customers = signal<Customer[]>([]);
  readonly products = signal<Product[]>([]);
  readonly totalElements = signal(0);
  readonly pageSize = signal(20);
  readonly pageIndex = signal(0);
  readonly editing = signal(false);
  /** The contract being edited, or null when creating a new one. */
  readonly editingContract = signal<Contract | null>(null);
  readonly formTitle = computed(() => (this.editingContract() ? 'Edit Contract' : 'New Contract'));
  readonly canDelete = computed(() => this.authService.hasRole('ADMIN'));

  readonly form = this.fb.group({
    customerId: this.fb.control<number | null>(null, Validators.required),
    productId: this.fb.control<number | null>(null, Validators.required),
    contractCode: ['', Validators.required],
    startDate: this.fb.control<Date | null>(null, Validators.required),
    endDate: this.fb.control<Date | null>(null, Validators.required),
    notes: [''],
  });

  /** Keeps table rows (and their focusable buttons) stable across reloads. */
  readonly trackById = (_: number, contract: Contract) => contract.id ?? contract.contractCode;

  readonly selectedCustomerId = toSignal(this.form.controls.customerId.valueChanges, {
    initialValue: this.form.controls.customerId.value,
  });

  /** Products scoped to the contract's customer, plus general (unlinked) products —
   *  a product tied to a different customer shouldn't be selectable on this contract. */
  readonly filteredProducts = computed(() => {
    const customerId = this.selectedCustomerId();
    return this.products().filter((p) => !p.customerId || p.customerId === customerId);
  });

  readonly filterForm = this.fb.group({
    customerId: this.fb.control<number | null>(null),
    productId: this.fb.control<number | null>(null),
  });

  /** Filter values as a signal, so OnPush views update on every change. */
  private readonly filters = toSignal(
    this.filterForm.valueChanges.pipe(map(() => this.filterForm.getRawValue())),
    { initialValue: this.filterForm.getRawValue() },
  );

  readonly hasActiveFilters = computed(() => {
    const { customerId, productId } = this.filters();
    return !!(customerId || productId);
  });

  /** Products scoped to the filter bar's selected customer, same rule as the create/edit
   *  form — a product tied to a different customer can't have a contract with this one. */
  readonly filteredProductsForFilter = computed(() => {
    const customerId = this.filters().customerId;
    return this.products().filter((p) => !p.customerId || p.customerId === customerId);
  });

  ngOnInit(): void {
    this.load();
    this.customerService.search(undefined, 0, 100).subscribe({
      next: (r) => this.customers.set(r.content),
      error: () =>
        this.snackBar.open(
          "Couldn't load customers, so the Customer list is empty. Refresh the page to try again.",
          'Close',
          { duration: 6000 },
        ),
    });
    this.productService.search(undefined, 0, 100).subscribe({
      next: (r) => this.products.set(r.content),
      error: () =>
        this.snackBar.open(
          "Couldn't load products, so the Product list is empty. Refresh the page to try again.",
          'Close',
          { duration: 6000 },
        ),
    });

    this.form.controls.customerId.valueChanges.subscribe((id) => this.clearMismatchedProduct(id));

    this.filterForm.controls.customerId.valueChanges.subscribe(() => this.applyFilters());
    this.filterForm.controls.productId.valueChanges.subscribe(() => this.applyFilters());
  }

  /** Clears the selected product if it's tied to a different customer than the one now
   *  chosen — the product would no longer even appear in filteredProducts(), so leaving
   *  its id in the form would silently save a customer/product mismatch. */
  private clearMismatchedProduct(customerId: number | null): void {
    const productId = this.form.controls.productId.value;
    if (!productId) return;

    const product = this.products().find((p) => p.id === productId);
    if (product?.customerId && product.customerId !== customerId) {
      this.form.controls.productId.setValue(null);
    }
  }

  load(): void {
    const { customerId, productId } = this.filterForm.getRawValue();
    this.service
      .search(customerId ?? undefined, productId ?? undefined, this.pageIndex(), this.pageSize())
      .subscribe({
        next: (r) => {
          this.contracts.set(r.content);
          this.totalElements.set(r.totalElements);
        },
        error: () =>
          this.snackBar.open("Couldn't load contracts. Refresh the page to try again.", 'Close', {
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
    this.editingContract.set(null);
    this.form.reset();
    this.openForm(event);
  }

  edit(contract: Contract, event: Event): void {
    this.editingContract.set(contract);
    this.form.reset({
      customerId: contract.customerId,
      productId: contract.productId,
      contractCode: contract.contractCode,
      startDate: parseIsoDateLocal(contract.startDate),
      endDate: parseIsoDateLocal(contract.endDate),
      notes: contract.notes ?? '',
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
    const value = this.form.getRawValue();
    const payload: Contract = {
      customerId: value.customerId!,
      productId: value.productId!,
      contractCode: value.contractCode,
      startDate: toIsoDate(value.startDate!),
      endDate: toIsoDate(value.endDate!),
      notes: value.notes || undefined,
    };

    const existing = this.editingContract();
    const request = existing?.id ? this.service.update(existing.id, payload) : this.service.create(payload);
    request.subscribe({
      next: () => {
        this.snackBar.open('Contract saved', 'Close', { duration: 3000 });
        this.closeForm();
        this.load();
      },
      error: (err: HttpErrorResponse) =>
        this.snackBar.open(
          err.error?.detail ??
            "Couldn't save the contract. Your details are still in the form. Check your connection and try again.",
          'Close',
          { duration: 6000 },
        ),
    });
  }

  delete(contract: Contract, event: Event): void {
    if (!contract.id || !this.canDelete()) return;
    if (!window.confirm(`Delete contract ${contract.contractCode}?`)) return;

    const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.service.delete(contract.id).subscribe({
      next: () => {
        this.snackBar.open('Contract deleted', 'Close', { duration: 3000 });
        this.load();
        const focusTarget = target?.isConnected ? target : this.newButton().nativeElement;
        afterNextRender(() => focusTarget.focus(), { injector: this.injector });
      },
      error: () =>
        this.snackBar.open("Couldn't delete the contract. Try again.", 'Close', { duration: 6000 }),
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
