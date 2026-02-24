export interface UploadResponse {
  status: string;
  session_id: string;
  correlation_id: string;
  uuid: string;
  filename: string;
  websocket_url: string;
  group_name: string;
  timestamp: string;
}

export interface StageInfo {
  number: number;
  name: string;
  status: 'completed' | 'in_progress';
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
}

export interface ProgressInfo {
  current_stage: number;
  total_stages: number;
  percent_complete: number;
  is_final: boolean;
}

export interface ErrorInfo {
  code: string;
  message: string;
  stage: number;
  stage_name: string;
  is_retryable: boolean;
  details?: {
    reason: string;
    suggestion: string;
  };
}

export interface ProcessingResult {
  status: string;
  output_url: string;
  total_duration_ms: number;
  summary: {
    rules_discovered: number;
    pages_processed: number;
    confidence_score: number;
  };
}

export interface StageUpdateMessage {
  type: 'stage_update';
  correlation_id: string;
  uuid: string;
  session_id: string;
  filename: string;
  stage: StageInfo;
  progress: ProgressInfo;
  result?: ProcessingResult;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface ErrorMessage {
  type: 'error';
  correlation_id: string;
  uuid: string;
  session_id: string;
  filename: string;
  error: ErrorInfo;
  progress: ProgressInfo;
  timestamp: string;
}

export interface HeartbeatMessage {
  type: 'heartbeat';
  correlation_id: string;
  uuid: string;
  current_stage: number;
  stage_name: string;
  elapsed_ms: number;
  timestamp: string;
}

export type PipelineMessage = StageUpdateMessage | ErrorMessage | HeartbeatMessage;
