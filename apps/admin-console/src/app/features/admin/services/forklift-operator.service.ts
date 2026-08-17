/**
 * @file forklift-operator.service.ts
 * @description Servicio reactivo basado en Angular Signals con persistencia en localStorage para Montacarguistas.
 * Utilizado en la sección Administrar -> Montacarguistas y sincronizado con Movimientos de Almacén.
 */

import { Injectable, signal, computed } from '@angular/core';
import {
  ForkliftOperator,
  CreateForkliftOperatorDto,
  calculateLicenseStatus,
} from '../models/forklift-operator.models';

const STORAGE_KEY = '4guard_forklift_operators';

@Injectable({
  providedIn: 'root',
})
export class ForkliftOperatorAdminService {
  private readonly operatorsSignal = signal<ForkliftOperator[]>(this.loadOperatorsFromStorage());

  readonly operators = this.operatorsSignal.asReadonly();

  readonly activeOperators = computed(() =>
    this.operatorsSignal().filter((op) => op.status === 'ACTIVO')
  );

  readonly dropdownOperators = computed(() =>
    this.activeOperators().map((op) => ({
      code: op.code,
      name: op.fullName,
    }))
  );

  private loadOperatorsFromStorage(): ForkliftOperator[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: ForkliftOperator[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Re-calcular estatus de licencias al cargar
          return parsed.map((op) => ({
            ...op,
            licenseStatus: calculateLicenseStatus(op.licenseExpirationDate),
          }));
        }
      }
    } catch (e) {
      console.warn('Error al leer montacarguistas de localStorage:', e);
    }
    const initial = this.getInitialSeedOperators();
    this.saveToStorage(initial);
    return initial;
  }

  private saveToStorage(list: ForkliftOperator[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Error al guardar montacarguistas en localStorage:', e);
    }
  }

  createOperator(dto: CreateForkliftOperatorDto): ForkliftOperator {
    const list = this.operatorsSignal();
    const nextNum = list.length + 101;
    const code = `MC-${nextNum}`;
    const fullName = `${dto.firstName.trim()} ${dto.lastNamePaternal.trim()} ${dto.lastNameMaternal.trim()}`.trim();
    const licStatus = calculateLicenseStatus(dto.licenseExpirationDate);

    const newOperator: ForkliftOperator = {
      id: `MC-ID-${Date.now()}`,
      code,
      firstName: dto.firstName.trim(),
      lastNamePaternal: dto.lastNamePaternal.trim(),
      lastNameMaternal: dto.lastNameMaternal.trim(),
      fullName,
      licenseNumberDc3: dto.licenseNumberDc3.toUpperCase().trim(),
      licenseExpirationDate: dto.licenseExpirationDate,
      licenseStatus: licStatus,
      shift: dto.shift,
      status: 'ACTIVO',
      createdAt: new Date().toISOString().split('T')[0],
    };

    const updated = [newOperator, ...list];
    this.operatorsSignal.set(updated);
    this.saveToStorage(updated);
    return newOperator;
  }

  updateOperator(id: string, dto: Partial<CreateForkliftOperatorDto>): void {
    this.operatorsSignal.update((list) => {
      const updatedList = list.map((op) => {
        if (op.id === id) {
          const fn = dto.firstName !== undefined ? dto.firstName.trim() : op.firstName;
          const lp = dto.lastNamePaternal !== undefined ? dto.lastNamePaternal.trim() : op.lastNamePaternal;
          const lm = dto.lastNameMaternal !== undefined ? dto.lastNameMaternal.trim() : op.lastNameMaternal;
          const fullName = `${fn} ${lp} ${lm}`.trim();
          const expDate = dto.licenseExpirationDate || op.licenseExpirationDate;

          return {
            ...op,
            firstName: fn,
            lastNamePaternal: lp,
            lastNameMaternal: lm,
            fullName,
            licenseNumberDc3: dto.licenseNumberDc3 !== undefined ? dto.licenseNumberDc3.toUpperCase().trim() : op.licenseNumberDc3,
            licenseExpirationDate: expDate,
            licenseStatus: calculateLicenseStatus(expDate),
            shift: dto.shift !== undefined ? dto.shift : op.shift,
          };
        }
        return op;
      });
      this.saveToStorage(updatedList);
      return updatedList;
    });
  }

  deleteOperator(id: string): void {
    this.operatorsSignal.update((list) => {
      const filtered = list.filter((op) => op.id !== id);
      this.saveToStorage(filtered);
      return filtered;
    });
  }

  toggleStatus(id: string): void {
    this.operatorsSignal.update((list) => {
      const updated = list.map((op) =>
        op.id === id ? { ...op, status: op.status === 'ACTIVO' ? ('INACTIVO' as const) : ('ACTIVO' as const) } : op
      );
      this.saveToStorage(updated);
      return updated;
    });
  }

  private getInitialSeedOperators(): ForkliftOperator[] {
    return [
      {
        id: 'MC-ID-101',
        code: 'MC-101',
        firstName: 'Alan',
        lastNamePaternal: 'Huerta',
        lastNameMaternal: 'Pérez',
        fullName: 'Alan Huerta Pérez',
        licenseNumberDc3: 'LIC-MC-9901',
        licenseExpirationDate: '2027-12-31',
        licenseStatus: 'VIGENTE',
        shift: 'Turno 1 - Matutino (06:00 - 14:00)',
        status: 'ACTIVO',
        createdAt: '2026-01-15',
      },
      {
        id: 'MC-ID-102',
        code: 'MC-102',
        firstName: 'Pablo',
        lastNamePaternal: 'Hernández',
        lastNameMaternal: 'Ramos',
        fullName: 'Pablo Hernández Ramos',
        licenseNumberDc3: 'LIC-MC-9902',
        licenseExpirationDate: '2027-12-31',
        licenseStatus: 'VIGENTE',
        shift: 'Turno 1 - Matutino (06:00 - 14:00)',
        status: 'ACTIVO',
        createdAt: '2026-01-15',
      },
      {
        id: 'MC-ID-103',
        code: 'MC-103',
        firstName: 'Alejandro',
        lastNamePaternal: 'Martínez',
        lastNameMaternal: 'Solís',
        fullName: 'Alejandro Martínez Solís',
        licenseNumberDc3: 'LIC-MC-9903',
        licenseExpirationDate: '2027-10-15',
        licenseStatus: 'VIGENTE',
        shift: 'Turno 2 - Vespertino (14:00 - 22:00)',
        status: 'ACTIVO',
        createdAt: '2026-02-01',
      },
      {
        id: 'MC-ID-104',
        code: 'MC-104',
        firstName: 'Gerardo',
        lastNamePaternal: 'González',
        lastNameMaternal: 'Carbajal',
        fullName: 'Gerardo González Carbajal',
        licenseNumberDc3: 'LIC-MC-9904',
        licenseExpirationDate: '2026-09-10',
        licenseStatus: 'POR_VENCER',
        shift: 'Turno 2 - Vespertino (14:00 - 22:00)',
        status: 'ACTIVO',
        createdAt: '2026-02-10',
      },
      {
        id: 'MC-ID-105',
        code: 'MC-105',
        firstName: 'Saul',
        lastNamePaternal: 'Reyes',
        lastNameMaternal: 'Trejo',
        fullName: 'Saul Reyes Trejo',
        licenseNumberDc3: 'LIC-MC-9905',
        licenseExpirationDate: '2027-08-10',
        licenseStatus: 'VIGENTE',
        shift: 'Turno 3 - Nocturno (22:00 - 06:00)',
        status: 'ACTIVO',
        createdAt: '2026-03-01',
      },
      {
        id: 'MC-ID-106',
        code: 'MC-106',
        firstName: 'Carlos',
        lastNamePaternal: 'Ruiz',
        lastNameMaternal: 'Mendoza',
        fullName: 'Carlos Ruiz Mendoza',
        licenseNumberDc3: 'LIC-MC-9906',
        licenseExpirationDate: '2027-06-30',
        licenseStatus: 'VIGENTE',
        shift: 'Turno 1 - Matutino (06:00 - 14:00)',
        status: 'ACTIVO',
        createdAt: '2026-03-15',
      },
      {
        id: 'MC-ID-107',
        code: 'MC-107',
        firstName: 'Juan Manuel',
        lastNamePaternal: 'López',
        lastNameMaternal: 'García',
        fullName: 'Juan Manuel López García',
        licenseNumberDc3: 'LIC-MC-9907',
        licenseExpirationDate: '2026-09-01',
        licenseStatus: 'POR_VENCER',
        shift: 'Turno 2 - Vespertino (14:00 - 22:00)',
        status: 'ACTIVO',
        createdAt: '2026-04-01',
      },
      {
        id: 'MC-ID-108',
        code: 'MC-108',
        firstName: 'Héctor',
        lastNamePaternal: 'Villalvo',
        lastNameMaternal: 'Chávez',
        fullName: 'Héctor Villalvo Chávez',
        licenseNumberDc3: 'LIC-MC-9908',
        licenseExpirationDate: '2027-04-12',
        licenseStatus: 'VIGENTE',
        shift: 'Turno 1 - Matutino (06:00 - 14:00)',
        status: 'ACTIVO',
        createdAt: '2026-04-10',
      },
      {
        id: 'MC-ID-109',
        code: 'MC-109',
        firstName: 'Roberto',
        lastNamePaternal: 'Carmona',
        lastNameMaternal: 'Juárez',
        fullName: 'Roberto Carmona Juárez',
        licenseNumberDc3: 'LIC-MC-9909',
        licenseExpirationDate: '2027-01-15',
        licenseStatus: 'VIGENTE',
        shift: 'Turno 3 - Nocturno (22:00 - 06:00)',
        status: 'ACTIVO',
        createdAt: '2026-05-01',
      },
      {
        id: 'MC-ID-110',
        code: 'MC-110',
        firstName: 'Miguel Ángel',
        lastNamePaternal: 'Soria',
        lastNameMaternal: 'Torres',
        fullName: 'Miguel Ángel Soria Torres',
        licenseNumberDc3: 'LIC-MC-9910',
        licenseExpirationDate: '2027-09-18',
        licenseStatus: 'VIGENTE',
        shift: 'Turno 2 - Vespertino (14:00 - 22:00)',
        status: 'ACTIVO',
        createdAt: '2026-05-15',
      },
    ];
  }
}
