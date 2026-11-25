import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ChatService } from '../chat.service';
import { AuthState } from '../../../core/auth/auth.state';
import { ChatAttachment, ChatMessage, ConversationSummary } from '../chat.models';

@Component({
  selector: 'fg-enterprise-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './enterprise-chat.component.html',
  styleUrl: './enterprise-chat.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnterpriseChatComponent implements OnInit, OnDestroy {
  @ViewChild('cameraVideo') cameraVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('cameraFallbackInput') cameraFallbackInputRef?: ElementRef<HTMLInputElement>;
  @Input() mode: 'fullscreen' | 'drawer' = 'fullscreen';
  @Input() isExpanded = false;
  @Output() closeRequested = new EventEmitter<void>();
  @Output() toggleExpandRequested = new EventEmitter<void>();

  protected readonly chatService = inject(ChatService);
  protected readonly authState = inject(AuthState);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly isAttachMenuOpen = signal<boolean>(false);
  protected readonly previewAttachment = signal<ChatAttachment | null>(null);
  protected readonly isCameraModalOpen = signal<boolean>(false);
  protected readonly cameraError = signal<string | null>(null);
  protected readonly isCameraReady = signal<boolean>(false);
  private cameraStream: MediaStream | null = null;

  protected readonly searchQuery = signal<string>('');
  protected readonly activeFilter = signal<'ALL' | 'UNREAD' | 'SPACE' | 'DM'>('ALL');
  protected readonly messageText = signal<string>('');
  protected readonly showNewSpaceModal = signal<boolean>(false);
  protected readonly newSpaceName = signal<string>('');
  protected readonly newSpaceDesc = signal<string>('');
  protected readonly newSpaceCategory = signal<string>('');
  protected readonly newSpaceMemberIds = signal<string[]>([]);
  protected readonly newSpaceMemberSearch = signal<string>('');
  protected readonly showManageMembersModal = signal<boolean>(false);
  protected readonly manageMemberIds = signal<string[]>([]);
  protected readonly manageMemberSearch = signal<string>('');
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
  protected readonly isManagerOrDirector = computed(() => {
    const role = (this.authState.currentUser()?.role || '').toUpperCase();
    return (
      role.includes('CEO') ||
      role.includes('DIRECTOR') ||
      role.includes('GERENTE') ||
      role.includes('OPERATIONS_MANAGER') ||
      role.includes('ADMIN')
    );
  });

  protected readonly canCreateSpace = this.isManagerOrDirector;
  protected readonly canDownloadAttachments = this.isManagerOrDirector;

  protected readonly safePreviewUrl = computed<SafeResourceUrl | null>(() => {
    const att = this.previewAttachment();
    if (!att) return null;
    const url = att.contentType.includes('pdf') && !this.canDownloadAttachments()
      ? `${att.storageUrl}#toolbar=0&navpanes=0`
      : att.storageUrl;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
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
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.category || '').toLowerCase().includes(q));
  });

  protected readonly existingSpaceCategories = computed<string[]>(() => {
    const set = new Set<string>();
    for (const c of this.chatService.conversations()) {
      const cat = c.category?.trim();
      if ((c.type === 'SPACE' || c.type === 'THREAD') && cat) set.add(cat);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

  protected readonly groupedSpaces = computed<Array<{ category: string; items: ConversationSummary[] }>>(() => {
    const map = new Map<string, ConversationSummary[]>();
    for (const s of this.spaces()) {
      const cat = s.category?.trim() || 'General';
      const bucket = map.get(cat) ?? [];
      bucket.push(s);
      map.set(cat, bucket);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => {
        if (a === 'General') return 1;
        if (b === 'General') return -1;
        return a.localeCompare(b);
      })
      .map(([category, items]) => ({ category, items }));
  });

  protected readonly createSpaceMemberCandidates = computed(() =>
    this.filterUsersByQuery(this.newSpaceMemberSearch())
  );

  protected readonly manageMemberCandidates = computed(() =>
    this.filterUsersByQuery(this.manageMemberSearch())
  );

  private filterUsersByQuery(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return this.chatService.users();
    return this.chatService.users().filter(
      (u) => u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.roleName.toLowerCase().includes(q)
    );
  }

  protected readonly filteredDirectoryUsers = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.chatService.users();
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
    this.isAttachMenuOpen.set(false);
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

  openCreateSpaceModal(): void {
    this.newSpaceName.set('');
    this.newSpaceDesc.set('');
    this.newSpaceCategory.set('');
    this.newSpaceMemberIds.set([]);
    this.newSpaceMemberSearch.set('');
    this.showNewSpaceModal.set(true);
  }

  toggleNewSpaceMember(userId: string): void {
    this.newSpaceMemberIds.update((ids) =>
      ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]
    );
  }

  onCreateSpace(): void {
    const name = this.newSpaceName().trim();
    if (!name) return;
    const category = this.newSpaceCategory().trim();
    this.chatService
      .createSpace({
        name,
        description: this.newSpaceDesc().trim() || undefined,
        category: category || undefined,
        memberIds: this.newSpaceMemberIds(),
      })
      .subscribe(() => {
        this.newSpaceName.set('');
        this.newSpaceDesc.set('');
        this.newSpaceCategory.set('');
        this.newSpaceMemberIds.set([]);
        this.newSpaceMemberSearch.set('');
        this.showNewSpaceModal.set(false);
        this.mobileShowThread.set(true);
      });
  }

  openManageMembersModal(conv: ConversationSummary): void {
    this.manageMemberIds.set(conv.participants.map((p) => p.userId));
    this.manageMemberSearch.set('');
    this.showManageMembersModal.set(true);
  }

  toggleManageMember(userId: string): void {
    this.manageMemberIds.update((ids) =>
      ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]
    );
  }

  onSaveSpaceMembers(): void {
    const conv = this.chatService.activeConversation();
    if (!conv || conv.type === 'DM') return;
    this.chatService.updateSpaceMembers(conv.id, this.manageMemberIds()).subscribe(() => {
      this.showManageMembersModal.set(false);
    });
  }

  toggleAttachMenu(): void {
    this.isAttachMenuOpen.update((v) => !v);
  }

  closeAttachMenu(): void {
    this.isAttachMenuOpen.set(false);
  }

  openPreview(att: ChatAttachment): void {
    this.previewAttachment.set(att);
  }

  closePreview(): void {
    this.previewAttachment.set(null);
  }

  isConversationOnline(conv: ConversationSummary): boolean {
    if (conv.type !== 'DM') return false;
    const me = this.currentUserId();
    const other = conv.participants.find((p) => p.userId !== me);
    return !!other?.online;
  }

  async openCameraModal(): Promise<void> {
    this.isAttachMenuOpen.set(false);
    this.cameraError.set(null);
    this.isCameraReady.set(false);
    this.isCameraModalOpen.set(true);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.cameraError.set('Tu navegador no permite acceso directo a la cámara en este contexto. Usa el selector alternativo.');
      return;
    }

    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setTimeout(() => {
        const video = this.cameraVideoRef?.nativeElement;
        if (video && this.cameraStream) {
          video.srcObject = this.cameraStream;
          video.play().then(() => this.isCameraReady.set(true)).catch(() => this.isCameraReady.set(true));
        }
      }, 50);
    } catch {
      this.cameraError.set('No se pudo acceder a la cámara (permiso denegado o cámara no disponible).');
    }
  }

  captureCameraPhoto(): void {
    const video = this.cameraVideoRef?.nativeElement;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    let dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    if (dataUrl.length > 2 * 1024 * 1024) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.65);
    }

    const approxBytes = Math.round((dataUrl.length * 3) / 4);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.pendingAttachments.update((list) => [
      ...list,
      {
        fileName: `captura-${stamp}.jpg`,
        contentType: 'image/jpeg',
        fileSize: approxBytes,
        storageUrl: dataUrl,
      },
    ]);
    this.closeCameraModal();
  }

  triggerCameraFallback(): void {
    this.closeCameraModal();
    this.cameraFallbackInputRef?.nativeElement.click();
  }

  closeCameraModal(): void {
    this.stopCameraStream();
    this.isCameraModalOpen.set(false);
    this.isCameraReady.set(false);
    this.cameraError.set(null);
  }

  private stopCameraStream(): void {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((t) => t.stop());
      this.cameraStream = null;
    }
  }

  ngOnDestroy(): void {
    this.stopCameraStream();
  }
}
