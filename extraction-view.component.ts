import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentUploadService } from '../../services/document-upload.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-extraction-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './extraction-view.component.html',
  styleUrl: './extraction-view.component.css',
})
export class ExtractionViewComponent {
  readonly upload = inject(DocumentUploadService);
  private readonly toast = inject(ToastService);

  readonly selectedFile = signal<File | null>(null);

  constructor() {
    effect(() => {
      if (this.upload.isComplete()) {
        const filename = this.upload.filename() ?? 'Document';
        const rules = this.upload.result()?.summary?.rules_discovered;
        const message = rules
          ? `Extracted ${rules} reimbursement rules from ${filename}`
          : `${filename} has been processed successfully`;
        this.toast.success('Extraction Complete', message);
      }
      if (this.upload.isError()) {
        const filename = this.upload.filename() ?? 'Document';
        this.toast.error('Extraction Failed', `${filename} — ${this.upload.error() ?? 'An error occurred'}`);
      }
    });
  }

  readonly stages = [
    { number: 0, name: 'Queued', icon: 'inbox', description: 'Job accepted' },
    { number: 1, name: 'Preprocess', icon: 'scan', description: 'Validating file' },
    { number: 2, name: 'Text Extraction', icon: 'text', description: 'Reading content' },
    { number: 3, name: 'Rule Discovery', icon: 'brain', description: 'Analyzing rules' },
    { number: 4, name: 'Output Writer', icon: 'save', description: 'Saving results' },
  ];

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
      this.upload.reset();
    }
  }

  async startExtraction(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;

    try {
      await this.upload.uploadDocument(file);
    } catch (err) {
      console.error('Upload failed:', err);
    }
  }

  reset(): void {
    this.selectedFile.set(null);
    this.upload.reset();
  }

  isStageCompleted(stageNumber: number): boolean {
    const progress = this.upload.progress();
    if (!progress) return false;
    if (progress.is_final) return true;
    return progress.current_stage > stageNumber;
  }

  isStageActive(stageNumber: number): boolean {
    const progress = this.upload.progress();
    if (!progress) return false;
    if (progress.is_final) return false;
    return progress.current_stage === stageNumber;
  }

  getStageDuration(stageNumber: number): string | null {
    const completed = this.upload.completedStages();
    const stage = completed.find((s) => s.info.number === stageNumber);
    if (!stage?.info.duration_ms) return null;
    const sec = (stage.info.duration_ms / 1000).toFixed(1);
    return `${sec}s`;
  }
}
