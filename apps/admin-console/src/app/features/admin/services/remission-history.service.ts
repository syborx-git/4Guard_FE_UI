/**
 * @file remission-history.service.ts
 * @description Cliente HTTP del historial multi-entidad de remisiones.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthState } from '../../../core/auth/auth.state';
import { environment } from '../../../../environments/environment';
import {
  RemissionHistoryFilters,
  RemissionHistoryPage,
} from '../models/remission-history.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class RemissionHistoryService {
  private readonly http = inject(HttpClient);
  private readonly authState = inject(AuthState);

  load(filters: RemissionHistoryFilters): Observable<RemissionHistoryPage> {
    const user = this.authState.currentUser();
    const organizationId = user?.organizationId;
    const branchId = user?.branchId;

    let params = new HttpParams()
      .set('page', String(filters.page))
      .set('size', String(filters.size));

    if (organizationId) params = params.set('organizationId', organizationId);
    if (branchId) params = params.set('branchId', branchId);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    if (filters.clientId) params = params.set('clientId', filters.clientId);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.entityType) params = params.set('entityType', filters.entityType);
    if (filters.shiftSessionId) params = params.set('shiftSessionId', filters.shiftSessionId);
    if (filters.search) params = params.set('search', filters.search);

    return this.http
      .get<ApiResponse<RemissionHistoryPage>>(
        `${environment.apiBaseUrl}/api/v1/audit/remissions`,
        { params }
      )
      .pipe(map((response) => response.data));
  }
}
