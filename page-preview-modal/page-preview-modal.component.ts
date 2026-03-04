import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DisplayRule } from '../../models/discovered-rules.models';

@Component({
  selector: 'app-page-preview-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page-preview-modal.component.html',
  styleUrl: './page-preview-modal.component.css',
})
export class PagePreviewModalComponent {
  readonly isOpen = input.required<boolean>();
  readonly rule = input<DisplayRule | null>(null);

  readonly close = output<void>();

  readonly selectedPageIdx = signal(0);

  readonly currentPage = computed(() => {
    const r = this.rule();
    if (!r || !r.sourcePages.length) return null;
    return r.sourcePages[this.selectedPageIdx()] ?? r.sourcePages[0];
  });

  onOverlayClick(event: Event): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.close.emit();
    }
  }

  onClose(): void {
    this.close.emit();
  }

  selectPage(index: number): void {
    this.selectedPageIdx.set(index);
  }
}
