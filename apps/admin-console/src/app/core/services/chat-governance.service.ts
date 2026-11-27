import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../features/chat/chat.models';

export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ChatGovernanceOverviewDto {
  totalChatUsers: number;
  onlineUsers: number;
  chatOnlyUsers: number;
  chatOnlyOnline: number;
  frozenUsers: number;
  activeSpaces: number;
  frozenSpaces: number;
  archivedSpaces: number;
  totalDms: number;
  messagesLast7Days: number;
  editedMessagesLast7Days: number;
  deletedMessagesLast7Days: number;
  totalAttachmentsCount: number;
  totalAttachmentsSizeMb: number;
  dlpAlertsLast7Days: number;
}

export interface GovernanceSpaceDto {
  id: string;
  name: string;
  description?: string;
  category?: string;
  status: 'ACTIVE' | 'FROZEN' | 'ARCHIVED';
  branchId?: string;
  memberCount: number;
  messageCount: number;
  lastMessageAt?: string;
  createdAt: string;
}

export interface GovernanceChatUserDto {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  roleName: string;
  isChatOnly: boolean;
  isEnabled: boolean;
  status: string;
  online: boolean;
  lastLogin?: string;
  chatFrozenUntil?: string;
  chatFrozenReason?: string;
  spacesCount: number;
}

export interface GovernanceAuditMessageDto {
  id: string;
  conversationId: string;
  conversationName: string;
  conversationType: string;
  senderId: string;
  senderName: string;
  content: string;
  originalContent?: string;
  isEdited: boolean;
  editedAt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
}

export interface GovernanceAttachmentDto {
  id: string;
  messageId: string;
  conversationId: string;
  conversationName: string;
  senderName: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  createdAt: string;
}

export interface GovernanceDlpEventDto {
  id: string;
  conversationId?: string;
  conversationName?: string;
  userId?: string;
  userName?: string;
  eventType: string;
  severity: string;
  description?: string;
  ipAddress?: string;
  createdAt: string;
}

