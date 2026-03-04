// ── Discovered Rules Data Models ──────────────────────────────────────────
// Maps to the JSON structure returned by the rule discovery pipeline

export interface DiscoveredRulesResponse {
  success: boolean;
  discovery_metadata: DiscoveryMetadata;
  contracts_orchestration: ContractsOrchestration;
}

// ── Discovery Metadata ───────────────────────────────────────────────────

export interface ReimbursementText {
  page_number: number;
  text: string;
}

export interface NormalizedPage {
  normalized_svctype: string;
  tacsect_id: string;
  tacsect_name: string;
  reimbursement_texts: ReimbursementText[];
}

export interface DiscoveryMetadata {
  contract_identifier: string;
  filename: string;
  term_candidates_count: number;
  final_services_count: number;
  has_t_minus_1: boolean;
  flow_version: string;
  normalized_pages: NormalizedPage[];
  t1_coneff: string;
  t1_domdef: string;
  t1_tacmast: number;
  t1_facid: number;
  t1_database: string;
  t1_server: string;
  t1_discovery_method: string;
  t1_discovery_confidence: number;
}

// ── Contract Terms ───────────────────────────────────────────────────────

export interface TacTermAttribute {
  'TACTERMATTR.ATTRNAME': string;
  'TACTERMATTR.ATTRVALUE': string;
  'TACTERMATTR.ATTRDATATYPE': number;
  'TACTERMATTR.MOREDATA': string;
  'TACTERMATTR.FACID': number;
  'TACTERMATTR.TACMAST': number;
  'TACTERMATTR.TACTERM': number;
  rowlist: unknown[];
  'TACTERMATTR.TACTERMDEFATTR': number;
  'TACTERMATTR.NSYSKEY': number;
  'TACTERMATTR.NEWATTRVALUE': string;
}

export interface TacTerm {
  'TACMAST.FACID': number;
  'TACMAST.COPY_FLAG': string;
  'TACMAST.NSYSKEY': number;
  'TACTERM.TACSERVICE': number;
  'TACTERM.EVAL_SEQUENCE': number;
  'TACTERM.LEVEL': number;
  'TACTERM.TERMNAME': string;
  'TACTERM.TACMAST': number;
  'TACTERM.FACID': number;
  'TACTERM.TACTERM': number;
  attributes: TacTermAttribute[];
  'TACTERM.NSYSKEY': number;
  MODIFY?: string;
}

export interface TacService {
  'TACSERVICE.NSYSKEY': number;
  'TACSERVICE.USETYPE': string;
  'TACSERVICE.SEQUENCE': number;
  'TACSERVICE.SVCTYPE': string;
  'TACSERVICE.REDUCEGROSS': string;
  'TACSERVICE.EXCLUSIVE': string;
  'TACSERVICE.CASTDAYS': string;
  'TACSERVICE.CASTHOURS': string;
  'TACSERVICE.CASTCHARGES': string;
  'TACSERVICE.LEVELOFCARE': string;
  'TACSERVICE.LEVELOFCAREDAYS': number;
  'TACSERVICE.DAILYCALC': string;
  'TACSERVICE.RANKOVRD': number;
  'TACSERVICE.REIMTEXT': string;
  'TACSERVICE.TOTTEXTLEN': number;
  'TACSERVICE.FACID': number;
  'TACSERVICE.TACMAST': number;
  'TACSERVICE.TACSECT': string;
  terms: TacTerm[];
  'TACSERVICE.REIMTEXT_NEW'?: string;
  MODIFY?: string;
}

export interface ContractInfo {
  'CONTRACT.TAC_DESC': string;
  'CONEFF.EFF_DATE': string;
  'CONEFF.TRM_DATE': string;
  'CONEFF.RCV_DATE': string;
}

export interface ContractData {
  contract: ContractInfo;
  services: TacService[];
}

export interface ChangeAnalysis {
  new_terms: TacTerm[];
  updated_terms: TacTerm[];
}

export interface ContractsOrchestration {
  current_contract_available: boolean;
  t_minus_1_contract_available: boolean;
  change_analysis_available: boolean;
  total_terms_discovered: number;
  execution_time_seconds: number;
  current_contract: ContractData;
  t_minus_1_contract?: ContractData;
  change_analysis?: ChangeAnalysis;
}

// ── Display-friendly models ──────────────────────────────────────────────
// Flattened/mapped models for UI display

export interface DisplayAttribute {
  name: string;
  currentValue: string;
  newValue: string;
  dataType: number;
}

export interface DisplayTerm {
  termName: string;
  evalSequence: number;
  level: number;
  attributes: DisplayAttribute[];
  isModified: boolean;
}

export interface DisplayRule {
  serviceType: string;
  sectionId: string;
  sectionName: string;
  sequence: number;
  currentReimText: string;
  newReimText: string;
  terms: DisplayTerm[];
  sourcePages: ReimbursementText[];
  isModified: boolean;
  nsyskey: number;
}

// Section grouping for display
export interface DisplaySection {
  sectionId: string;
  sectionName: string;
  rules: DisplayRule[];
}
