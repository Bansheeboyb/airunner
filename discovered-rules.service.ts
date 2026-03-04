import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  DiscoveredRulesResponse,
  TacService,
  NormalizedPage,
  DisplayRule,
  DisplayTerm,
  DisplayAttribute,
  DisplaySection,
  ReimbursementText,
} from '../models/discovered-rules.models';

@Injectable({ providedIn: 'root' })
export class DiscoveredRulesService {
  private readonly http = inject(HttpClient);

  // ── State ──────────────────────────────────────────────────────────
  readonly rawData = signal<DiscoveredRulesResponse | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  // ── Computed: metadata ─────────────────────────────────────────────
  readonly contractName = computed(() =>
    this.rawData()?.discovery_metadata?.contract_identifier ?? ''
  );
  readonly filename = computed(() =>
    this.rawData()?.discovery_metadata?.filename ?? ''
  );
  readonly totalServices = computed(() =>
    this.rawData()?.discovery_metadata?.final_services_count ?? 0
  );
  readonly totalTerms = computed(() =>
    this.rawData()?.contracts_orchestration?.total_terms_discovered ?? 0
  );
  readonly executionTime = computed(() =>
    this.rawData()?.contracts_orchestration?.execution_time_seconds ?? 0
  );
  readonly discoveryConfidence = computed(() =>
    this.rawData()?.discovery_metadata?.t1_discovery_confidence ?? 0
  );
  readonly hasData = computed(() => this.rawData() !== null);

  // ── Computed: section map (tacsect_id -> name) ─────────────────────
  private readonly sectionNameMap = computed(() => {
    const map = new Map<string, string>();
    const pages = this.rawData()?.discovery_metadata?.normalized_pages ?? [];
    for (const page of pages) {
      if (!map.has(page.tacsect_id)) {
        map.set(page.tacsect_id, page.tacsect_name);
      }
    }
    return map;
  });

  // ── Computed: normalized pages grouped by svctype ──────────────────
  private readonly sourcePageMap = computed(() => {
    const map = new Map<string, ReimbursementText[]>();
    const pages = this.rawData()?.discovery_metadata?.normalized_pages ?? [];
    for (const page of pages) {
      const existing = map.get(page.normalized_svctype) ?? [];
      existing.push(...page.reimbursement_texts);
      map.set(page.normalized_svctype, existing);
    }
    return map;
  });

  // ── Computed: display rules (flattened) ────────────────────────────
  readonly displayRules = computed<DisplayRule[]>(() => {
    const data = this.rawData();
    if (!data) return [];

    const services = data.contracts_orchestration?.current_contract?.services ?? [];
    const pageMap = this.sourcePageMap();
    const sectionMap = this.sectionNameMap();

    return services.map((svc) => this.mapServiceToDisplayRule(svc, pageMap, sectionMap));
  });

  // ── Computed: grouped by section ───────────────────────────────────
  readonly displaySections = computed<DisplaySection[]>(() => {
    const rules = this.displayRules();
    const sectionMap = new Map<string, DisplaySection>();

    for (const rule of rules) {
      const key = rule.sectionId;
      if (!sectionMap.has(key)) {
        sectionMap.set(key, {
          sectionId: rule.sectionId,
          sectionName: rule.sectionName,
          rules: [],
        });
      }
      sectionMap.get(key)!.rules.push(rule);
    }

    // Sort sections by sectionId
    return Array.from(sectionMap.values()).sort(
      (a, b) => Number(a.sectionId) - Number(b.sectionId)
    );
  });

  // ── Computed: metrics ──────────────────────────────────────────────
  readonly modifiedCount = computed(
    () => this.displayRules().filter((r) => r.isModified).length
  );

  readonly totalPages = computed(() => {
    const pages = new Set<number>();
    for (const rule of this.displayRules()) {
      for (const sp of rule.sourcePages) {
        pages.add(sp.page_number);
      }
    }
    return pages.size;
  });

