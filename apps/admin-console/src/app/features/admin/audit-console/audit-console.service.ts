/**
 * @file audit-console.service.ts
 * @description Cliente HTTP de la Consola de Auditoría (GET /audit/user-activity).
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { AuditLogItem } from './audit-console.model';

interface AuditLogDto {
  logId: string;
  userId: string;
  username: string;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  details: Array<{ fieldName: string; oldValue: string | null; newValue: string | null }>;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class AuditConsoleService {
  private readonly http = inject(HttpClient);

  load(filters: {
    action?: string | null;
    fromDate?: string | null;
    toDate?: string | null;
  }): Observable<AuditLogItem[]> {
    let params = new HttpParams();
    if (filters.action) params = params.set('action', filters.action);
    if (filters.fromDate) params = params.set('fromDate', filters.fromDate);
    if (filters.toDate) params = params.set('toDate', filters.toDate);

    return this.http
      .get<ApiResponse<AuditLogDto[]>>(
        `${environment.apiBaseUrl}/api/v1/audit/user-activity`,
        { params }
      )
      .pipe(
        map((response) =>
          Array.isArray(response?.data)
            ? response.data.map((dto) => ({
                logId: dto.logId,
                userId: dto.userId,
                username: dto.username,
                action: dto.action,
                entityType: dto.entityType,
                entityId: dto.entityId,
                ipAddress: dto.ipAddress,
                userAgent: dto.userAgent,
                createdAt: dto.createdAt,
                details: dto.details ?? [],
              }))
            : []
        )
      );
  }
}
