import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subscription, tap, map } from 'rxjs';
import { StompClientService } from '@4guard/shared-core';
import { environment } from '../../../environments/environment';
import { AuthState } from '../../core/auth/auth.state';
import {
  ApiResponse,
  ChatAttachment,
  ChatMessage,
  ChatUser,
  ConversationSummary,
  NotificationPref,
} from './chat.models';

const CHAT_SOUND_STORAGE_KEY = '4guard_chat_sound';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly stompService = inject(StompClientService);
  private readonly authState = inject(AuthState);
  private readonly baseUrl = `${environment.apiBaseUrl || ''}/api/v1/chat`;

  // Estado reactivo con Signals (ADR-006)
  readonly conversations = signal<ConversationSummary[]>([]);
  readonly activeConversationId = signal<string | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly pinnedMessages = signal<ChatMessage[]>([]);
  readonly users = signal<ChatUser[]>([]);
  readonly loadError = signal<string | null>(null);
  readonly isLoadingConversations = signal<boolean>(false);
  readonly isLoadingMessages = signal<boolean>(false);
  readonly isDrawerOpen = signal<boolean>(false);
  readonly hasMoreMessages = signal<boolean>(false);
  readonly typingUser = signal<string | null>(null);
  readonly latestIncomingAlert = signal<{ conversationId: string; senderName: string; preview: string } | null>(null);
  readonly soundEnabled = signal<boolean>(this.readSoundPref());

  private pollingId: any = null;
  private userQueueSub: Subscription | null = null;
  private activeTopicSub: Subscription | null = null;
  private typingTimeout: any = null;
  private alertTimeout: any = null;
  private audioCtx: AudioContext | null = null;

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
    this.stompService.ensureConnected();
    this.initStompUserQueue();
    if (this.pollingId || typeof window === 'undefined') return;
    this.loadConversations().subscribe({ error: () => {} });
    this.pollingId = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      this.loadConversations().subscribe({ error: () => {} });
      const activeId = this.activeConversationId();
      if (this.isDrawerOpen() || window.location.pathname.includes('/chat')) {
        this.loadUsers().subscribe({ error: () => {} });
        if (activeId) {
          this.loadMessages(activeId).subscribe({ error: () => {} });
        }
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

  private readSoundPref(): boolean {
    if (typeof window === 'undefined') return true;
    try {
      const stored = window.localStorage.getItem(CHAT_SOUND_STORAGE_KEY);
      return stored === null ? true : stored !== 'false';
    } catch {
      return true;
    }
  }

  toggleSound(): void {
    const next = !this.soundEnabled();
    this.soundEnabled.set(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(CHAT_SOUND_STORAGE_KEY, String(next));
      } catch {
        // Ignorar errores de almacenamiento privado
      }
    }
    if (next) {
      this.requestNotificationPermission();
    }
  }

  requestNotificationPermission(): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      try {
        Notification.requestPermission().catch(() => {});
      } catch {
        // Ignorar navegadores que no devuelven Promise
      }
    }
  }

  private playIncomingChime(): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1174.66, now + 0.09);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.075, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // Ignorar restricciones de autoplay o falta de soporte de Web Audio
    }
  }

  private handleIncomingNotification(evt: any, msg: ChatMessage): void {
    const currentUser = this.authState.currentUser();
    const isFromMe =
      (!!currentUser?.id && msg.senderId === currentUser.id) ||
      (!!currentUser?.username &&
        (msg.senderUsername === currentUser.username || evt.senderUsername === currentUser.username));
    if (isFromMe) return;

    const convId = evt.conversationId || msg.conversationId;
    const conv = this.conversations().find((c) => c.id === convId);
    const pref: NotificationPref = conv?.myNotificationPref || 'ALL';
    if (pref === 'MUTED') return;

    if (pref === 'MENTIONS') {
      const uname = currentUser?.username?.trim();
      if (!uname) return;
      const escaped = uname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const mentionRe = new RegExp(`@${escaped}(?:\\b|$)`, 'i');
      if (!mentionRe.test(msg.content || '')) return;
    }

    if (this.soundEnabled()) {
      this.playIncomingChime();
    }

    const isHiddenOrClosed = (typeof document !== 'undefined' && document.hidden) || !this.isDrawerOpen();
    if (
      isHiddenOrClosed &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification(msg.senderFullName || evt.senderUsername || '4GUARD Chat', {
          body: msg.content || 'Archivo adjunto',
          tag: `4guard-chat-${convId || msg.id}`,
        });
      } catch {
        // Ignorar errores de notificación nativa
      }
    }
  }

  private syncPinnedMessage(msg: ChatMessage): void {
    this.pinnedMessages.update((list) => {
      const filtered = list.filter((m) => m.id !== msg.id);
      if (msg.isPinned && !msg.isDeleted) {
        return [msg, ...filtered];
      }
      return filtered;
    });
  }

  private initStompUserQueue(): void {
    if (this.userQueueSub || typeof window === 'undefined') return;
    try {
      this.userQueueSub = this.stompService.watchUserQueue<any>('chat').subscribe({
        next: (evt: any) => {
          if (!evt) return;
          this.loadConversations().subscribe({ error: () => {} });
          if (evt.eventType === 'MESSAGE_CREATED' && evt.payload) {
            const msg = evt.payload as ChatMessage;
            this.handleIncomingNotification(evt, msg);
            if (!this.isDrawerOpen()) {
              this.latestIncomingAlert.set({
                conversationId: evt.conversationId || msg.conversationId,
                senderName: msg.senderFullName || evt.senderUsername || 'Nuevo mensaje',
                preview: msg.content || 'Archivo adjunto',
              });
              clearTimeout(this.alertTimeout);
              this.alertTimeout = setTimeout(() => this.latestIncomingAlert.set(null), 5000);
            }
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
            const me = this.authState.currentUser();
            if (
              evt.senderId === me?.id ||
              evt.payload?.userId === me?.id ||
              (me?.username &&
                (evt.senderUsername === me.username || evt.payload?.username === me.username))
            ) {
              return;
            }
            const name = evt.payload?.fullName || evt.senderUsername || 'Alguien';
            this.typingUser.set(name);
            clearTimeout(this.typingTimeout);
            this.typingTimeout = setTimeout(() => this.typingUser.set(null), 3500);
            return;
          }

          if (evt.eventType === 'CONVERSATION_READ') {
            const readerId = evt.payload?.userId || evt.senderId;
            const readAt = evt.payload?.lastReadAt || evt.timestamp;
            if (readerId && readAt) {
              this.conversations.update((list) =>
                list.map((c) =>
                  c.id === conversationId
                    ? {
                        ...c,
                        participants: c.participants.map((p) =>
                          p.userId === readerId ? { ...p, lastReadAt: readAt } : p
                        ),
                      }
                    : c
                )
              );
            }
            return;
          }

          const payload = evt.payload as ChatMessage;
          if (!payload?.id) return;

          if (evt.eventType === 'MESSAGE_CREATED') {
            this.typingUser.set(null);
            this.messages.update((list) =>
              list.some((m) => m.id === payload.id) ? list : [...list, payload]
            );
            if (payload.senderId !== this.authState.currentUser()?.id) {
              this.markAsRead(conversationId).subscribe({ error: () => {} });
            }
          } else if (evt.eventType === 'MESSAGE_PINNED') {
            this.messages.update((list) => list.map((m) => (m.id === payload.id ? payload : m)));
            this.syncPinnedMessage(payload);
          } else if (
            evt.eventType === 'MESSAGE_UPDATED' ||
            evt.eventType === 'MESSAGE_DELETED' ||
            evt.eventType === 'REACTION_UPDATED'
          ) {
            this.messages.update((list) => list.map((m) => (m.id === payload.id ? payload : m)));
            if (evt.eventType === 'MESSAGE_DELETED') {
              this.syncPinnedMessage({ ...payload, isPinned: false });
            }
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
      tap({
        next: (list) => {
          this.users.set(list);
          this.loadError.set(null);
        },
        error: () => {
          this.loadError.set('No se pudo cargar el directorio (verifica que el backend esté en línea).');
        },
      })
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
    this.typingUser.set(null);
    clearTimeout(this.typingTimeout);
    this.activeConversationId.set(conversationId);
    this.pinnedMessages.set([]);
    this.subscribeToConversationTopic(conversationId);
    this.loadMessages(conversationId).subscribe();
    this.loadPinnedMessages(conversationId).subscribe({ error: () => {} });
    this.markAsRead(conversationId).subscribe();
  }

  loadPinnedMessages(conversationId: string): Observable<ChatMessage[]> {
    return this.http
      .get<ApiResponse<ChatMessage[]>>(`${this.baseUrl}/conversations/${conversationId}/pinned`)
      .pipe(
        map((res) => res.data || []),
        tap({
          next: (list) => {
            if (this.activeConversationId() === conversationId) {
              this.pinnedMessages.set(list);
            }
          },
          error: () => {
            if (this.activeConversationId() === conversationId) {
              this.pinnedMessages.set([]);
            }
          },
        })
      );
  }

  togglePinMessage(messageId: string, pinned?: boolean): Observable<ChatMessage> {
    return this.http
      .put<ApiResponse<ChatMessage>>(`${this.baseUrl}/messages/${messageId}/pin`, { pinned })
      .pipe(
        map((res) => res.data),
        tap((updated) => {
          this.messages.update((list) => list.map((m) => (m.id === updated.id ? updated : m)));
          this.syncPinnedMessage(updated);
        })
      );
  }

  searchConversationMessages(conversationId: string, q: string): Observable<ChatMessage[]> {
    const params = new HttpParams().set('q', q);
    return this.http
      .get<ApiResponse<ChatMessage[]>>(`${this.baseUrl}/conversations/${conversationId}/messages/search`, { params })
      .pipe(map((res) => res.data || []));
  }

  loadConversationEvidence(conversationId: string): Observable<ChatAttachment[]> {
    return this.http
      .get<ApiResponse<any[]>>(`${this.baseUrl}/conversations/${conversationId}/evidence`)
      .pipe(
        map((res) => {
          const items = res.data || [];
          const result: ChatAttachment[] = [];
          for (const item of items) {
            if (item && Array.isArray(item.attachments)) {
              for (const att of item.attachments) {
                if (att && att.storageUrl) result.push(att as ChatAttachment);
              }
            } else if (item && item.storageUrl) {
              result.push(item as ChatAttachment);
            }
          }
          return result;
        })
      );
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

  createSpace(payload: { name: string; description?: string; icon?: string; category?: string; memberIds?: string[] }): Observable<ConversationSummary> {
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

  updateSpaceMembers(conversationId: string, memberIds: string[]): Observable<ConversationSummary> {
    return this.http
      .put<ApiResponse<ConversationSummary>>(`${this.baseUrl}/conversations/${conversationId}/members`, { memberIds })
      .pipe(
        map((res) => res.data),
        tap((conv) => {
          this.conversations.update((list) => list.map((c) => (c.id === conv.id ? conv : c)));
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
    attachments?: Array<{ fileName: string; contentType: string; fileSize: number; storageUrl: string }>,
    parentMessageId?: string
  ): Observable<ChatMessage> {
    return this.http
      .post<ApiResponse<ChatMessage>>(`${this.baseUrl}/conversations/${conversationId}/messages`, {
        content,
        attachments: attachments && attachments.length > 0 ? attachments : undefined,
        parentMessageId: parentMessageId || undefined,
      })
      .pipe(
        map((res) => res.data),
        tap((msg) => {
          this.messages.update((list) =>
            list.some((m) => m.id === msg.id) ? list : [...list, msg]
          );
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
