/**
 * @file repository.tokens.ts
 * @description Tokens de inyección (Ports) para desacoplar componentes y stores de implementaciones concretas.
 * Estándar SDOP — SyborX.
 */

import { InjectionToken } from '@angular/core';

export const LICENSE_REPOSITORY = new InjectionToken<unknown>('LICENSE_REPOSITORY');
export const INVENTORY_REPOSITORY = new InjectionToken<unknown>('INVENTORY_REPOSITORY');
export const SUPPLIER_REPOSITORY = new InjectionToken<unknown>('SUPPLIER_REPOSITORY');
export const USER_ACTIVITY_REPOSITORY = new InjectionToken<unknown>('USER_ACTIVITY_REPOSITORY');
