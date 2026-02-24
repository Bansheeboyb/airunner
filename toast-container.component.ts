import { Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  template: `
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [class]="'toast-' + toast.type" (click)="toastService.dismiss(toast.id)">
          <div class="toast-icon">
            @if (toast.type === 'success') {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            } @else if (toast.type === 'error') {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            } @else {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            }
          </div>
          <div class="toast-body">
            <div class="toast-title">{{ toast.title }}</div>
            <div class="toast-message">{{ toast.message }}</div>
          </div>
          <button class="toast-close" (click)="toastService.dismiss(toast.id); $event.stopPropagation()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div class="toast-timer" [style.animation-duration.ms]="toast.durationMs"></div>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 1.25rem;
      right: 1.25rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      max-width: 420px;
      width: 100%;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      border-radius: 14px;
      background: white;
      box-shadow:
        0 8px 30px rgba(0, 0, 0, 0.12),
        0 2px 8px rgba(0, 0, 0, 0.06);
      pointer-events: auto;
      cursor: pointer;
      animation: toastIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      overflow: hidden;
      border-left: 4px solid transparent;
    }

    .toast-success { border-left-color: #10b981; }
    .toast-error   { border-left-color: #ef4444; }
    .toast-info    { border-left-color: #3b82f6; }

    .toast-icon {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      margin-top: 1px;
    }

    .toast-success .toast-icon { color: #10b981; }
    .toast-error .toast-icon   { color: #ef4444; }
    .toast-info .toast-icon    { color: #3b82f6; }

    .toast-icon svg {
      width: 24px;
      height: 24px;
    }

    .toast-body {
      flex: 1;
      min-width: 0;
    }

    .toast-title {
      font-weight: 700;
      font-size: 0.9rem;
      color: #1e293b;
      line-height: 1.3;
    }

    .toast-message {
      font-size: 0.82rem;
      color: #64748b;
      margin-top: 2px;
      line-height: 1.4;
    }

    .toast-close {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      background: none;
      border: none;
      cursor: pointer;
      color: #94a3b8;
      padding: 0;
      margin-top: 2px;
      transition: color 0.15s ease;
    }

    .toast-close:hover { color: #475569; }

    .toast-close svg {
      width: 16px;
      height: 16px;
    }

    .toast-timer {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      width: 100%;
      animation: timerShrink linear forwards;
    }

    .toast-success .toast-timer { background: #10b981; }
    .toast-error .toast-timer   { background: #ef4444; }
    .toast-info .toast-timer    { background: #3b82f6; }

    @keyframes toastIn {
      from {
        opacity: 0;
        transform: translateX(40px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
    }

    @keyframes timerShrink {
      from { width: 100%; }
      to   { width: 0%; }
    }
  `],
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);
}
