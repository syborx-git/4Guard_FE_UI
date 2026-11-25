/**
 * @file rf-chat-modal.component.ts
 * @description Modal Táctil de Mensajería Empresarial 4GUARD para Terminal RF.
 * Optimizado para tablets industriales con soporte dual de tema claro/oscuro.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ElementRef,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthState } from '@4guard/shared-core';
import {
  RfChatService,
  RfChatConversation,
  RfChatMessage,
  RfChatUser,
} from '../../../core/services/rf-chat.service';

export type RfChatTab = 'all' | 'spaces' | 'dms' | 'users';

@Component({
  selector: 'fg-rf-chat-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rf-chat-modal.component.html',
  styleUrl: './rf-chat-modal.component.css',
})
export class RfChatModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();

  @ViewChild('chatScrollContainer') private chatScrollContainer?: ElementRef<HTMLElement>;

  protected readonly rfChat = inject(RfChatService);
  protected readonly authState = inject(AuthState);

  protected readonly activeTab = signal<RfChatTab>('all');
  protected readonly searchQuery = signal<string>('');
  protected readonly messageDraft = signal<string>('');

  protected readonly currentUserId = computed(() => this.authState.user()?.id ?? '');
  protected readonly currentUsername = computed(() => {
    const u = this.authState.user() as { username?: string; email?: string } | null;
    return u?.username || (u?.email ? u.email.split('@')[0] : '');
  });

  protected readonly filteredSpaces = computed<RfChatConversation[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.rfChat.spaces();
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q));
  });

  protected readonly filteredDms = computed<RfChatConversation[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.rfChat.directMessages();
    if (!q) return list;
    return list.filter((c) => this.getConversationDisplayName(c).toLowerCase().includes(q));
  });

  protected readonly filteredUsers = computed<RfChatUser[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const myId = this.currentUserId();
    const list = this.rfChat.users().filter((u) => u.active && u.id !== myId);
    if (!q) return list;
    return list.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.roleName && u.roleName.toLowerCase().includes(q))
    );
  });

  constructor() {
    effect(() => {
      const msgs = this.rfChat.messages();
      if (this.isOpen && this.rfChat.activeConversation() && msgs.length > 0) {
        setTimeout(() => this.scrollToBottom(), 60);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      this.rfChat.setModalOpen(this.isOpen);
      if (this.isOpen && this.rfChat.activeConversation()) {
        setTimeout(() => this.scrollToBottom(), 80);
      }
    }
  }

  onClose(): void {
    this.closeModal.emit();
  }

  setTab(tab: RfChatTab): void {
    this.activeTab.set(tab);
  }

  openConversation(conv: RfChatConversation): void {
    this.rfChat.selectConversation(conv.id);
    setTimeout(() => this.scrollToBottom(), 100);
  }

  startDmWithUser(user: RfChatUser): void {
    this.rfChat.startDirectMessage(user.id).subscribe({
      next: () => setTimeout(() => this.scrollToBottom(), 100),
      error: () => {},
    });
  }

  goBackToList(): void {
    this.rfChat.clearActiveConversation();
    this.rfChat.loadConversations().subscribe({ error: () => {} });
  }

  onSendMessage(): void {
    const conv = this.rfChat.activeConversation();
    const content = this.messageDraft().trim();
    if (!conv || !content || this.rfChat.isSending()) return;

    this.messageDraft.set('');
    this.rfChat.sendMessage(conv.id, content).subscribe({
      next: () => setTimeout(() => this.scrollToBottom(), 60),
      error: () => {
        this.messageDraft.set(content);
      },
    });
  }

  isOwnMessage(msg: RfChatMessage): boolean {
    const myId = this.currentUserId();
    const myUsername = this.currentUsername();
    if (myId && msg.senderId === myId) return true;
    if (myUsername && msg.senderUsername === myUsername) return true;
    return false;
  }

  getConversationDisplayName(conv: RfChatConversation): string {
    if (conv.type !== 'DM') return conv.name;
    const myId = this.currentUserId();
    const other = conv.participants?.find((p) => p.userId !== myId);
    return other?.fullName || conv.name || 'Mensaje Directo';
  }

  getInitials(name: string): string {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '4G';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  formatTime(isoDate?: string | null): string {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  private scrollToBottom(): void {
    const el = this.chatScrollContainer?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
