/**
 * @file rf-chat.service.ts
 * @description Servicio ligero de Mensajería Empresarial 4GUARD para Terminal RF.
 * Consume /api/v1/chat/* con estado reactivo mediante Signals y polling cada 5s.
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subscription, tap, map } from 'rxjs';
import { StompClientService } from '@4guard/shared-core';

export type RfChatConversationType = 'DM' | 'SPACE' | 'THREAD';
export type RfChatNotificationPref = 'ALL' | 'MENTIONS' | 'MUTED';

export interface RfChatUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  roleName: string;
  branchId?: string | null;
  active: boolean;
}

export interface RfChatParticipant {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  notificationPref: RfChatNotificationPref;
  lastReadAt: string;
}

export interface RfChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  senderFullName: string;
  parentMessageId?: string | null;
  content: string;
  messageType: 'TEXT' | 'SYSTEM' | 'ENTITY_REF';
  metadataJson?: string | null;
  isEdited: boolean;
  editedAt?: string | null;
  isDeleted: boolean;
  createdAt: string;
}

export interface RfChatConversation {
  id: string;
  organizationId: string;
  branchId?: string | null;
  type: RfChatConversationType;
  name: string;
  description?: string | null;
  icon?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  lastMessageAt?: string | null;
  unreadCount: number;
  lastMessage?: RfChatMessage | null;
  participants: RfChatParticipant[];
  myNotificationPref: RfChatNotificationPref;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
}

@Injectable({
  providedIn: 'root',
})
export class RfChatService {
  private readonly http = inject(HttpClient);
  private readonly stompService = inject(StompClientService);
  private readonly baseUrl = '/api/v1/chat';

  readonly conversations = signal<RfChatConversation[]>([]);
  readonly users = signal<RfChatUser[]>([]);
  readonly activeConversationId = signal<string | null>(null);
  readonly messages = signal<RfChatMessage[]>([]);
  readonly isLoadingConversations = signal<boolean>(false);
  readonly isLoadingMessages = signal<boolean>(false);
  readonly isSending = signal<boolean>(false);
  readonly isModalOpen = signal<boolean>(false);

  private pollingId: ReturnType<typeof setInterval> | null = null;
  private userQueueSub: Subscription | null = null;
  private activeTopicSub: Subscription | null = null;

  readonly activeConversation = computed<RfChatConversation | null>(() => {
    const id = this.activeConversationId();
    return this.conversations().find((c) => c.id === id) ?? null;
  });

  readonly spaces = computed<RfChatConversation[]>(() =>
    this.conversations().filter((c) => c.type === 'SPACE')
  );

  readonly directMessages = computed<RfChatConversation[]>(() =>
    this.conversations().filter((c) => c.type === 'DM')
  );

  readonly totalUnreadCount = computed<number>(() =>
    this.conversations().reduce((sum, c) => sum + (c.unreadCount || 0), 0)
  );

  setModalOpen(open: boolean): void {
    this.isModalOpen.set(open);
    if (open) {
      this.loadConversations().subscribe({ error: () => {} });
      this.loadUsers().subscribe({ error: () => {} });
      const activeId = this.activeConversationId();
      if (activeId) {
        this.loadMessages(activeId).subscribe({ error: () => {} });
        this.markAsRead(activeId).subscribe({ error: () => {} });
      }
    }
  }

  startPolling(): void {
    this.initStompUserQueue();
    if (this.pollingId || typeof window === 'undefined') return;
    this.loadConversations().subscribe({ error: () => {} });
    this.pollingId = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      this.loadConversations().subscribe({ error: () => {} });
      const activeId = this.activeConversationId();
      if (activeId && this.isModalOpen()) {
        this.loadMessages(activeId).subscribe({ error: () => {} });
      }
    }, 5000);
  }

  stopPolling(): void {
    if (this.pollingId) {
      clearInterval(this.pollingId);
      this.pollingId = null;
    }
    this.userQueueSub?.unsubscribe();
    this.userQueueSub = null;
    this.activeTopicSub?.unsubscribe();
    this.activeTopicSub = null;
  }

  private initStompUserQueue(): void {
    if (this.userQueueSub || typeof window === 'undefined') return;
    try {
      this.userQueueSub = this.stompService.watchUserQueue<any>('chat').subscribe({
        next: (evt: any) => {
          if (!evt) return;
          this.loadConversations().subscribe({ error: () => {} });
          const activeId = this.activeConversationId();
          if (evt.eventType === 'MESSAGE_CREATED' && activeId && evt.conversationId === activeId && evt.payload) {
            const payload = evt.payload as RfChatMessage;
            if (payload?.id) {
              this.messages.update((list) =>
                list.some((m) => m.id === payload.id) ? list : [...list, payload]
              );
              this.markAsRead(activeId).subscribe({ error: () => {} });
            }
          }
        },
        error: () => {},
      });
    } catch {
      // Fallback silencioso a polling
    }
  }

  private subscribeToConversationTopic(conversationId: string): void {
    this.activeTopicSub?.unsubscribe();
    this.activeTopicSub = null;
    if (typeof window === 'undefined') return;
    try {
      this.activeTopicSub = this.stompService.watchTopic<any>(`/topic/chat.${conversationId}`).subscribe({
        next: (evt: any) => {
          if (!evt || !evt.eventType) return;
          const payload = evt.payload as RfChatMessage;
          if (!payload?.id) return;

          if (evt.eventType === 'MESSAGE_CREATED') {
            this.messages.update((list) =>
              list.some((m) => m.id === payload.id) ? list : [...list, payload]
            );
            this.markAsRead(conversationId).subscribe({ error: () => {} });
          } else if (evt.eventType === 'MESSAGE_UPDATED' || evt.eventType === 'MESSAGE_DELETED') {
            this.messages.update((list) => list.map((m) => (m.id === payload.id ? payload : m)));
          }
        },
        error: () => {},
      });
    } catch {
      // Fallback silencioso
    }
  }

  loadConversations(): Observable<RfChatConversation[]> {
    this.isLoadingConversations.set(true);
    return this.http.get<ApiResponse<RfChatConversation[]>>(`${this.baseUrl}/conversations`).pipe(
      map((res) => res.data || []),
      tap({
        next: (list) => {
          this.conversations.set(list);
          this.isLoadingConversations.set(false);
        },
        error: () => this.isLoadingConversations.set(false),
      })
    );
  }

  loadUsers(branchId?: string): Observable<RfChatUser[]> {
    let params = new HttpParams();
    if (branchId) params = params.set('branchId', branchId);
    return this.http.get<ApiResponse<RfChatUser[]>>(`${this.baseUrl}/users`, { params }).pipe(
      map((res) => res.data || []),
      tap((list) => this.users.set(list))
    );
  }

  selectConversation(conversationId: string): void {
    this.activeConversationId.set(conversationId);
    this.subscribeToConversationTopic(conversationId);
    this.loadMessages(conversationId).subscribe({ error: () => {} });
    this.markAsRead(conversationId).subscribe({ error: () => {} });
  }

  clearActiveConversation(): void {
    this.activeTopicSub?.unsubscribe();
    this.activeTopicSub = null;
    this.activeConversationId.set(null);
    this.messages.set([]);
  }

  startDirectMessage(targetUserId: string): Observable<RfChatConversation> {
    return this.http
      .post<ApiResponse<RfChatConversation>>(`${this.baseUrl}/conversations/dm`, { targetUserId })
      .pipe(
        map((res) => res.data),
        tap((conv) => {
          this.conversations.update((list) => {
            const exists = list.some((c) => c.id === conv.id);
            return exists ? list.map((c) => (c.id === conv.id ? conv : c)) : [conv, ...list];
          });
          this.selectConversation(conv.id);
        })
      );
  }

  loadMessages(conversationId: string, before?: string, limit = 40): Observable<RfChatMessage[]> {
    this.isLoadingMessages.set(true);
    let params = new HttpParams().set('limit', limit);
    if (before) params = params.set('before', before);

    return this.http
      .get<ApiResponse<RfChatMessage[]>>(`${this.baseUrl}/conversations/${conversationId}/messages`, { params })
      .pipe(
        map((res) => res.data || []),
        tap({
          next: (msgs) => {
            this.messages.set(msgs);
            this.isLoadingMessages.set(false);
          },
          error: () => this.isLoadingMessages.set(false),
        })
      );
  }

  sendMessage(conversationId: string, content: string): Observable<RfChatMessage> {
    this.isSending.set(true);
    return this.http
      .post<ApiResponse<RfChatMessage>>(`${this.baseUrl}/conversations/${conversationId}/messages`, { content })
      .pipe(
        map((res) => res.data),
        tap({
          next: (msg) => {
            this.messages.update((list) => [...list, msg]);
            this.conversations.update((list) =>
              list.map((c) =>
                c.id === conversationId ? { ...c, lastMessage: msg, lastMessageAt: msg.createdAt } : c
              )
            );
            this.isSending.set(false);
          },
          error: () => this.isSending.set(false),
        })
      );
  }

  markAsRead(conversationId: string): Observable<void> {
    this.conversations.update((list) =>
      list.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
    );
    return this.http
      .post<ApiResponse<void>>(`${this.baseUrl}/conversations/${conversationId}/read`, {})
      .pipe(map(() => void 0));
  }
}
