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
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatExpansionModule } from '@angular/material/expansion';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { map, startWith } from 'rxjs';

import { IconComponent } from '../../../shared/icon/icon.component';
import { InvoiceService } from '../../../core/services/invoice.service';
import { CustomerService } from '../../../core/services/customer.service';
import { ProductService } from '../../../core/services/product.service';
import { ContractService } from '../../../core/services/contract.service';
import { CompanyService } from '../../../core/services/company.service';
import { AuthService } from '../../../core/services/auth.service';
import { PaymentService } from '../../../core/services/payment.service';
import { Customer } from '../../../core/models/customer.model';
import { Product } from '../../../core/models/product.model';
import { Contract } from '../../../core/models/contract.model';
import { Invoice, InvoiceLine, InvoiceRevision, InvoiceStatus } from '../../../core/models/invoice.model';
import { PAYMENT_METHODS, Payment, PaymentMethod } from '../../../core/models/payment.model';

type LineForm = FormGroup<{
  productId: FormControl<number | null>;
  description: FormControl<string>;
  quantity: FormControl<number>;
  unitPrice: FormControl<number>;
  vatPct: FormControl<number>;
}>;

/**
 * Live preview only — the backend's InvoiceCalculationEngine is the sole source of truth
 * for persisted totals. This mirrors that formula so staff see accurate numbers as they
 * type, but every save/issue re-derives totals server-side regardless of what's shown here.
 */
function previewLineTotal(quantity: number, unitPrice: number, vatPct: number) {
  const subtotal = round3(quantity * unitPrice);
  const vat = round3((subtotal * vatPct) / 100);
  return { subtotal, vat, total: round3(subtotal + vat) };
}

function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

