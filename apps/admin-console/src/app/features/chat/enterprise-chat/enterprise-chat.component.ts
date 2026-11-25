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
  protected readonly messageText = signal<string>('');
  protected readonly showNewSpaceModal = signal<boolean>(false);
  protected readonly newSpaceName = signal<string>('');
  protected readonly newSpaceDesc = signal<string>('');
  protected readonly editingMessageId = signal<string | null>(null);
  protected readonly editingContent = signal<string>('');
  protected readonly mobileShowThread = signal<boolean>(false);

  protected readonly quickEmojis = ['👍', '✅', '👀', '🚚', '⚠️'];

  protected readonly currentUserId = computed(() => this.authState.currentUser()?.id ?? '');
  protected readonly canCreateSpace = computed(() => {
    const role = (this.authState.currentUser()?.role || '').toUpperCase();
    return role.includes('ADMIN') || role.includes('SUPERVISOR') || role.includes('GERENTE') || role.includes('DIRECTOR');
  });

  protected readonly directMessages = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    return this.chatService.conversations()
      .filter((c) => c.type === 'DM')
      .filter((c) => !q || c.name.toLowerCase().includes(q));
  });

  protected readonly spaces = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    return this.chatService.conversations()
      .filter((c) => c.type === 'SPACE' || c.type === 'THREAD')
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

  onStartDm(userId: string): void {
    this.chatService.startDirectMessage(userId).subscribe(() => {
      this.searchQuery.set('');
      this.mobileShowThread.set(true);
    });
  }

  onSendMessage(): void {
    const convId = this.chatService.activeConversationId();
    const text = this.messageText().trim();
    if (!convId || !text) return;

    this.messageText.set('');
    this.chatService.sendMessage(convId, text).subscribe();
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
