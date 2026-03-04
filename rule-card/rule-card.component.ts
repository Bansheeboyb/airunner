import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DisplayRule } from '../../models/discovered-rules.models';

@Component({
  selector: 'app-rule-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rule-card.component.html',
  styleUrl: './rule-card.component.css',
})
export class RuleCardComponent {
  readonly rule = input.required<DisplayRule>();

  readonly viewSource = output<DisplayRule>();

  readonly isExpanded = signal(false);

  toggleExpand(): void {
    this.isExpanded.update((v) => !v);
  }

  onViewSource(event: Event): void {
    event.stopPropagation();
    this.viewSource.emit(this.rule());
  }

  getPrimaryRate(): string {
    for (const term of this.rule().terms) {
      for (const attr of term.attributes) {
        if (attr.name === 'Amount' || attr.name === 'Conversion') {
          const val = attr.newValue || attr.currentValue;
          return val ? `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'N/A';
        }
      }
    }
    return 'N/A';
  }

  getTermSummary(): string {
    return this.rule().terms.map((t) => t.termName).join(' > ');
  }

  hasChanges(): boolean {
    return this.rule().isModified;
  }

  getSourcePageNumbers(): number[] {
    return [...new Set(this.rule().sourcePages.map((p) => p.page_number))].sort((a, b) => a - b);
  }
}