  // ── Actions ────────────────────────────────────────────────────────
  loadSampleData(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.http.get<DiscoveredRulesResponse>('/assets/sample-data.json').subscribe({
      next: (data) => {
        this.rawData.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load sample data: ' + err.message);
        this.isLoading.set(false);
      },
    });
  }

  setData(data: DiscoveredRulesResponse): void {
    this.rawData.set(data);
    this.error.set(null);
  }

  reset(): void {
    this.rawData.set(null);
    this.error.set(null);
    this.isLoading.set(false);
  }

  updateTermAttribute(
    serviceNsyskey: number,
    termNsyskey: number,
    attrNsyskey: number,
    newValue: string
  ): void {
    const data = this.rawData();
    if (!data) return;

    const updated = structuredClone(data);
    const service = updated.contracts_orchestration.current_contract.services.find(
      (s) => s['TACSERVICE.NSYSKEY'] === serviceNsyskey
    );
    if (!service) return;

    const term = service.terms.find((t) => t['TACTERM.NSYSKEY'] === termNsyskey);
    if (!term) return;

    const attr = term.attributes.find((a) => a['TACTERMATTR.NSYSKEY'] === attrNsyskey);
    if (!attr) return;

    attr['TACTERMATTR.NEWATTRVALUE'] = newValue;
    this.rawData.set(updated);
  }

  // ── Download helpers ───────────────────────────────────────────────
  downloadJSON(): void {
    const data = this.rawData();
    if (!data) return;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.contractName() || 'discovered_rules'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  downloadCSV(): void {
    const rules = this.displayRules();
    if (!rules.length) return;

    const headers = ['Service Type', 'Section', 'Reimbursement Text', 'New Reimbursement Text', 'Modified', 'Source Pages'];
    const rows = rules.map((r) => [
      `"${r.serviceType}"`,
      `"${r.sectionName}"`,
      `"${r.currentReimText.replace(/"/g, '""')}"`,
      `"${(r.newReimText || '').replace(/"/g, '""')}"`,
      r.isModified ? 'Yes' : 'No',
      r.sourcePages.map((p) => p.page_number).join('; '),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.contractName() || 'discovered_rules'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // ── Private helpers ────────────────────────────────────────────────
  private mapServiceToDisplayRule(
    svc: TacService,
    pageMap: Map<string, ReimbursementText[]>,
    sectionMap: Map<string, string>
  ): DisplayRule {
    const svcType = svc['TACSERVICE.SVCTYPE'];
    const sectionId = svc['TACSERVICE.TACSECT'];

    const terms: DisplayTerm[] = svc.terms.map((term) => {
      const attributes: DisplayAttribute[] = term.attributes.map((attr) => ({
        name: attr['TACTERMATTR.ATTRNAME'],
        currentValue: attr['TACTERMATTR.ATTRVALUE'],
        newValue: attr['TACTERMATTR.NEWATTRVALUE'],
        dataType: attr['TACTERMATTR.ATTRDATATYPE'],
      }));

      return {
        termName: term['TACTERM.TERMNAME'],
        evalSequence: term['TACTERM.EVAL_SEQUENCE'],
        level: term['TACTERM.LEVEL'],
        attributes,
        isModified: term.MODIFY === 'UPDATE',
      };
    });

    return {
      serviceType: svcType,
      sectionId,
      sectionName: sectionMap.get(sectionId) || `Section ${sectionId}`,
      sequence: svc['TACSERVICE.SEQUENCE'],
      currentReimText: svc['TACSERVICE.REIMTEXT'],
      newReimText: svc['TACSERVICE.REIMTEXT_NEW'] ?? '',
      terms,
      sourcePages: pageMap.get(svcType) ?? [],
      isModified: svc.MODIFY === 'UPDATE',
      nsyskey: svc['TACSERVICE.NSYSKEY'],
    };
  }
}
