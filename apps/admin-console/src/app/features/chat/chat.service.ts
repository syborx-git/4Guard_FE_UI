import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subscription, tap, map } from 'rxjs';
import { StompClientService } from '@4guard/shared-core';
import {
  ApiResponse,
  ChatMessage,
  ChatUser,
  ConversationSummary,
  NotificationPref,
} from './chat.models';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly stompService = inject(StompClientService);
  private readonly baseUrl = '/api/v1/chat';

  // Estado reactivo con Signals (ADR-006)
  readonly conversations = signal<ConversationSummary[]>([]);
  readonly activeConversationId = signal<string | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly users = signal<ChatUser[]>([]);
  readonly isLoadingConversations = signal<boolean>(false);
  readonly isLoadingMessages = signal<boolean>(false);
  readonly isDrawerOpen = signal<boolean>(false);
  readonly hasMoreMessages = signal<boolean>(false);
  readonly typingUser = signal<string | null>(null);
  readonly latestIncomingAlert = signal<{ conversationId: string; senderName: string; preview: string } | null>(null);

  private pollingId: any = null;
  private userQueueSub: Subscription | null = null;
  private activeTopicSub: Subscription | null = null;
  private typingTimeout: any = null;
  private alertTimeout: any = null;

  readonly activeConversation = computed<ConversationSummary | null>(() => {
    const id = this.activeConversationId();
    return this.conversations().find((c) => c.id === id) ?? null;
  });

  readonly totalUnreadCount = computed<number>(() =>
    this.conversations().reduce((sum, c) => sum + (c.unreadCount || 0), 0)
  );

  openDrawer(): void {
    this.isDrawerOpen.set(true);
    this.loadConversations().subscribe();
    this.loadUsers().subscribe();
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
  }

  toggleDrawer(): void {
    if (this.isDrawerOpen()) {
      this.closeDrawer();
    } else {
      this.openDrawer();
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
      if (activeId && (this.isDrawerOpen() || window.location.pathname.includes('/chat'))) {
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
          if (evt.eventType === 'MESSAGE_CREATED' && !this.isDrawerOpen() && evt.payload) {
            const msg = evt.payload as ChatMessage;
            this.latestIncomingAlert.set({
              conversationId: evt.conversationId || msg.conversationId,
              senderName: msg.senderFullName || evt.senderUsername || 'Nuevo mensaje',
              preview: msg.content || 'Archivo adjunto',
            });
            clearTimeout(this.alertTimeout);
            this.alertTimeout = setTimeout(() => this.latestIncomingAlert.set(null), 5000);
          }
        },
        error: () => {},
      });
    } catch {
      // Fallback silencioso a polling si STOMP aún no está conectado
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
          if (evt.eventType === 'TYPING') {
            const name = evt.payload?.fullName || evt.senderUsername || 'Alguien';
            this.typingUser.set(name);
            clearTimeout(this.typingTimeout);
            this.typingTimeout = setTimeout(() => this.typingUser.set(null), 3500);
            return;
          }

          const payload = evt.payload as ChatMessage;
          if (!payload?.id) return;

          if (evt.eventType === 'MESSAGE_CREATED') {
            this.typingUser.set(null);
            this.messages.update((list) =>
              list.some((m) => m.id === payload.id) ? list : [...list, payload]
            );
            this.markAsRead(conversationId).subscribe({ error: () => {} });
          } else if (
            evt.eventType === 'MESSAGE_UPDATED' ||
            evt.eventType === 'MESSAGE_DELETED' ||
            evt.eventType === 'REACTION_UPDATED'
          ) {
            this.messages.update((list) => list.map((m) => (m.id === payload.id ? payload : m)));
          }
        },
        error: () => {},
      });
    } catch {
      // Fallback silencioso a polling
    }
  }

  loadUsers(branchId?: string): Observable<ChatUser[]> {
    let params = new HttpParams();
    if (branchId) params = params.set('branchId', branchId);
    return this.http.get<ApiResponse<ChatUser[]>>(`${this.baseUrl}/users`, { params }).pipe(
      map((res) => res.data || []),
      tap((list) => this.users.set(list))
    );
  }

  loadConversations(): Observable<ConversationSummary[]> {
    this.isLoadingConversations.set(true);
    return this.http.get<ApiResponse<ConversationSummary[]>>(`${this.baseUrl}/conversations`).pipe(
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

  selectConversation(conversationId: string): void {
    this.activeConversationId.set(conversationId);
    this.subscribeToConversationTopic(conversationId);
    this.loadMessages(conversationId).subscribe();
    this.markAsRead(conversationId).subscribe();
  }

  startDirectMessage(targetUserId: string): Observable<ConversationSummary> {
    return this.http
      .post<ApiResponse<ConversationSummary>>(`${this.baseUrl}/conversations/dm`, { targetUserId })
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

  createSpace(payload: { name: string; description?: string; icon?: string; memberIds?: string[] }): Observable<ConversationSummary> {
    return this.http
      .post<ApiResponse<ConversationSummary>>(`${this.baseUrl}/conversations/space`, payload)
      .pipe(
        map((res) => res.data),
        tap((conv) => {
          this.conversations.update((list) => [conv, ...list]);
          this.selectConversation(conv.id);
        })
      );
  }

  loadMessages(conversationId: string, before?: string, limit = 40): Observable<ChatMessage[]> {
    this.isLoadingMessages.set(true);
    let params = new HttpParams().set('limit', limit);
    if (before) params = params.set('before', before);

    return this.http
      .get<ApiResponse<ChatMessage[]>>(`${this.baseUrl}/conversations/${conversationId}/messages`, { params })
      .pipe(
        map((res) => res.data || []),
        tap({
          next: (msgs) => {
            if (before) {
              this.messages.update((curr) => {
                const existing = new Set(curr.map((m) => m.id));
                const older = msgs.filter((m) => !existing.has(m.id));
                return [...older, ...curr];
              });
            } else {
              this.messages.set(msgs);
            }
            this.hasMoreMessages.set(msgs.length >= limit);
            this.isLoadingMessages.set(false);
          },
          error: () => this.isLoadingMessages.set(false),
        })
      );
  }

  loadOlderMessages(conversationId: string): void {
    const first = this.messages()[0];
    if (!first || this.isLoadingMessages()) return;
    this.loadMessages(conversationId, first.createdAt, 40).subscribe({ error: () => {} });
  }

  sendTyping(conversationId: string): void {
    this.http.post<ApiResponse<void>>(`${this.baseUrl}/conversations/${conversationId}/typing`, {}).subscribe({ error: () => {} });
  }

  sendMessage(
    conversationId: string,
    content: string,
    attachments?: Array<{ fileName: string; contentType: string; fileSize: number; storageUrl: string }>
  ): Observable<ChatMessage> {
    return this.http
      .post<ApiResponse<ChatMessage>>(`${this.baseUrl}/conversations/${conversationId}/messages`, {
        content,
        attachments: attachments && attachments.length > 0 ? attachments : undefined,
      })
      .pipe(
        map((res) => res.data),
        tap((msg) => {
          this.messages.update((list) => [...list, msg]);
          this.conversations.update((list) =>
            list.map((c) =>
              c.id === conversationId ? { ...c, lastMessage: msg, lastMessageAt: msg.createdAt } : c
            )
          );
        })
      );
  }

  editMessage(messageId: string, content: string): Observable<ChatMessage> {
    return this.http
      .put<ApiResponse<ChatMessage>>(`${this.baseUrl}/messages/${messageId}`, { content })
      .pipe(
        map((res) => res.data),
        tap((updated) => {
          this.messages.update((list) => list.map((m) => (m.id === updated.id ? updated : m)));
        })
      );
  }

  deleteMessage(messageId: string): Observable<ChatMessage> {
    return this.http.delete<ApiResponse<ChatMessage>>(`${this.baseUrl}/messages/${messageId}`).pipe(
      map((res) => res.data),
      tap((updated) => {
        this.messages.update((list) => list.map((m) => (m.id === updated.id ? updated : m)));
      })
    );
  }

  toggleReaction(messageId: string, emoji: string): Observable<ChatMessage> {
    return this.http
      .post<ApiResponse<ChatMessage>>(`${this.baseUrl}/messages/${messageId}/reactions`, { emoji })
      .pipe(
        map((res) => res.data),
        tap((updated) => {
          this.messages.update((list) => list.map((m) => (m.id === updated.id ? updated : m)));
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

  updateNotificationPref(conversationId: string, notificationPref: NotificationPref): Observable<void> {
    return this.http
      .put<ApiResponse<void>>(`${this.baseUrl}/conversations/${conversationId}/notifications`, {
        notificationPref,
      })
      .pipe(
        map(() => void 0),
        tap(() => {
          this.conversations.update((list) =>
            list.map((c) => (c.id === conversationId ? { ...c, myNotificationPref: notificationPref } : c))
          );
        })
      );
  }
}
