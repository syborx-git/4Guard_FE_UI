/**
 * @file audit-console.component.ts
 * @description Consola de Auditoría real y homologada (ADR-022 / HU).
 * Consulta la bitácora de auditoría del backend y la presenta con el
 * lenguaje visual de Recepción / Vigilancia.
 */

import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuditConsoleService } from './audit-console.service';
import {
  AuditLogDetail,
  AuditLogItem,
  AuditConsoleSummary,
} from './audit-console.model';

const EMPTY_SUMMARY: AuditConsoleSummary = {
  total: 0,
  uniqueUsers: 0,
  creates: 0,
  updates: 0,
  deletes: 0,
  errors: 0,
};

@Component({
  selector: 'fg-audit-console',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './audit-console.component.html',
  styleUrl: './audit-console.component.css',
})
export class AuditConsoleComponent implements OnInit {
  private readonly service = inject(AuditConsoleService);

  readonly actionFilter = signal<string>('');
  readonly entityTypeFilter = signal<string>('');
  readonly searchTerm = signal<string>('');
  readonly datePreset = signal<'TODAY' | 'MONTH' | 'YEAR' | 'CUSTOM'>('MONTH');
  readonly customFrom = signal<string>('');
  readonly customTo = signal<string>('');
  readonly page = signal<number>(1);
  readonly pageSize = signal<number>(20);

  readonly allItems = signal<AuditLogItem[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly selectedItem = signal<AuditLogItem | null>(null);

  readonly filteredItems = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    const action = this.actionFilter();
    const entityType = this.entityTypeFilter();

    return this.allItems().filter((item) => {
      if (action && item.action !== action) return false;
      if (entityType && item.entityType !== entityType) return false;
      if (!q) return true;
      return (
        item.username.toLowerCase().includes(q) ||
        item.action.toLowerCase().includes(q) ||
        item.entityType.toLowerCase().includes(q) ||
        (item.entityId ?? '').toLowerCase().includes(q) ||
        (item.ipAddress ?? '').toLowerCase().includes(q)
      );
    });
  });

  readonly summary = computed<AuditConsoleSummary>(() => {
    const items = this.filteredItems();
    if (items.length === 0) return EMPTY_SUMMARY;
    return {
      total: items.length,
      uniqueUsers: new Set(items.map((i) => i.userId)).size,
      creates: items.filter((i) => i.action.includes('CREATE') || i.action.includes('REGISTRAD') || i.action.includes('CREAD')).length,
      updates: items.filter((i) => i.action.includes('UPDATE') || i.action.includes('MODIFICAD')).length,
      deletes: items.filter((i) => i.action.includes('DELETE') || i.action.includes('ELIMINAD')).length,
      errors: items.filter((i) => i.details?.some((d) => d.newValue === 'FAILED' || d.newValue === 'REJECTED')).length,
    };
  });

  readonly totalPages = computed(() => {
    const size = this.pageSize();
    const total = this.filteredItems().length;
    return total === 0 ? 1 : Math.ceil(total / size);
  });

  readonly pagedItems = computed(() => {
    const size = this.pageSize();
    const start = (this.page() - 1) * size;
    return this.filteredItems().slice(start, start + size);
  });

  readonly actionOptions = computed(() => {
    const set = new Set(this.allItems().map((i) => i.action));
    return Array.from(set).sort();
  });

  readonly entityTypeOptions = computed(() => {
    const set = new Set(this.allItems().map((i) => i.entityType));
    return Array.from(set).sort();
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const range = this.buildRange();
    this.isLoading.set(true);
    this.error.set(null);

    this.service
      .load({
        action: this.actionFilter() || null,
        fromDate: range.from,
        toDate: range.to,
      })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (items) => {
          this.allItems.set(items);
          this.page.set(1);
        },
        error: (err) => {
          this.allItems.set([]);
          this.error.set(
            err?.error?.message || err?.message || 'No se pudo cargar la bitácora de auditoría.'
          );
        },
      });
  }

  applyPreset(preset: 'TODAY' | 'MONTH' | 'YEAR' | 'CUSTOM'): void {
    this.datePreset.set(preset);
    if (preset !== 'CUSTOM') {
      this.page.set(1);
      this.load();
    }
  }

  applyFilters(): void {
    this.page.set(1);
    this.load();
  }

  resetFilters(): void {
    this.actionFilter.set('');
    this.entityTypeFilter.set('');
    this.searchTerm.set('');
    this.datePreset.set('MONTH');
    this.customFrom.set('');
    this.customTo.set('');
    this.page.set(1);
    this.load();
  }

  onPageSizeChange(event: Event): void {
    this.pageSize.set(Number((event.target as HTMLSelectElement).value) || 20);
    this.page.set(1);
  }

  changePage(delta: number): void {
    const next = this.page() + delta;
    if (next < 1 || next > this.totalPages()) return;
    this.page.set(next);
  }

  openDetail(item: AuditLogItem): void {
    this.selectedItem.set(item);
  }

  closeDetail(): void {
    this.selectedItem.set(null);
  }

  formatDateTime(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  actionTone(action: string): string {
    if (action.includes('DELETE') || action.includes('CANCEL') || action.includes('ELIMINAD')) return 'danger';
    if (action.includes('CREATE') || action.includes('REGISTRAD') || action.includes('CREAD') || action.includes('LOGIN')) return 'success';
    if (action.includes('UPDATE') || action.includes('MODIFICAD') || action.includes('STATUS')) return 'info';
    return 'neutral';
  }

  actionLabel(action: string): string {
    return (action || 'ACTIVITY').replace(/_/g, ' ');
  }

  entityLabel(entityType: string): string {
    return (entityType || 'SISTEMA').replace(/_/g, ' ');
  }

  isError(item: AuditLogItem): boolean {
    return item.details?.some((d) => d.newValue === 'FAILED' || d.newValue === 'REJECTED') ?? false;
  }

  private buildRange(): { from: string | null; to: string | null } {
    const now = new Date();
    const preset = this.datePreset();

    if (preset === 'CUSTOM') {
      const fromValue = this.customFrom();
      const toValue = this.customTo();
      const from = fromValue ? new Date(`${fromValue}T00:00:00`) : null;
      const to = toValue ? new Date(`${toValue}T23:59:59`) : null;
      return {
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
      };
    }

    if (preset === 'TODAY') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      return { from: start.toISOString(), to: now.toISOString() };
    }

    if (preset === 'YEAR') {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      return { from: start.toISOString(), to: now.toISOString() };
    }

    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    return { from: start.toISOString(), to: now.toISOString() };
  }
}
