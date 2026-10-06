import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CustomerService } from '../../../core/services/customer.service';
import { InvoiceService } from '../../../core/services/invoice.service';
import { Invoice, PageResponse } from '../../../core/models/invoice.model';
import { Customer } from '../../../core/models/customer.model';
import { InvoiceListComponent } from './invoice-list.component';

interface NodeProcess {
  env: Record<string, string | undefined>;
  cwd(): string;
  getBuiltinModule(id: 'node:fs'): { readFileSync(path: string, encoding: 'utf8'): string };
}
// Specs run in Node (jsdom). Reaching `process` through globalThis avoids adding Node typings
// to the spec tsconfig just for two uses.
const nodeProcess = (globalThis as unknown as { process: NodeProcess }).process;
/** `process.env.TZ` is read by the JS engine at runtime, so a spec can switch time zones. */
const env = nodeProcess.env;

const invoice: Invoice = {
  id: 1,
  invoiceNumber: 'INV-2026-0001',
  invoiceDate: '2026-04-12', // date-only string, exactly as the API sends it
  companyId: 1,
  customerId: 1,
  currencyCode: 'OMR',
  grandTotal: 1313.025,
  status: 'ISSUED',
  lines: [],
};

const customer: Customer = { id: 1, name: 'Al Noor Trading LLC', customerType: 'COMPANY', active: true };

function page<T>(content: T[]): PageResponse<T> {
  return { content, totalElements: content.length, totalPages: 1, number: 0, size: 20 };
}

async function render(): Promise<{ fixture: ComponentFixture<InvoiceListComponent>; root: HTMLElement }> {
  await TestBed.configureTestingModule({
    imports: [InvoiceListComponent],
    providers: [
      provideRouter([]),
      { provide: InvoiceService, useValue: { search: () => of(page([invoice])) } },
      { provide: CustomerService, useValue: { search: () => of(page([customer])) } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(InvoiceListComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

describe('InvoiceListComponent', () => {
  const originalTz = env['TZ'];

  afterEach(() => {
    if (originalTz === undefined) {
      delete env['TZ'];
    } else {
      env['TZ'] = originalTz;
    }
  });

  describe('invoice date display', () => {
    // Oman is UTC+4. Zones ahead of UTC are where formatting a date-only string in 'UTC' showed
    // the previous day; the others make sure the fix holds on both sides of UTC.
    const zones: [string, number][] = [
      ['Asia/Muscat', -240],
      ['Pacific/Kiritimati', -840],
      ['UTC', 0],
      ['America/Los_Angeles', 420],
    ];

    it.each(zones)('shows 2026-04-12 as Apr 12, 2026 in %s', async (zone, expectedOffset) => {
      env['TZ'] = zone;
      // Guard: if the zone switch did not take effect, this test would prove nothing.
      expect(new Date(2026, 3, 12).getTimezoneOffset()).toBe(expectedOffset);

      const { root } = await render();
      const dateCell = root.querySelector('td.mat-column-invoiceDate');

      expect(dateCell?.textContent?.trim()).toBe('Apr 12, 2026');
    });
  });

  describe('amount column alignment', () => {
    it('marks the Total header and cell as right-aligned', async () => {
      const { root } = await render();

      const header = root.querySelector('th.mat-column-grandTotal');
      const cell = root.querySelector('td.mat-column-grandTotal');

      expect(header?.classList.contains('col-right')).toBe(true);
      expect(cell?.classList.contains('col-right')).toBe(true);
      expect(cell?.textContent?.trim()).toBe('OMR1,313.025');
    });

    it('leaves text columns left-aligned', async () => {
      const { root } = await render();

      for (const column of ['invoiceNumber', 'invoiceDate', 'customerName', 'status']) {
        expect(root.querySelector(`td.mat-column-${column}`)?.classList.contains('col-right')).toBe(false);
      }
    });
  });
});

describe('global styles: .col-right', () => {
  // jsdom loads no stylesheets in specs, so read the shipped file from disk.
  const globalStyles = nodeProcess
    .getBuiltinModule('node:fs')
    .readFileSync(`${nodeProcess.cwd()}/projects/mss-invoice/src/styles.css`, 'utf8');

  /** Selectors (trimmed) of every rule whose body sets `text-align: right`. */
  function selectorsAligningRight(css: string): string[] {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors: string[] = [];
    for (const [, selectorList, body] of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (/text-align\s*:\s*right/.test(body)) {
        selectors.push(...selectorList.split(',').map((s) => s.trim()));
      }
    }
    return selectors;
  }

  // jsdom does not apply Material's real cascade, so a computed-style assertion would pass or
  // fail for the wrong reasons. Material's cell rule (text-align: left) is one class, so a plain
  // `.col-right` loses to it; the table-scoped selector (two classes) is what makes it win.
  it('has a table-scoped rule that out-ranks Material cell styles', () => {
    const selectors = selectorsAligningRight(globalStyles);

    expect(selectors).toContain('.col-right');
    expect(selectors).toContain('.mat-mdc-table .col-right');
  });

  it('adds spacing after a right-aligned column in list tables', () => {
    expect(globalStyles).toMatch(/\.list-card td\.col-right \+ td\.mat-mdc-cell\s*\{[^}]*padding-left/);
  });
});
