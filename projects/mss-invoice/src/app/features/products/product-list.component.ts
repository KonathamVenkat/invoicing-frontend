import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
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
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { IconComponent } from '../../shared/icon/icon.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';

import { ProductService } from '../../core/services/product.service';
import { CustomerService } from '../../core/services/customer.service';
import { Product } from '../../core/models/product.model';
import { Customer } from '../../core/models/customer.model';

@Component({
  selector: 'app-product-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DecimalPipe,
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
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.css',
})
export class ProductListComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly service = inject(ProductService);
  private readonly customerService = inject(CustomerService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly injector = inject(Injector);

  private readonly firstField = viewChild<ElementRef<HTMLInputElement>>('firstField');
  private readonly newButton = viewChild.required('newButton', { read: ElementRef<HTMLElement> });
  private returnFocusTo: HTMLElement | null = null;

  readonly columns = ['name', 'customerName', 'defaultPrice', 'defaultVatPct', 'actions'];
  readonly products = signal<Product[]>([]);
  readonly customers = signal<Customer[]>([]);
  readonly totalElements = signal(0);
  readonly pageSize = signal(20);
  readonly pageIndex = signal(0);
  readonly editing = signal(false);
  /** The product being edited, or null when creating a new one. */
  readonly editingProduct = signal<Product | null>(null);
  readonly formTitle = computed(() => (this.editingProduct() ? 'Edit Product' : 'New Product'));

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
    code: [''],
    unit: ['EA', Validators.required],
    defaultPrice: [0, [Validators.required, Validators.min(0)]],
    defaultVatPct: [5, [Validators.required, Validators.min(0)]],
    description: [''],
    customerId: this.fb.control<number | null>(null),
  });

  /** Keeps table rows (and their focusable buttons) stable across reloads. */
  readonly trackById = (_: number, product: Product) => product.id ?? product.name;

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

    // Debounced so we don't hit the backend on every keystroke.
    this.filterForm.controls.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => this.applyFilters());
  }

  load(): void {
    const { search } = this.filterForm.getRawValue();
    this.service.search(search || undefined, this.pageIndex(), this.pageSize()).subscribe({
      next: (r) => {
        this.products.set(r.content);
        this.totalElements.set(r.totalElements);
      },
      error: () =>
        this.snackBar.open("Couldn't load products. Refresh the page to try again.", 'Close', {
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
    this.editingProduct.set(null);
    this.form.reset();
    this.openForm(event);
  }

  edit(product: Product, event: Event): void {
    this.editingProduct.set(product);
    this.form.reset({
      name: product.name,
      code: product.code ?? '',
      unit: product.unit,
      defaultPrice: product.defaultPrice,
      defaultVatPct: product.defaultVatPct,
      description: product.description ?? '',
      customerId: product.customerId ?? null,
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
    const existing = this.editingProduct();
    // Merge onto the existing record so fields not shown in this form are kept on update.
    const value: Product = { ...existing, ...this.form.getRawValue(), active: existing?.active ?? true };

    const request = existing?.id
      ? this.service.update(existing.id, value)
      : this.service.create(value);
    request.subscribe({
      next: () => {
        this.snackBar.open('Product saved', 'Close', { duration: 3000 });
        this.closeForm();
        this.load();
      },
      error: (err: HttpErrorResponse) =>
        this.snackBar.open(
          err.error?.detail ??
            "Couldn't save the product. Your details are still in the form. Check your connection and try again.",
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
