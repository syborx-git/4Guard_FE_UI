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
import { Router } from '@angular/router';
import { EMPTY, catchError } from 'rxjs';
import { ChatService } from '../chat.service';
import { AuthState } from '../../../core/auth/auth.state';
import { ThemeService } from '../../../core/services/theme.service';
import { ChatGovernanceService } from '../../../core/services/chat-governance.service';
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
  private _mode: 'fullscreen' | 'drawer' = 'fullscreen';
  @Input() set mode(val: 'fullscreen' | 'drawer' | undefined) {
    this._mode = val === 'drawer' ? 'drawer' : 'fullscreen';
  }
  get mode(): 'fullscreen' | 'drawer' {
    return this._mode;
  }
  @Input() isExpanded = false;
  @Output() closeRequested = new EventEmitter<void>();
  @Output() toggleExpandRequested = new EventEmitter<void>();

  protected readonly chatService = inject(ChatService);
  protected readonly authState = inject(AuthState);
  protected readonly themeService = inject(ThemeService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);
  private readonly chatGovernanceService = inject(ChatGovernanceService);

  private static readonly MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
  private static readonly MAX_IMAGE_DIMENSION = 1280;
  private static readonly IMAGE_JPEG_QUALITY = 0.78;
  private static readonly COMPRESSIBLE_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ]);

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
  protected readonly replyingTo = signal<ChatMessage | null>(null);
  protected readonly highlightedMessageId = signal<string | null>(null);
  protected readonly isPinnedExpanded = signal<boolean>(false);
  protected readonly showThreadSearch = signal<boolean>(false);
  protected readonly threadSearchQuery = signal<string>('');
  protected readonly threadSearchResults = signal<ChatMessage[]>([]);
  protected readonly isSearchingThread = signal<boolean>(false);
  protected readonly showEvidenceGallery = signal<boolean>(false);
  protected readonly evidenceFilter = signal<'ALL' | 'IMAGE' | 'PDF'>('ALL');
  protected readonly evidenceItems = signal<ChatAttachment[]>([]);
  protected readonly isLoadingEvidence = signal<boolean>(false);
  protected readonly showUsageGuide = signal<boolean>(false);
  protected readonly readInfoMessage = signal<ChatMessage | null>(null);
  protected readonly isHeaderMenuOpen = signal<boolean>(false);
  protected readonly isPrivacyCurtainActive = signal<boolean>(false);
  protected readonly watermarkTiles = Array.from({ length: 18 }, (_, i) => i);

  private lastTypingSentAt = 0;
  private highlightTimeout: any = null;
  private searchDebounceTimeout: any = null;
  private privacyCurtainTimeout: any = null;

  protected readonly quickEmojis = ['👍', '✅', '👀', '🚚', '⚠️'];

  protected readonly filteredEvidence = computed<ChatAttachment[]>(() => {
    const filter = this.evidenceFilter();
    const items = this.evidenceItems();
    if (filter === 'IMAGE') {
      return items.filter((a) => (a.contentType || '').toLowerCase().startsWith('image/'));
    }
    if (filter === 'PDF') {
      return items.filter((a) => (a.contentType || '').toLowerCase().includes('pdf'));
    }
    return items;
  });

  protected readonly evidenceCounts = computed(() => {
    const items = this.evidenceItems();
    const images = items.filter((a) => (a.contentType || '').toLowerCase().startsWith('image/')).length;
    const pdfs = items.filter((a) => (a.contentType || '').toLowerCase().includes('pdf')).length;
    return { all: items.length, images, pdfs };
  });

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

  protected readonly isDirector = computed(() => {
    const r = (this.authState.currentUser()?.role || '').toUpperCase();
    return r.includes('CEO') || r.includes('DIRECTOR') || r.includes('ADMIN');
  });

  protected readonly canCreateSpace = this.isDirector;
  protected readonly canDownloadAttachments = this.isManagerOrDirector;

  protected readonly watermarkText = computed(() => {
    const u = this.authState.currentUser();
    const tag = u?.username ? '@' + u.username : this.currentUserName();
    return tag + ' · 4GUARD CONFIDENCIAL · ' + new Date().toLocaleDateString('es-MX');
  });

  protected readonly safePreviewUrl = computed<SafeResourceUrl | null>(() => {
    const att = this.previewAttachment();
    if (!att) return null;
    const url = (att.storageUrl || '').trim();
    const isPdf = att.contentType.toLowerCase() === 'application/pdf';
    const isSafePdfUrl =
      url.startsWith('data:application/pdf;base64,') ||
      url.startsWith('https://') ||
      url.startsWith('/api/');
    if (!isPdf || !isSafePdfUrl) return null;
    const finalUrl = !this.canDownloadAttachments() ? `${url}#toolbar=0&navpanes=0` : url;
    return this.sanitizer.bypassSecurityTrustResourceUrl(finalUrl);
  });

  isSafeAttachmentUrl(att: ChatAttachment): boolean {
    const url = (att.storageUrl || '').trim();
    return (
      url.startsWith('data:image/jpeg;base64,') ||
      url.startsWith('data:image/png;base64,') ||
      url.startsWith('data:image/webp;base64,') ||
      url.startsWith('data:image/gif;base64,') ||
      url.startsWith('data:application/pdf;base64,') ||
      url.startsWith('https://') ||
      url.startsWith('/api/')
    );
  }

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

  private readonly handleWindowKeydown = (event: KeyboardEvent): void => {
    if (this.canDownloadAttachments()) return;

    if (event.key === 'PrintScreen') {
      event.preventDefault();
      this.isPrivacyCurtainActive.set(true);
      clearTimeout(this.privacyCurtainTimeout);
      this.privacyCurtainTimeout = setTimeout(() => {
        this.isPrivacyCurtainActive.set(false);
      }, 2500);
      try {
        navigator.clipboard?.writeText?.('')?.catch?.(() => {});
      } catch {
        // Ignorar restricciones de portapapeles
      }
      this.reportDlpAttempt('PRINT_SCREEN_ATTEMPT', 'Intento bloqueado de captura de pantalla (PrintScreen)');
      return;
    }

    if (
      (event.ctrlKey || event.metaKey) &&
      (event.key.toLowerCase() === 'p' || event.key.toLowerCase() === 's')
    ) {
      event.preventDefault();
      const keyLower = event.key.toLowerCase();
      this.reportDlpAttempt(
        keyLower === 'p' ? 'PRINT_ATTEMPT' : 'SAVE_ATTEMPT',
        keyLower === 'p'
          ? 'Intento bloqueado de impresión (Ctrl+P)'
          : 'Intento bloqueado de guardado local (Ctrl+S)'
      );
    }
  };

  private reportDlpAttempt(eventType: string, description: string): void {
    const conversationId = this.chatService.activeConversationId() ?? undefined;
    this.chatGovernanceService
      .reportDlpEvent({
        conversationId,
        eventType,
        description,
      })
      .pipe(catchError(() => EMPTY))
      .subscribe();
  }

  openChatGovernance(): void {
    this.closeRequested.emit();
    void this.router.navigate(['/admin/chat-governance']);
  }

  private readonly handleWindowBlur = (): void => {
    if (!this.canDownloadAttachments() && (this.previewAttachment() !== null || this.mode === 'fullscreen')) {
      clearTimeout(this.privacyCurtainTimeout);
      this.isPrivacyCurtainActive.set(true);
    }
  };

  private readonly handleWindowFocus = (): void => {
    clearTimeout(this.privacyCurtainTimeout);
    this.isPrivacyCurtainActive.set(false);
  };

  private readonly handleVisibilityChange = (): void => {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'hidden') {
      if (!this.canDownloadAttachments() && (this.previewAttachment() !== null || this.mode === 'fullscreen')) {
        clearTimeout(this.privacyCurtainTimeout);
        this.isPrivacyCurtainActive.set(true);
      }
    } else if (document.visibilityState === 'visible') {
      clearTimeout(this.privacyCurtainTimeout);
      this.isPrivacyCurtainActive.set(false);
    }
  };

  ngOnInit(): void {
    this.chatService.loadConversations().subscribe();
    this.chatService.loadUsers().subscribe();
    this.chatService.startPolling();
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleWindowKeydown);
      window.addEventListener('blur', this.handleWindowBlur);
      window.addEventListener('focus', this.handleWindowFocus);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  onSelectConversation(conv: ConversationSummary): void {
    this.replyingTo.set(null);
    this.isPinnedExpanded.set(false);
    this.showThreadSearch.set(false);
    this.threadSearchQuery.set('');
    this.threadSearchResults.set([]);
    this.showEvidenceGallery.set(false);
    this.showUsageGuide.set(false);
    this.readInfoMessage.set(null);
    this.isHeaderMenuOpen.set(false);
    this.chatService.selectConversation(conv.id);
    this.mobileShowThread.set(true);
  }

  onBackToListMobile(): void {
    this.isHeaderMenuOpen.set(false);
    this.mobileShowThread.set(false);
  }

  toggleHeaderMenu(): void {
    this.isHeaderMenuOpen.update((v) => !v);
  }

  closeHeaderMenu(): void {
    this.isHeaderMenuOpen.set(false);
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
    const parentId = this.replyingTo()?.id;
    this.messageText.set('');
    this.mentionQuery.set(null);
    this.pendingAttachments.set([]);
    this.replyingTo.set(null);
    this.chatService.sendMessage(convId, finalContent, attachments, parentId).subscribe();
  }

  onStartReply(msg: ChatMessage): void {
    this.replyingTo.set(msg);
  }

  onCancelReply(): void {
    this.replyingTo.set(null);
  }

  onTogglePin(msg: ChatMessage): void {
    if (!this.isManagerOrDirector()) return;
    this.chatService.togglePinMessage(msg.id, !msg.isPinned).subscribe({ error: () => {} });
  }

  togglePinnedExpanded(): void {
    this.isPinnedExpanded.update((v) => !v);
  }

  jumpToMessage(messageId?: string | null): void {
    if (!messageId || typeof document === 'undefined') return;
    const target = document.querySelector(`[data-message-id="${messageId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    this.highlightedMessageId.set(messageId);
    clearTimeout(this.highlightTimeout);
    this.highlightTimeout = setTimeout(() => {
      if (this.highlightedMessageId() === messageId) {
        this.highlightedMessageId.set(null);
      }
    }, 1800);
  }

  toggleThreadSearch(): void {
    const next = !this.showThreadSearch();
    this.showThreadSearch.set(next);
    if (next) {
      this.showEvidenceGallery.set(false);
      this.showUsageGuide.set(false);
    } else {
      this.threadSearchQuery.set('');
      this.threadSearchResults.set([]);
      this.isSearchingThread.set(false);
    }
  }

  onThreadSearchInput(query: string): void {
    this.threadSearchQuery.set(query);
    const trimmed = query.trim();
    clearTimeout(this.searchDebounceTimeout);

    if (!trimmed) {
      this.threadSearchResults.set([]);
      this.isSearchingThread.set(false);
      return;
    }

    const qLower = trimmed.toLowerCase();
    const localMatches = this.chatService
      .messages()
      .filter(
        (m) =>
          !m.isDeleted &&
          ((m.content || '').toLowerCase().includes(qLower) ||
            (m.senderFullName || '').toLowerCase().includes(qLower))
      );
    this.threadSearchResults.set(localMatches);

    const convId = this.chatService.activeConversationId();
    if (!convId) return;

    this.isSearchingThread.set(true);
    this.searchDebounceTimeout = setTimeout(() => {
      this.chatService.searchConversationMessages(convId, trimmed).subscribe({
        next: (remote) => {
          if (this.threadSearchQuery().trim() === trimmed) {
            this.threadSearchResults.set(remote.length > 0 ? remote : localMatches);
            this.isSearchingThread.set(false);
          }
        },
        error: () => {
          if (this.threadSearchQuery().trim() === trimmed) {
            this.threadSearchResults.set(localMatches);
            this.isSearchingThread.set(false);
          }
        },
      });
    }, 250);
  }

  toggleEvidenceGallery(): void {
    const next = !this.showEvidenceGallery();
    this.showEvidenceGallery.set(next);
    if (next) {
      this.showThreadSearch.set(false);
      this.showUsageGuide.set(false);
      this.loadEvidence();
    }
  }

  loadEvidence(): void {
    const convId = this.chatService.activeConversationId();
    if (!convId) return;

    const localMap = new Map<string, ChatAttachment>();
    for (const msg of this.chatService.messages()) {
      if (msg.isDeleted || !msg.attachments?.length) continue;
      for (const att of msg.attachments) {
        const key = att.id || att.storageUrl;
        if (key && !localMap.has(key)) {
          localMap.set(key, att);
        }
      }
    }
    const localList = Array.from(localMap.values());
    this.evidenceItems.set(localList);
    this.isLoadingEvidence.set(true);

    this.chatService.loadConversationEvidence(convId).subscribe({
      next: (remote) => {
        if (this.chatService.activeConversationId() === convId) {
          this.evidenceItems.set(remote.length > 0 ? remote : localList);
          this.isLoadingEvidence.set(false);
        }
      },
      error: () => {
        if (this.chatService.activeConversationId() === convId) {
          this.evidenceItems.set(localList);
          this.isLoadingEvidence.set(false);
        }
      },
    });
  }

  toggleUsageGuide(): void {
    const next = !this.showUsageGuide();
    this.showUsageGuide.set(next);
    if (next) {
      this.showThreadSearch.set(false);
      this.showEvidenceGallery.set(false);
    }
  }

  onToggleSound(): void {
    this.chatService.toggleSound();
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
      const mime = (file.type || '').toLowerCase();
      if (EnterpriseChatComponent.COMPRESSIBLE_IMAGE_TYPES.has(mime)) {
        void this.compressAndQueueImage(file);
        return;
      }
      this.readRawFileAsAttachment(file);
    });
    input.value = '';
  }

  private readRawFileAsAttachment(file: File): void {
    if (file.size > EnterpriseChatComponent.MAX_ATTACHMENT_BYTES) return;
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
  }

  private async compressAndQueueImage(file: File): Promise<void> {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      this.readRawFileAsAttachment(file);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('No se pudo decodificar la imagen'));
        image.src = objectUrl;
      });

      const srcWidth = img.naturalWidth || img.width;
      const srcHeight = img.naturalHeight || img.height;
      if (!srcWidth || !srcHeight) {
        this.readRawFileAsAttachment(file);
        return;
      }

      const encoded = this.renderCompressedJpeg(img, srcWidth, srcHeight);
      if (!encoded || encoded.fileSize > EnterpriseChatComponent.MAX_ATTACHMENT_BYTES) {
        return;
      }

      const baseName = file.name.replace(/\.(png|webp|jpe?g)$/i, '');
      this.pendingAttachments.update((list) => [
        ...list,
        {
          fileName: `${baseName}.jpg`,
          contentType: 'image/jpeg',
          fileSize: encoded.fileSize,
          storageUrl: encoded.dataUrl,
        },
      ]);
    } catch {
      this.readRawFileAsAttachment(file);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  private renderCompressedJpeg(
    source: CanvasImageSource,
    srcWidth: number,
    srcHeight: number
  ): { dataUrl: string; fileSize: number } | null {
    const scale = Math.min(
      1,
      EnterpriseChatComponent.MAX_IMAGE_DIMENSION / Math.max(srcWidth, srcHeight)
    );
    const width = Math.max(1, Math.round(srcWidth * scale));
    const height = Math.max(1, Math.round(srcHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(source, 0, 0, width, height);
    let dataUrl = canvas.toDataURL('image/jpeg', EnterpriseChatComponent.IMAGE_JPEG_QUALITY);
    if (dataUrl.length > EnterpriseChatComponent.MAX_ATTACHMENT_BYTES) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    }
    const base64Part = dataUrl.split(',')[1] || '';
    const approxBytes = Math.round((base64Part.length * 3) / 4);
    return { dataUrl, fileSize: approxBytes };
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
    if (!this.canCreateSpace()) return;
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
    if (!this.canCreateSpace()) return;
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
    if (!this.canCreateSpace()) return;
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
    if (!this.canCreateSpace()) return;
    const conv = this.chatService.activeConversation();
    if (!conv || conv.type === 'DM') return;
    this.chatService.updateSpaceMembers(conv.id, this.manageMemberIds()).subscribe(() => {
      this.showManageMembersModal.set(false);
    });
  }

  getDmReadReceipt(conv: ConversationSummary, msg: ChatMessage): { read: boolean; readAt?: string } {
    const other = conv.participants.find((p) => p.userId !== this.currentUserId());
    if (!other?.lastReadAt) return { read: false };
    const readMs = new Date(other.lastReadAt).getTime();
    const msgMs = new Date(msg.createdAt).getTime();
    if (!isNaN(readMs) && !isNaN(msgMs) && readMs >= msgMs) {
      return { read: true, readAt: other.lastReadAt };
    }
    return { read: false };
  }

  openReadInfo(msg: ChatMessage): void {
    this.readInfoMessage.set(msg);
  }

  closeReadInfo(): void {
    this.readInfoMessage.set(null);
  }

  getSpaceReadInfo(
    conv: ConversationSummary,
    msg: ChatMessage
  ): {
    readBy: Array<{ userId: string; fullName: string; readAt: string }>;
    pending: Array<{ userId: string; fullName: string }>;
  } {
    const msgMs = new Date(msg.createdAt).getTime();
    const others = conv.participants.filter((p) => p.userId !== msg.senderId);
    const readBy: Array<{ userId: string; fullName: string; readAt: string }> = [];
    const pending: Array<{ userId: string; fullName: string }> = [];
    for (const p of others) {
      const readMs = p.lastReadAt ? new Date(p.lastReadAt).getTime() : NaN;
      if (!isNaN(readMs) && !isNaN(msgMs) && readMs >= msgMs) {
        readBy.push({ userId: p.userId, fullName: p.fullName || p.username, readAt: p.lastReadAt });
      } else {
        pending.push({ userId: p.userId, fullName: p.fullName || p.username });
      }
    }
    return { readBy, pending };
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

  formatRoleName(role?: string | null): string {
    if (!role) return 'Colaborador';
    const key = role.toUpperCase().replace(/^ROLE_/, '');
    const map: Record<string, string> = {
      CEO: 'Dirección General',
      DIRECTOR: 'Director Operativo',
      OPERATIONS_MANAGER: 'Gerente de Operaciones',
      GERENTE_OPERACIONES: 'Gerente de Operaciones',
      ADMIN: 'Administrador',
      SECURITY_CHIEF: 'Jefe de Seguridad',
      GATE_SECURITY: 'Vigilancia / Caseta',
      CASETA: 'Vigilancia / Caseta',
      RECEIVING_OPERATOR: 'Operador de Recepción',
      WAREHOUSE_OPERATOR: 'Operador de Almacén',
      FORKLIFT_OPERATOR: 'Montacarguista',
      QM_INSPECTOR: 'Inspector de Calidad',
      QUALITY_INSPECTOR: 'Inspector de Calidad',
      QUALITY_MANAGER: 'Jefe de Calidad',
      SHIPPING_OPERATOR: 'Operador de Embarques',
      CHAT_ONLY: 'Comunicación Interna',
    };
    return map[key] || key.replace(/_/g, ' ');
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

    const encoded = this.renderCompressedJpeg(video, video.videoWidth, video.videoHeight);
    if (!encoded) return;

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.pendingAttachments.update((list) => [
      ...list,
      {
        fileName: `captura-${stamp}.jpg`,
        contentType: 'image/jpeg',
        fileSize: encoded.fileSize,
        storageUrl: encoded.dataUrl,
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
    clearTimeout(this.highlightTimeout);
    clearTimeout(this.searchDebounceTimeout);
    clearTimeout(this.privacyCurtainTimeout);
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleWindowKeydown);
      window.removeEventListener('blur', this.handleWindowBlur);
      window.removeEventListener('focus', this.handleWindowFocus);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    this.stopCameraStream();
  }
}