export interface BreakGlassTranscriptDto {
  conversationId: string;
  conversationName: string;
  conversationType: string;
  auditedAt: string;
  reason: string;
  messages: Array<{
    id: string;
    senderName: string;
    content: string;
    originalContent?: string;
    isEdited: boolean;
    isDeleted: boolean;
    createdAt: string;
    attachmentCount: number;
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class ChatGovernanceService {
  private readonly http = inject(HttpClient);
  private readonly chatUrl = `${environment.apiBaseUrl || ''}/api/v1/chat`;
  private readonly governanceUrl = `${this.chatUrl}/governance`;

  getOverview(): Observable<ChatGovernanceOverviewDto> {
    return this.http
      .get<ApiResponse<ChatGovernanceOverviewDto> | ChatGovernanceOverviewDto>(
        `${this.governanceUrl}/overview`
      )
      .pipe(map((res) => this.unwrap(res)));
  }

  getSpaces(
    params: { status?: string; search?: string; page?: number; size?: number } = {}
  ): Observable<PagedResponse<GovernanceSpaceDto>> {
    return this.http
      .get<ApiResponse<PagedResponse<GovernanceSpaceDto>> | PagedResponse<GovernanceSpaceDto>>(
        `${this.governanceUrl}/spaces`,
        { params: this.buildParams(params) }
      )
      .pipe(map((res) => this.unwrap(res)));
  }

  updateSpaceStatus(
    id: string,
    status: 'ACTIVE' | 'FROZEN' | 'ARCHIVED'
  ): Observable<GovernanceSpaceDto> {
    return this.http
      .patch<ApiResponse<GovernanceSpaceDto> | GovernanceSpaceDto>(
        `${this.governanceUrl}/spaces/${id}/status`,
        { status }
      )
      .pipe(map((res) => this.unwrap(res)));
  }

  getUsers(
    params: { filter?: string; search?: string; page?: number; size?: number } = {}
  ): Observable<PagedResponse<GovernanceChatUserDto>> {
    return this.http
      .get<ApiResponse<PagedResponse<GovernanceChatUserDto>> | PagedResponse<GovernanceChatUserDto>>(
        `${this.governanceUrl}/users`,
        { params: this.buildParams(params) }
      )
      .pipe(map((res) => this.unwrap(res)));
  }

  freezeUser(
    id: string,
    payload: { reason: string; chatOnlyFreeze: boolean; durationHours?: number }
  ): Observable<{ success: boolean; message: string }> {
    return this.http
      .post<
        ApiResponse<{ success: boolean; message: string }> | { success: boolean; message: string }
      >(`${this.governanceUrl}/users/${id}/freeze`, payload)
      .pipe(map((res) => this.unwrap(res)));
  }

  unfreezeUser(id: string): Observable<{ success: boolean; message: string }> {
    return this.http
      .post<
        ApiResponse<{ success: boolean; message: string }> | { success: boolean; message: string }
      >(`${this.governanceUrl}/users/${id}/unfreeze`, {})
      .pipe(map((res) => this.unwrap(res)));
  }

  getAuditMessages(
    params: { type?: string; days?: number; page?: number; size?: number } = {}
  ): Observable<PagedResponse<GovernanceAuditMessageDto>> {
    return this.http
      .get<
        ApiResponse<PagedResponse<GovernanceAuditMessageDto>> | PagedResponse<GovernanceAuditMessageDto>
      >(`${this.governanceUrl}/audit/messages`, { params: this.buildParams(params) })
      .pipe(map((res) => this.unwrap(res)));
  }

  getAuditAttachments(
    params: { days?: number; page?: number; size?: number } = {}
  ): Observable<PagedResponse<GovernanceAttachmentDto>> {
    return this.http
      .get<
        ApiResponse<PagedResponse<GovernanceAttachmentDto>> | PagedResponse<GovernanceAttachmentDto>
      >(`${this.governanceUrl}/audit/attachments`, { params: this.buildParams(params) })
      .pipe(map((res) => this.unwrap(res)));
  }

  downloadAuditAttachment(attachmentId: string): Observable<Blob> {
    return this.http
      .get<
        | ApiResponse<{ id: string; fileName: string; contentType: string; fileSize: number; storageUrl: string }>
        | { id: string; fileName: string; contentType: string; fileSize: number; storageUrl: string }
      >(`${this.governanceUrl}/audit/attachments/${attachmentId}/download`)
      .pipe(
        map((res) => {
          const payload = this.unwrap(res);
          return this.dataUrlToBlob(payload.storageUrl, payload.contentType);
        })
      );
  }

  private dataUrlToBlob(dataUrl: string, fallbackContentType?: string): Blob {
    if (!dataUrl || !dataUrl.startsWith('data:')) {
      return new Blob([dataUrl || ''], { type: fallbackContentType || 'application/octet-stream' });
    }
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) {
      return new Blob([], { type: fallbackContentType || 'application/octet-stream' });
    }
    const header = dataUrl.slice(5, commaIdx);
    const mimeMatch = header.match(/^([^;]+)/);
    const mimeType = mimeMatch?.[1] || fallbackContentType || 'application/octet-stream';
    const base64 = dataUrl.slice(commaIdx + 1);
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }

  getDlpEvents(
    params: { days?: number; page?: number; size?: number } = {}
  ): Observable<PagedResponse<GovernanceDlpEventDto>> {
    return this.http
      .get<ApiResponse<PagedResponse<GovernanceDlpEventDto>> | PagedResponse<GovernanceDlpEventDto>>(
        `${this.governanceUrl}/dlp/events`,
        { params: this.buildParams(params) }
      )
      .pipe(map((res) => this.unwrap(res)));
  }

  reportDlpEvent(payload: {
    conversationId?: string;
    eventType: string;
    description?: string;
  }): Observable<void> {
    return this.http
      .post<ApiResponse<void> | void>(`${this.chatUrl}/dlp/report`, payload)
      .pipe(map(() => void 0));
  }

  breakGlassInspect(conversationId: string, reason: string): Observable<BreakGlassTranscriptDto> {
    return this.http
      .post<ApiResponse<BreakGlassTranscriptDto> | BreakGlassTranscriptDto>(
        `${this.governanceUrl}/break-glass/conversations/${conversationId}`,
        { reason }
      )
      .pipe(map((res) => this.unwrap(res)));
  }

  private buildParams(entries: Record<string, string | number | undefined | null>): HttpParams {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(entries)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return httpParams;
  }

  private unwrap<T>(res: ApiResponse<T> | T): T {
    if (res && typeof res === 'object' && 'data' in res && 'success' in res) {
      return (res as ApiResponse<T>).data;
    }
    return res as T;
  }
}
