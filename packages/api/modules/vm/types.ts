// VM Types

export interface VMLogEntry {
  timestamp: string;
  severity: string;
  message: string;
  textPayload?: string;
  jsonPayload?: Record<string, any>;
  resource?: Record<string, any>;
  source?: string;
  insertId?: string;
  labels?: Record<string, string>;
  trace?: string;
}

export interface VMLogsResponse {
  logs: VMLogEntry[];
  nextPageToken?: string | null;
}

export interface VMLogsRequest {
  vmName: string;
  zone: string;
  filter?: string;
  limit?: number;
  pageToken?: string;
  orderBy?: string;
}