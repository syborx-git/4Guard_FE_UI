import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../chat.service';
import { AuthState } from '../../../core/auth/auth.state';
import { ChatMessage, ConversationSummary } from '../chat.models';

@Component({
  selector: 'fg-enterprise-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './enterprise-chat.component.html',
  styleUrl: './enterprise-chat.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnterpriseChatComponent implements OnInit {
  @Input() mode: 'fullscreen' | 'drawer' = 'fullscreen';
  @Output() closeRequested = new EventEmitter<void>();

  protected readonly chatService = inject(ChatService);
  protected readonly authState = inject(AuthState);

  protected readonly searchQuery = signal<string>('');
  protected readonly activeFilter = signal<'ALL' | 'UNREAD' | 'SPACE' | 'DM'>('ALL');
  protected readonly messageText = signal<string>('');
  protected readonly showNewSpaceModal = signal<boolean>(false);
  protected readonly newSpaceName = signal<string>('');
  protected readonly newSpaceDesc = signal<string>('');
  protected readonly editingMessageId = signal<string | null>(null);
  protected readonly editingContent = signal<string>('');
  protected readonly mobileShowThread = signal<boolean>(false);
  protected readonly pendingAttachments = signal<
    Array<{ fileName: string; contentType: string; fileSize: number; storageUrl: string }>
  >([]);
  protected readonly mentionQuery = signal<string | null>(null);

  private lastTypingSentAt = 0;

  protected readonly quickEmojis = ['👍', '✅', '👀', '🚚', '⚠️'];

  protected readonly mentionCandidates = computed(() => {
    const q = this.mentionQuery();
    if (q === null) return [];
    const term = q.toLowerCase();
    return this.chatService
      .users()
      .filter((u) => !term || u.username.toLowerCase().includes(term) || u.fullName.toLowerCase().includes(term))
      .slice(0, 5);
  });

  protected readonly currentUserId = computed(() => this.authState.currentUser()?.id ?? '');
  protected readonly currentUserName = computed(() => {
    const u = this.authState.currentUser();
    return u?.fullName || u?.username || 'Colaborador';
  });
  protected readonly canCreateSpace = computed(() => {
    const role = (this.authState.currentUser()?.role || '').toUpperCase();
    return role.includes('ADMIN') || role.includes('SUPERVISOR') || role.includes('GERENTE') || role.includes('DIRECTOR');
  });

  protected readonly directMessages = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const filter = this.activeFilter();
    if (filter === 'SPACE') return [];
    return this.chatService.conversations()
      .filter((c) => c.type === 'DM')
      .filter((c) => filter !== 'UNREAD' || (c.unreadCount || 0) > 0)
      .filter((c) => !q || c.name.toLowerCase().includes(q));
  });

  protected readonly spaces = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const filter = this.activeFilter();
    if (filter === 'DM') return [];
    return this.chatService.conversations()
      .filter((c) => c.type === 'SPACE' || c.type === 'THREAD')
      .filter((c) => filter !== 'UNREAD' || (c.unreadCount || 0) > 0)
      .filter((c) => !q || c.name.toLowerCase().includes(q));
  });

  protected readonly filteredDirectoryUsers = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.chatService.users().slice(0, 8);
    return this.chatService.users().filter(
      (u) => u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.chatService.loadConversations().subscribe();
    this.chatService.loadUsers().subscribe();
    this.chatService.startPolling();
  }

  onSelectConversation(conv: ConversationSummary): void {
    this.chatService.selectConversation(conv.id);
    this.mobileShowThread.set(true);
  }

  onBackToListMobile(): void {
    this.mobileShowThread.set(false);
  }

  onLogout(): void {
    this.authState.logout();
  }

  onStartDm(userId: string): void {
    this.chatService.startDirectMessage(userId).subscribe(() => {
      this.searchQuery.set('');
      this.mobileShowThread.set(true);
    });
  }

  onSendMessage(): void {
    const convId = this.chatService.activeConversationId();
    const text = this.messageText().trim();
    const attachments = this.pendingAttachments();
    if (!convId || (!text && attachments.length === 0)) return;

    const finalContent = text || `📎 ${attachments.map((a) => a.fileName).join(', ')}`;
    this.messageText.set('');
    this.mentionQuery.set(null);
    this.pendingAttachments.set([]);
    this.chatService.sendMessage(convId, finalContent, attachments).subscribe();
  }

  onComposerInput(value: string): void {
    this.messageText.set(value);

    // Detectar @mención activa al final del texto
    const match = value.match(/(?:^|\s)@([a-zA-Z0-9._-]*)$/);
    this.mentionQuery.set(match ? match[1] : null);

    // Enviar evento TYPING con throttle de 2.5s
    const convId = this.chatService.activeConversationId();
    const now = Date.now();
    if (convId && value.trim() && now - this.lastTypingSentAt > 2500) {
      this.lastTypingSentAt = now;
      this.chatService.sendTyping(convId);
    }
  }

  insertMention(username: string): void {
    const current = this.messageText();
    const updated = current.replace(/(?:^|\s)@([a-zA-Z0-9._-]*)$/, (full) => {
      const prefix = full.startsWith(' ') ? ' ' : '';
      return `${prefix}@${username} `;
    });
    this.messageText.set(updated);
    this.mentionQuery.set(null);
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    Array.from(input.files).forEach((file) => {
      if (file.size > 2 * 1024 * 1024) return; // Máximo 2MB por archivo
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (!result) return;
        this.pendingAttachments.update((list) => [
          ...list,
          {
            fileName: file.name,
            contentType: file.type || 'application/octet-stream',
            fileSize: file.size,
            storageUrl: result,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
    input.value = '';
  }

  removePendingAttachment(index: number): void {
    this.pendingAttachments.update((list) => list.filter((_, i) => i !== index));
  }

  cycleNotificationPref(conv: ConversationSummary): void {
    const order: Array<'ALL' | 'MENTIONS' | 'MUTED'> = ['ALL', 'MENTIONS', 'MUTED'];
    const idx = order.indexOf(conv.myNotificationPref || 'ALL');
    const next = order[(idx + 1) % order.length];
    this.chatService.updateNotificationPref(conv.id, next).subscribe();
  }

  parseMessageParts(content: string): Array<{ text: string; kind: 'text' | 'mention' | 'folio' }> {
    if (!content) return [];
    const parts = content.split(/(@[a-zA-Z0-9._-]+|#\d{3,10})/g);
    return parts
      .filter((p) => p.length > 0)
      .map((p) => {
        if (p.startsWith('@')) return { text: p, kind: 'mention' as const };
        if (/^#\d{3,10}$/.test(p)) return { text: p, kind: 'folio' as const };
        return { text: p, kind: 'text' as const };
      });
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSendMessage();
    }
  }

  onStartEdit(msg: ChatMessage): void {
    this.editingMessageId.set(msg.id);
    this.editingContent.set(msg.content);
  }

  onSaveEdit(messageId: string): void {
    const text = this.editingContent().trim();
    if (!text) return;
    this.chatService.editMessage(messageId, text).subscribe(() => {
      this.editingMessageId.set(null);
      this.editingContent.set('');
    });
  }

  onCancelEdit(): void {
    this.editingMessageId.set(null);
    this.editingContent.set('');
  }

  onDeleteMessage(messageId: string): void {
    this.chatService.deleteMessage(messageId).subscribe();
  }

  onToggleReaction(messageId: string, emoji: string): void {
    this.chatService.toggleReaction(messageId, emoji).subscribe();
  }

  onCreateSpace(): void {
    const name = this.newSpaceName().trim();
    if (!name) return;
    this.chatService
      .createSpace({
        name,
        description: this.newSpaceDesc().trim() || undefined,
      })
      .subscribe(() => {
        this.newSpaceName.set('');
        this.newSpaceDesc.set('');
        this.showNewSpaceModal.set(false);
        this.mobileShowThread.set(true);
      });
  }
}
