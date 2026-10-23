/**
 * @file zone-lease.service.ts
 * @description Servicio de Gestión del Protocolo de Arrendamiento Exclusivo de Pasillo (Zone Lease Protocol - HU-155).
 * Implementa la ventana de 30 minutos escalonada con alertas hápticas/sonoras y bloqueo preventivo local.
 */

import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import { OfflineIndexedDb, ZoneLeaseRecord } from '../db/offline-indexed-db';
import { SyncService } from './sync.service';

export type ZoneLeaseStatus = 'ACTIVE' | 'WARNING' | 'EXPIRED' | 'NONE';

const LEASE_DURATION_SECONDS = 30 * 60; // 30 minutos (1800s)
const WARNING_THRESHOLD_SECONDS = 5 * 60; // 5 minutos (300s)

@Injectable({ providedIn: 'root' })
export class ZoneLeaseService implements OnDestroy {
  private readonly syncService = inject(SyncService);

  // ─── Señales Reactivas ───────────────────────────────────────────────────
  private readonly _activeLease = signal<ZoneLeaseRecord | null>(null);
  private readonly _secondsRemaining = signal<number>(0);
  private readonly _hasTriggeredWarning = signal<boolean>(false);
  private timerInterval: any = null;

  /** Arrendamiento activo en el dispositivo */
  readonly activeLease = this._activeLease.asReadonly();

  /** Segundos restantes de arrendamiento */
  readonly secondsRemaining = this._secondsRemaining.asReadonly();

  /** Estado actual del Zone Lease (ACTIVE, WARNING, EXPIRED, NONE) */
  readonly leaseStatus = computed<ZoneLeaseStatus>(() => {
    const lease = this._activeLease();
    if (!lease) return 'NONE';

    const sec = this._secondsRemaining();
    if (sec <= 0) return 'EXPIRED';
    if (sec <= WARNING_THRESHOLD_SECONDS) return 'WARNING';
    return 'ACTIVE';
  });

  /** Formato visual MM:SS */
  readonly formattedTime = computed<string>(() => {
    const sec = this._secondsRemaining();
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  });

  /** Indica si el escaneo está bloqueado por expiración del lease */
  readonly isScanLocked = computed<boolean>(() => {
    return this.leaseStatus() === 'EXPIRED';
  });

  constructor() {
    this.restoreActiveLease();
  }

  // ─── API Pública ──────────────────────────────────────────────────────────

  /**
   * Solicita o inicia un arrendamiento de 30 minutos para un pasillo/zona.
   */
  async requestLease(zoneId: string, zoneName: string): Promise<boolean> {
    const now = Date.now();
    const expiresAt = now + LEASE_DURATION_SECONDS * 1000;
    const token = `lease_${zoneId}_${now}_${Math.random().toString(36).slice(2, 7)}`;

    const record: ZoneLeaseRecord = {
      zoneId,
      zoneName,
      leaseToken: token,
      grantedAt: now,
      expiresAt,
      status: 'ACTIVE',
    };

    await OfflineIndexedDb.saveZoneLease(record);
    this._activeLease.set(record);
    this._secondsRemaining.set(LEASE_DURATION_SECONDS);
    this._hasTriggeredWarning.set(false);

    this.startTimer();
    return true;
  }

  /**
   * Renueva el arrendamiento reiniciando los 30 minutos si hay conectividad.
   */
  async renewLease(): Promise<boolean> {
    const current = this._activeLease();
    if (!current) return false;

    return this.requestLease(current.zoneId, current.zoneName);
  }

  /**
   * Libera el arrendamiento del pasillo al concluir las tareas o cambiar de zona.
   */
  async releaseLease(): Promise<void> {
    const current = this._activeLease();
    if (current) {
      await OfflineIndexedDb.removeZoneLease(current.zoneId);
    }
    this.stopTimer();
    this._activeLease.set(null);
    this._secondsRemaining.set(0);
    this._hasTriggeredWarning.set(false);
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  // ─── Métodos Privados ─────────────────────────────────────────────────────

  private startTimer(): void {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (this._secondsRemaining() > 0) {
        this._secondsRemaining.update(s => s - 1);
        this.checkWarningThreshold();
      } else {
        this.stopTimer();
        this.handleLeaseExpired();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private checkWarningThreshold(): void {
    const sec = this._secondsRemaining();
    if (sec <= WARNING_THRESHOLD_SECONDS && !this._hasTriggeredWarning()) {
      this._hasTriggeredWarning.set(true);

      // Disparador de Vibración Háptica (HU-155)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([150, 100, 150, 100, 250]);
      }
    }
  }

  private handleLeaseExpired(): void {
    const current = this._activeLease();
    if (current) {
      current.status = 'EXPIRED';
      this._activeLease.set({ ...current });
      OfflineIndexedDb.saveZoneLease(current);
    }

    // Alerta háptica persistente de bloqueo
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([300, 150, 300]);
    }
  }

  private async restoreActiveLease(): Promise<void> {
    const raw = localStorage.getItem('4guard_active_zone_lease');
    if (raw) {
      try {
        const lease: ZoneLeaseRecord = JSON.parse(raw);
        const remaining = Math.max(0, Math.floor((lease.expiresAt - Date.now()) / 1000));
        if (remaining > 0) {
          this._activeLease.set(lease);
          this._secondsRemaining.set(remaining);
          this.startTimer();
        } else {
          this._activeLease.set({ ...lease, status: 'EXPIRED' });
          this._secondsRemaining.set(0);
        }
      } catch {}
    }
  }
}
