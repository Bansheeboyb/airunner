import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { WebPubSubClient } from '@azure/web-pubsub-client';
import {
  UploadResponse,
  ProgressInfo,
  ProcessingResult,
  StageInfo,
  StageUpdateMessage,
  ErrorMessage,
  ErrorInfo,
  PipelineMessage,
} from '../models/upload.models';
import { environment } from '../../environments/environment';

export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';

export interface CompletedStage {
  info: StageInfo;
  completedAt: Date;
}

@Injectable({
  providedIn: 'root',
})
export class DocumentUploadService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private pubSubClient: WebPubSubClient | null = null;

  // ── Writable signals (private) ──────────────────────────────────
  private readonly _status = signal<UploadStatus>('idle');
  private readonly _uploadResponse = signal<UploadResponse | null>(null);
  private readonly _progress = signal<ProgressInfo | null>(null);
  private readonly _currentStage = signal<string | null>(null);
  private readonly _completedStages = signal<CompletedStage[]>([]);
  private readonly _error = signal<string | null>(null);
  private readonly _errorInfo = signal<ErrorInfo | null>(null);
  private readonly _result = signal<ProcessingResult | null>(null);
  private readonly _filename = signal<string | null>(null);

  // ── Public readonly signals ─────────────────────────────────────
  readonly status = this._status.asReadonly();
  readonly uploadResponse = this._uploadResponse.asReadonly();
  readonly progress = this._progress.asReadonly();
  readonly currentStage = this._currentStage.asReadonly();
  readonly completedStages = this._completedStages.asReadonly();
  readonly error = this._error.asReadonly();
  readonly errorInfo = this._errorInfo.asReadonly();
  readonly result = this._result.asReadonly();
  readonly filename = this._filename.asReadonly();

  // ── Computed signals ────────────────────────────────────────────
  readonly isIdle = computed(() => this._status() === 'idle');
  readonly isUploading = computed(() => this._status() === 'uploading');
  readonly isProcessing = computed(() => this._status() === 'processing');
  readonly isComplete = computed(() => this._status() === 'complete');
  readonly isError = computed(() => this._status() === 'error');
  readonly isBusy = computed(() => this._status() === 'uploading' || this._status() === 'processing');
  readonly percentComplete = computed(() => this._progress()?.percent_complete ?? 0);

  async uploadDocument(file: File, userId?: string): Promise<UploadResponse> {
    this.resetState();
    this._status.set('uploading');
    this._filename.set(file.name);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', file.name);
    if (userId) {
      formData.append('user_id', userId);
    }

    let response: UploadResponse;
    try {
      response = await firstValueFrom(
        this.http.post<UploadResponse>(`${environment.apiUrl}/upload`, formData)
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload request failed';
      this._error.set(message);
      this._status.set('error');
      throw err;
    }

    this._uploadResponse.set(response);
    this._status.set('processing');

    try {
      await this.connectWebSocket(response.websocket_url, response.group_name);
    } catch (err: unknown) {
      console.error('[DocumentUpload] WebSocket connection failed:', err);
      const message = err instanceof Error ? err.message : 'Real-time connection failed';
      this._error.set(message);
      this._status.set('error');
      throw err;
    }

    return response;
  }

  private async connectWebSocket(url: string, groupName: string): Promise<void> {
    this.pubSubClient = new WebPubSubClient(url);

    this.pubSubClient.on('group-message', (e) => {
      const message = typeof e.message.data === 'string'
        ? JSON.parse(e.message.data)
        : e.message.data;
      this.handleMessage(message as PipelineMessage);
    });

    this.pubSubClient.on('disconnected', (e) => {
      console.warn('[DocumentUpload] WebSocket disconnected:', e.message);
    });

    await this.pubSubClient.start();
    await this.pubSubClient.joinGroup(groupName);
  }

  private handleMessage(message: PipelineMessage): void {
    switch (message.type) {
      case 'stage_update':
        this.handleStageUpdate(message);
        break;
      case 'error':
        this.handleError(message);
        break;
      case 'heartbeat':
        break;
    }
  }

  private handleStageUpdate(message: StageUpdateMessage): void {
    this._progress.set(message.progress);
    this._currentStage.set(message.stage.name);

    // Track completed stages for the timeline
    if (message.stage.status === 'completed') {
      this._completedStages.update((stages) => [
        ...stages,
        { info: message.stage, completedAt: new Date() },
      ]);
    }

    if (message.progress.is_final) {
      this._result.set(message.result ?? null);
      this._status.set('complete');
      this.disconnect();
    }
  }

  private handleError(message: ErrorMessage): void {
    this._error.set(message.error.message);
    this._errorInfo.set(message.error);
    this._progress.set(message.progress);
    this._status.set('error');
    this.disconnect();
  }

  disconnect(): void {
    if (this.pubSubClient) {
      this.pubSubClient.stop();
      this.pubSubClient = null;
    }
  }

  reset(): void {
    this.disconnect();
    this.resetState();
  }

  private resetState(): void {
    this._status.set('idle');
    this._uploadResponse.set(null);
    this._progress.set(null);
    this._currentStage.set(null);
    this._completedStages.set([]);
    this._error.set(null);
    this._errorInfo.set(null);
    this._result.set(null);
    this._filename.set(null);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
