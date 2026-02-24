import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
  durationMs: number;
}

let nextId = 0;

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(title: string, message: string, type: Toast['type'] = 'info', durationMs = 5000): void {
    const toast: Toast = { id: nextId++, title, message, type, durationMs };
    this._toasts.update((t) => [...t, toast]);

    setTimeout(() => this.dismiss(toast.id), durationMs);
  }

  success(title: string, message: string, durationMs = 5000): void {
    this.show(title, message, 'success', durationMs);
  }

  error(title: string, message: string, durationMs = 7000): void {
    this.show(title, message, 'error', durationMs);
  }

  dismiss(id: number): void {
    this._toasts.update((t) => t.filter((toast) => toast.id !== id));
  }
}