// Local-time date helpers — deliberately avoid toISOString()/new Date(isoString), both of
// which round-trip through UTC and can shift the date by a day depending on the browser's
// timezone offset relative to UTC (this bit us once already: Oman is UTC+4, so a naive
// UTC conversion on save silently moved the selected date back by one day).
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
  selector: 'app-invoice-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    CurrencyPipe,
    DecimalPipe,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCardModule,
    IconComponent,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTableModule,
    MatExpansionModule,
  ],
  templateUrl: './invoice-editor.component.html',
  styleUrl: './invoice-editor.component.css',
})
export class InvoiceEditorComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly invoiceService = inject(InvoiceService);
  private readonly customerService = inject(CustomerService);
  private readonly productService = inject(ProductService);
  private readonly contractService = inject(ContractService);
  private readonly companyService = inject(CompanyService);
  private readonly authService = inject(AuthService);
  private readonly paymentService = inject(PaymentService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly injector = inject(Injector);

  private readonly pageHeading = viewChild.required<ElementRef<HTMLElement>>('pageHeading');
  private readonly changeReasonField = viewChild<ElementRef<HTMLTextAreaElement>>('changeReasonField');
  private readonly addLineButton = viewChild('addLineButton', { read: ElementRef<HTMLElement> });
  private readonly lineDescriptionFields = viewChildren<ElementRef<HTMLInputElement>>('lineDescription');

  readonly invoiceId = signal<number | null>(null);
  readonly invoiceNumber = signal<string | undefined>(undefined);
  readonly companyId = signal<number | null>(null);
  readonly customers = signal<Customer[]>([]);
  readonly products = signal<Product[]>([]);
  readonly revisions = signal<InvoiceRevision[]>([]);
  readonly payments = signal<Payment[]>([]);
  /** The invoice's actual persisted grand total (not the client-side line preview), used as
   *  the source of truth for balanceDue() so it never drifts from what the backend saved. */
  readonly invoiceGrandTotal = signal(0);

  readonly invoiceStatus = signal<InvoiceStatus | undefined>(undefined);

  readonly paymentMethods = PAYMENT_METHODS;
  readonly totalPaid = computed(() => round3(this.payments().reduce((sum, p) => sum + p.amount, 0)));
  readonly balanceDue = computed(() => round3(this.invoiceGrandTotal() - this.totalPaid()));
  readonly canRecordPayment = computed(
    () => this.authService.hasRole('ADMIN') || this.authService.hasRole('ACCOUNTANT'),
  );
  readonly canDeletePayment = computed(() => this.authService.hasRole('ADMIN'));

  readonly paymentForm = this.fb.group({
    paymentDate: this.fb.control<Date | null>(new Date(), Validators.required),
    amount: this.fb.control(0, [Validators.required, Validators.min(0.001)]),
    paymentMethod: this.fb.control<PaymentMethod>('CASH', Validators.required),
    referenceNote: [''],
  });

  /** Non-null when the current customer/product combination can't be saved as-is: either no
   *  active contract covers the invoice date (expired / not yet renewed), or the lines mix
   *  more than one contract-tracked product. Shown inline and blocks save() client-side; the
   *  backend re-checks and is the real authority regardless of what this says. */
  readonly contractWarning = signal<string | null>(null);
  /** Guards against a slow contract lookup overwriting a newer one's result. */
  private contractLookupToken = 0;

  /** True while an ADMIN is correcting an already-ISSUED invoice (see startCorrection()) —
   *  temporarily unlocks the otherwise-readOnly form for that one save. */
  readonly correctionMode = signal(false);

  /** True once the loaded invoice's status is anything other than DRAFT — the invoice is
   *  then immutable (see Invoice.assertEditable() on the backend), so the whole form gets
   *  disabled and every mutating action is blocked client-side too, not just server-side —
   *  except while correctionMode is active, which temporarily lifts the lock. */
  readonly readOnly = signal(false);

  /** ADMIN-only escape hatch for an ISSUED invoice: POST .../correct snapshots the current
   *  version into invoice_revision before applying the edit (see Invoice.assertCorrectable()
   *  on the backend). Not offered for DRAFT (just edit normally) or CANCELLED (terminal). */
  readonly canCorrect = computed(
    () =>
      this.authService.hasRole('ADMIN') &&
      this.invoiceStatus() === 'ISSUED' &&
      !this.correctionMode(),
  );

  readonly form = this.fb.group({
    customerId: this.fb.control<number | null>(null, Validators.required),
    invoiceDate: this.fb.control<Date | null>(new Date(), Validators.required),
    dueDate: this.fb.control<Date | null>(null),
    // Read-only display fields — always auto-filled from the resolved contract (see
    // refreshContractPreview()), never typed in directly. Kept permanently disabled; see
    // updateFormEnablement(), which re-disables them after every form.enable().
    contractNumber: this.fb.control<string>({ value: '', disabled: true }),
    contractDate: this.fb.control<Date | null>({ value: null, disabled: true }),
    notes: [''],
    changeReason: [''],
    lines: this.fb.array<LineForm>([]),
  });

  get lines() {
    return this.form.controls.lines;
  }

  readonly selectedCustomerId = toSignal(this.form.controls.customerId.valueChanges, {
    initialValue: this.form.controls.customerId.value,
  });

  /** Products scoped to the invoice's customer, plus general (unlinked) products —
   *  a product tied to a different customer shouldn't be selectable on this invoice. */
  readonly filteredProducts = computed(() => {
    const customerId = this.selectedCustomerId();
    return this.products().filter((p) => !p.customerId || p.customerId === customerId);
  });

  /** Line values as a signal — FormArray.valueChanges also fires on push/removeAt/clear
   *  and enable/disable, so the preview totals stay in sync under OnPush. */
  private readonly lineValues = toSignal(
    this.lines.valueChanges.pipe(
      startWith(null),
      map(() => this.lines.getRawValue()),
    ),
    { requireSync: true },
  );

  readonly lineTotals = computed(() =>
    this.lineValues().map((l) =>
      previewLineTotal(Number(l.quantity ?? 0), Number(l.unitPrice ?? 0), Number(l.vatPct ?? 0)),
    ),
  );

  readonly totals = computed(() => {
    let subtotal = 0;
    let vat = 0;
    let total = 0;
    for (const t of this.lineTotals()) {
      subtotal = round3(subtotal + t.subtotal);
      vat = round3(vat + t.vat);
      total = round3(total + t.total);
    }
    return { subtotal, vat, total };
  });

  ngOnInit(): void {
    this.customerService.search(undefined, 0, 100).subscribe({
      next: (r) => this.customers.set(r.content),
      error: () =>
        this.snackBar.open("Couldn't load customers. Refresh the page to try again.", 'Close', {
          duration: 6000,
        }),
    });
    this.productService.search(undefined, 0, 100).subscribe({
      next: (r) => this.products.set(r.content),
      error: () =>
        this.snackBar.open("Couldn't load products. Refresh the page to try again.", 'Close', {
          duration: 6000,
        }),
    });

    this.form.controls.customerId.valueChanges.subscribe((id) => {
      this.clearMismatchedLineProducts(id);
      this.refreshContractPreview();
    });
    this.form.controls.invoiceDate.valueChanges.subscribe(() => this.refreshContractPreview());
    this.companyService.list().subscribe((companies) => {
      if (companies.length > 0) {
        this.companyId.set(companies[0].id ?? null);
      } else {
        this.snackBar.open(
          'Add your company details before saving invoices. Go to Company Settings.',
          'Close',
          {
            duration: 6000,
          },
        );
      }
    });

    const idParam = this.route.snapshot.paramMap.get('id');
    this.invoiceId.set(idParam ? Number(idParam) : null);
    const invoiceId = this.invoiceId();
    if (invoiceId) {
      this.invoiceService.get(invoiceId).subscribe({
        next: (invoice) => this.populateForm(invoice),
        error: () =>
          this.snackBar.open(
            "Couldn't load this invoice. Refresh the page, or go back to the invoice list.",
            'Close',
            { duration: 6000 },
          ),
      });
      this.loadRevisions();
      this.loadPayments();
    } else {
      this.lines.push(this.buildLineGroup());
    }
  }

  private populateForm(invoice: Invoice): void {
    this.form.patchValue({
      customerId: invoice.customerId,
      invoiceDate: invoice.invoiceDate ? parseIsoDateLocal(invoice.invoiceDate) : null,
      dueDate: invoice.dueDate ? parseIsoDateLocal(invoice.dueDate) : null,
      contractNumber: invoice.contractNumber ?? '',
      contractDate: invoice.contractDate ? parseIsoDateLocal(invoice.contractDate) : null,
      notes: invoice.notes ?? '',
      changeReason: '',
    });
    this.invoiceNumber.set(invoice.invoiceNumber);
    this.companyId.set(invoice.companyId);
    this.invoiceStatus.set(invoice.status);
    this.invoiceGrandTotal.set(invoice.grandTotal ?? 0);
    this.correctionMode.set(false);

    this.lines.clear();
    for (const line of invoice.lines) {
      this.lines.push(this.buildLineGroup(line));
    }

    // Disabling must happen AFTER the lines are (re)built — FormArray.push() doesn't
    // retroactively apply the parent's disabled state to newly added controls, so
    // disabling first would leave the line-item fields editable even on a locked invoice.
    this.updateFormEnablement();
    this.refreshContractPreview();
  }

  /** Locks/unlocks the form based on invoice status and correctionMode. Split out from
   *  populateForm() so startCorrection()/cancelCorrection() can flip the lock without
   *  re-fetching or rebuilding the line FormArray. */
  private updateFormEnablement(): void {
    const locked = this.invoiceStatus() !== 'DRAFT' && !this.correctionMode();
    this.readOnly.set(locked);
    // The reason is only asked for while correcting; `pattern` rejects whitespace-only input.
    const changeReason = this.form.controls.changeReason;
    if (this.correctionMode()) {
      changeReason.setValidators([Validators.required, Validators.pattern(/\S/)]);
    } else {
      changeReason.clearValidators();
    }
    changeReason.updateValueAndValidity({ emitEvent: false });
    if (locked) {
      this.form.disable();
    } else {
      this.form.enable();
      // form.enable() re-enables every child control, including these two — they're
      // display-only and must stay disabled regardless of the invoice's edit lock.
      this.form.controls.contractNumber.disable({ emitEvent: false });
      this.form.controls.contractDate.disable({ emitEvent: false });
    }
  }

  private loadRevisions(): void {
    const invoiceId = this.invoiceId();
    if (!invoiceId) return;
    this.invoiceService.getRevisions(invoiceId).subscribe((revisions) => this.revisions.set(revisions));
  }

  private loadPayments(): void {
    const invoiceId = this.invoiceId();
    if (!invoiceId) return;
    this.paymentService.listForInvoice(invoiceId).subscribe((payments) => this.payments.set(payments));
  }

  recordPayment(): void {
    const invoiceId = this.invoiceId();
    if (!invoiceId || !this.canRecordPayment()) return;
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }
    const value = this.paymentForm.getRawValue();
    const payload: Payment = {
      invoiceId,
      paymentDate: value.paymentDate ? toIsoDate(value.paymentDate) : '',
      amount: value.amount,
      paymentMethod: value.paymentMethod,
      referenceNote: value.referenceNote || undefined,
    };

    this.paymentService.create(payload).subscribe({
      next: (saved) => {
        this.payments.update((list) =>
          [...list, saved].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate)),
        );
        this.paymentForm.reset({ paymentDate: new Date(), amount: 0, paymentMethod: 'CASH', referenceNote: '' });
        this.snackBar.open('Payment recorded', 'Close', { duration: 3000 });
      },
      error: (err: HttpErrorResponse) =>
        this.snackBar.open(
          err.error?.detail ?? "Couldn't record the payment. Try again.",
          'Close',
          { duration: 6000 },
        ),
    });
  }

  deletePayment(payment: Payment): void {
    if (!payment.id || !this.canDeletePayment()) return;
    if (!window.confirm(`Delete the ${payment.amount} payment recorded on ${payment.paymentDate}?`)) return;

    this.paymentService.delete(payment.id).subscribe({
      next: () => this.payments.update((list) => list.filter((p) => p.id !== payment.id)),
      error: () =>
        this.snackBar.open("Couldn't delete the payment. Try again.", 'Close', { duration: 6000 }),
    });
  }

  startCorrection(): void {
    if (!this.canCorrect()) return;
    this.correctionMode.set(true);
    this.form.controls.changeReason.reset('');
    this.updateFormEnablement();
    this.focusAfterRender(() => this.changeReasonField()?.nativeElement);
  }

  cancelCorrection(): void {
    const invoiceId = this.invoiceId();
    if (!invoiceId) return;
    this.correctionMode.set(false);
    // Discards any in-progress edits by re-fetching the still-current (uncorrected) invoice.
    this.invoiceService.get(invoiceId).subscribe((invoice) => this.populateForm(invoice));
    this.focusAfterRender(() => this.pageHeading().nativeElement);
  }

  private buildLineGroup(line?: InvoiceLine): LineForm {
    return this.fb.group({
      productId: this.fb.control<number | null>(line?.productId ?? null),
      description: [line?.description ?? '', Validators.required],
      quantity: [line?.quantity ?? 1, [Validators.required, Validators.min(0.001)]],
      unitPrice: [line?.unitPrice ?? 0, [Validators.required, Validators.min(0)]],
      vatPct: [line?.vatPct ?? 5, [Validators.required, Validators.min(0)]],
    });
  }

  addLine(): void {
    if (this.readOnly()) return;
    this.lines.push(this.buildLineGroup());
    this.focusAfterRender(() => this.lineDescriptionFields().at(-1)?.nativeElement);
  }

  removeLine(index: number): void {
    if (this.readOnly()) return;
    this.lines.removeAt(index);
    // The removed row's button no longer exists; keep keyboard focus on the line controls.
    this.focusAfterRender(() => this.addLineButton()?.nativeElement);
    this.refreshContractPreview();
  }

  /** Clears any line's selected product that's tied to a different customer than the one
   *  now on the invoice — the product would no longer even appear in filteredProducts(), so
   *  leaving its id on the line would silently save a customer/product mismatch. */
  private clearMismatchedLineProducts(customerId: number | null): void {
    for (const line of this.lines.controls) {
      const productId = line.controls.productId.value;
      if (!productId) continue;

      const product = this.products().find((p) => p.id === productId);
      if (product?.customerId && product.customerId !== customerId) {
        line.controls.productId.setValue(null);
      }
    }
  }

  onProductSelected(index: number, productId: number | null): void {
    if (this.readOnly()) return;

    if (productId) {
      const product = this.products().find((p) => p.id === productId);
      if (product) {
        this.lines.at(index).patchValue({
          description: product.name,
          unitPrice: product.defaultPrice,
          vatPct: product.defaultVatPct,
        });
      }
    }
    this.refreshContractPreview();
  }

  /** Best-effort client-side preview of the contract that resolveContract() on the backend
   *  will apply on save — fills contractNumber/contractDate for display and warns early about
   *  a missing/expired contract or mixed products, without waiting for a failed save. The
   *  backend re-derives and re-validates this from scratch regardless; this is UX only. */
  private refreshContractPreview(): void {
    const token = ++this.contractLookupToken;
    const customerId = this.form.controls.customerId.value;
    const invoiceDateValue = this.form.controls.invoiceDate.value;

    if (!customerId || !invoiceDateValue) {
      this.setContractPreview(null);
      this.contractWarning.set(null);
      return;
    }

    const productIds = [
      ...new Set(
        this.lines.controls
          .map((l) => l.controls.productId.value)
          .filter((id): id is number => id != null),
      ),
    ];

    if (productIds.length === 0) {
      // No product selected on any line — not contract-tracked, contract fields stay blank.
      this.setContractPreview(null);
      this.contractWarning.set(null);
      return;
    }
    if (productIds.length > 1) {
      this.setContractPreview(null);
      this.contractWarning.set(
        "This invoice's lines use more than one product. An invoice can only be billed under " +
          'one contract — use a single product per invoice, or split into separate invoices.',
      );
      return;
    }

    const invoiceDate = toIsoDate(invoiceDateValue);
    this.contractService.history(customerId, productIds[0]).subscribe({
      next: (page) => {
        if (token !== this.contractLookupToken) return; // a newer lookup superseded this one
        if (page.content.length === 0) {
          // No contracts exist at all for this customer/product — not contract-tracked.
          this.setContractPreview(null);
          this.contractWarning.set(null);
          return;
        }
        const active = page.content.find((c) => invoiceDate >= c.startDate && invoiceDate <= c.endDate);
        if (active) {
          this.setContractPreview(active);
          this.contractWarning.set(null);
        } else {
          this.setContractPreview(null);
          this.contractWarning.set(
            'No active contract covers this invoice date for the selected product/customer. ' +
              'The contract may have expired or not been renewed yet — add the new contract ' +
              'under Contracts before saving this invoice.',
          );
        }
      },
      error: () => {
        if (token !== this.contractLookupToken) return;
        this.contractWarning.set("Couldn't check the contract for this product. Try again.");
      },
    });
  }

  private setContractPreview(contract: Contract | null): void {
    this.form.patchValue({
      contractNumber: contract?.contractCode ?? '',
      contractDate: contract ? parseIsoDateLocal(contract.startDate) : null,
    });
  }

  private toPayload(): Invoice {
    const value = this.form.getRawValue();
    return {
      companyId: this.companyId() ?? 0,
      // Both are required by the form validators, which are checked before this is called.
      customerId: value.customerId ?? 0,
      invoiceDate: value.invoiceDate ? toIsoDate(value.invoiceDate) : '',
      dueDate: value.dueDate ? toIsoDate(value.dueDate) : null,
      // contractNumber/contractDate are display-only (see the form group above) — the backend
      // always derives them itself and ignores whatever's sent, so they're left out here.
      notes: value.notes || undefined,
      lines: value.lines.map((l) => ({
        productId: l.productId,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        vatPct: l.vatPct,
      })),
    };
  }

  cancel(): void {
    this.router.navigate(['/invoices']);
  }

  save(): void {
    if (this.correctionMode()) {
      this.saveCorrection();
      return;
    }
    if (!this.checkReadyToSave('Some fields need attention. Check the highlighted fields and try again.')) {
      return;
    }
    const payload = this.toPayload();

    const invoiceId = this.invoiceId();
    const request = invoiceId
      ? this.invoiceService.update(invoiceId, payload)
      : this.invoiceService.create(payload);

    request.subscribe({
      next: (saved) => {
        this.snackBar.open('Invoice saved', 'Close', { duration: 3000 });
        if (!invoiceId && saved.id) {
          this.router.navigate(['/invoices', saved.id]);
        }
      },
      error: (err: HttpErrorResponse) =>
        this.snackBar.open(
          err.error?.detail ?? "Couldn't save the invoice. Check your connection and try again.",
          'Close',
          { duration: 6000 },
        ),
    });
  }

  private saveCorrection(): void {
    const invoiceId = this.invoiceId();
    if (!invoiceId) return;
    const reason = this.form.controls.changeReason.value.trim();
    const ready = this.checkReadyToSave(
      'Some fields need attention. Check the highlighted fields, including the reason for correction.',
    );
    if (!ready || !reason) return;
    const payload = this.toPayload();

    this.invoiceService.correct(invoiceId, reason, payload).subscribe({
      next: (invoice) => {
        this.snackBar.open('Invoice corrected', 'Close', { duration: 3000 });
        this.populateForm(invoice);
        this.loadRevisions();
        this.focusAfterRender(() => this.pageHeading().nativeElement);
      },
      error: (err: HttpErrorResponse) =>
        this.snackBar.open(
          err.error?.detail ?? "Couldn't save the correction. Your changes are still here. Try again.",
          'Close',
          { duration: 6000 },
        ),
    });
  }

  issue(): void {
    const invoiceId = this.invoiceId();
    if (!invoiceId) return;
    this.invoiceService.issue(invoiceId).subscribe({
      next: (invoice) => {
        this.snackBar.open(`Invoice issued as ${invoice.invoiceNumber}`, 'Close', {
          duration: 4000,
        });
        this.populateForm(invoice);
        // The Issue button disappears once issued, so move focus somewhere that still exists.
        this.focusAfterRender(() => this.pageHeading().nativeElement);
      },
      error: (err: HttpErrorResponse) =>
        this.snackBar.open(
          err.error?.detail ?? "Couldn't issue the invoice. It's still a draft. Try again.",
          'Close',
          { duration: 6000 },
        ),
    });
  }

  downloadPdf(): void {
    const invoiceId = this.invoiceId();
    if (!invoiceId) return;
    this.invoiceService.downloadPdf(invoiceId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      },
      error: () =>
        this.snackBar.open(
          "Couldn't open the PDF. Try again, or check that pop-ups aren't blocked.",
          'Close',
          { duration: 6000 },
        ),
    });
  }

  /** Shows why the invoice can't be saved yet. A missing company profile gets its own
   *  message, since no field on this form can fix it. */
  private checkReadyToSave(invalidMessage: string): boolean {
    if (!this.companyId()) {
      this.snackBar.open(
        'Add your company details before saving invoices. Go to Company Settings.',
        'Close',
        { duration: 6000 },
      );
      return false;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open(invalidMessage, 'Close', { duration: 6000 });
      return false;
    }
    if (this.contractWarning()) {
      this.snackBar.open(this.contractWarning()!, 'Close', { duration: 8000 });
      return false;
    }
    return true;
  }

  private focusAfterRender(target: () => HTMLElement | undefined): void {
    afterNextRender(() => target()?.focus(), { injector: this.injector });
  }
}
