/**
 * @file chat-governance.component.ts
 * @description Panel de Control Directivo de Gobernanza de Chat, DLP y Auditoría Forense (ADR-022).
 * Exclusivo para Dirección General (ADMIN / CEO).
 */

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl, SafeUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import {
  BreakGlassTranscriptDto,
  ChatGovernanceOverviewDto,
  ChatGovernanceService,
  GovernanceAttachmentDto,
  GovernanceAuditMessageDto,
  GovernanceChatUserDto,
  GovernanceDlpEventDto,
  GovernanceSpaceDto,
  PagedResponse,
} from '../../../core/services/chat-governance.service';
import { ChatService } from '../../chat/chat.service';
import { ToastService } from '../../../core/services/toast.service';

export type GovernanceTab = 'overview' | 'spaces' | 'users' | 'audit' | 'policies';
export type SpaceStatusFilter = 'ALL' | 'ACTIVE' | 'FROZEN' | 'ARCHIVED';
export type UserAccessFilter = 'ALL' | 'CHAT_ONLY' | 'WMS' | 'FROZEN';
export type AuditSubView = 'messages' | 'dlp' | 'attachments';
export type AuditMessageTypeFilter = 'ALL' | 'EDITED' | 'DELETED';
export type FreezeDurationOption = 24 | 168 | 'INDEFINITE';

const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'fg-chat-governance',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './chat-governance.component.html',
  styleUrl: './chat-governance.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatGovernanceComponent implements OnInit {
  private readonly governanceService = inject(ChatGovernanceService);
  private readonly chatService = inject(ChatService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly Math = Math;
  protected readonly pageSize = DEFAULT_PAGE_SIZE;

  // Navegación principal
  readonly activeTab = signal<GovernanceTab>('overview');
  readonly lastUpdatedAt = signal<Date | null>(null);

  // Tab 1: Resumen Ejecutivo
  readonly overview = signal<ChatGovernanceOverviewDto | null>(null);
  readonly isLoadingOverview = signal<boolean>(false);
  readonly overviewError = signal<string | null>(null);
  readonly recentDlpAlerts = signal<GovernanceDlpEventDto[]>([]);
  readonly isLoadingRecentDlp = signal<boolean>(false);

  // Tab 2: Espacios y Gobernanza
  readonly spaceStatusFilter = signal<SpaceStatusFilter>('ALL');
  readonly spaceSearch = signal<string>('');
  readonly spacesPage = signal<number>(0);
  readonly spacesData = signal<PagedResponse<GovernanceSpaceDto> | null>(null);
  readonly isLoadingSpaces = signal<boolean>(false);
  readonly spacesError = signal<string | null>(null);
  readonly spacesLoadedOnce = signal<boolean>(false);
  readonly updatingSpaceId = signal<string | null>(null);

  // Tab 3: Usuarios Chat y Accesos
  readonly userFilter = signal<UserAccessFilter>('ALL');
  readonly userSearch = signal<string>('');
  readonly usersPage = signal<number>(0);
  readonly usersData = signal<PagedResponse<GovernanceChatUserDto> | null>(null);
  readonly isLoadingUsers = signal<boolean>(false);
  readonly usersError = signal<string | null>(null);
  readonly usersLoadedOnce = signal<boolean>(false);
  readonly unfreezingUserId = signal<string | null>(null);

  // Modal de Congelamiento de Usuario
  readonly freezeModalUser = signal<GovernanceChatUserDto | null>(null);
  readonly freezeChatOnly = signal<boolean>(true);
  readonly freezeDuration = signal<FreezeDurationOption>(24);
  readonly freezeReason = signal<string>('');
  readonly isSubmittingFreeze = signal<boolean>(false);
  readonly freezeError = signal<string | null>(null);

  // Tab 4: Auditoría Forense y DLP
  readonly auditSubView = signal<AuditSubView>('messages');
  readonly auditDays = signal<1 | 7 | 30>(7);
  readonly auditMessageType = signal<AuditMessageTypeFilter>('ALL');

  readonly auditMessagesPage = signal<number>(0);
  readonly auditMessagesData = signal<PagedResponse<GovernanceAuditMessageDto> | null>(null);
  readonly isLoadingAuditMessages = signal<boolean>(false);
  readonly auditMessagesError = signal<string | null>(null);
  readonly auditMessagesLoadedOnce = signal<boolean>(false);

  readonly dlpEventsPage = signal<number>(0);
  readonly dlpEventsData = signal<PagedResponse<GovernanceDlpEventDto> | null>(null);
  readonly isLoadingDlpEvents = signal<boolean>(false);
  readonly dlpEventsError = signal<string | null>(null);
  readonly dlpEventsLoadedOnce = signal<boolean>(false);

  readonly attachmentsPage = signal<number>(0);
  readonly attachmentsData = signal<PagedResponse<GovernanceAttachmentDto> | null>(null);
  readonly isLoadingAttachments = signal<boolean>(false);
  readonly attachmentsError = signal<string | null>(null);
  readonly attachmentsLoadedOnce = signal<boolean>(false);
  readonly downloadingAttachmentId = signal<string | null>(null);

  // Visor bajo demanda de evidencia
  readonly previewAttachment = signal<GovernanceAttachmentDto | null>(null);
  readonly previewSafeUrl = signal<SafeUrl | null>(null);
  readonly previewSafeResourceUrl = signal<SafeResourceUrl | null>(null);
  private previewRawObjectUrl: string | null = null;

  // Modal / Drawer de Acceso Break-Glass
  readonly showBreakGlassModal = signal<boolean>(false);
  readonly breakGlassConversationId = signal<string>('');
  readonly breakGlassConversationLabel = signal<string>('');
  readonly breakGlassReason = signal<string>('');
  readonly isSubmittingBreakGlass = signal<boolean>(false);
  readonly breakGlassError = signal<string | null>(null);
  readonly breakGlassTranscript = signal<BreakGlassTranscriptDto | null>(null);

  readonly breakGlassReasonLength = computed(() => this.breakGlassReason().trim().length);
  readonly breakGlassReasonValid = computed(() => this.breakGlassReasonLength() >= 10);
  readonly breakGlassCanSubmit = computed(
    () =>
      this.breakGlassConversationId().trim().length > 0 &&
      this.breakGlassReasonValid() &&
      !this.isSubmittingBreakGlass()
  );

  readonly isAnyRefreshing = computed(
    () =>
      this.isLoadingOverview() ||
      this.isLoadingRecentDlp() ||
      this.isLoadingSpaces() ||
      this.isLoadingUsers() ||
      this.isLoadingAuditMessages() ||
      this.isLoadingDlpEvents() ||
      this.isLoadingAttachments()
  );

  readonly spacesList = computed(() => this.spacesData()?.content ?? []);
  readonly usersList = computed(() => this.usersData()?.content ?? []);
  readonly auditMessagesList = computed(() => this.auditMessagesData()?.content ?? []);
  readonly dlpEventsList = computed(() => this.dlpEventsData()?.content ?? []);
  readonly attachmentsList = computed(() => this.attachmentsData()?.content ?? []);

  private spaceSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private userSearchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.spaceSearchTimer) clearTimeout(this.spaceSearchTimer);
      if (this.userSearchTimer) clearTimeout(this.userSearchTimer);
      this.revokePreviewObjectUrl();
    });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.previewAttachment()) {
      this.closeAttachmentPreview();
      return;
    }
    if (this.freezeModalUser() && !this.isSubmittingFreeze()) {
      this.closeFreezeModal();
      return;
    }
    if (this.showBreakGlassModal() && !this.isSubmittingBreakGlass()) {
      this.closeBreakGlassModal();
    }
  }

  ngOnInit(): void {
    this.loadOverview();
  }

  // ════════════════════════════════════════════════════════════════════
  // NAVEGACIÓN DE PESTAÑAS Y ACTUALIZACIÓN MANUAL
  // ════════════════════════════════════════════════════════════════════

  selectTab(tab: GovernanceTab): void {
    this.activeTab.set(tab);

    if (tab === 'overview' && !this.overview() && !this.isLoadingOverview()) {
      this.loadOverview();
    } else if (tab === 'spaces' && !this.spacesLoadedOnce()) {
      this.loadSpaces(0);
    } else if (tab === 'users' && !this.usersLoadedOnce()) {
      this.loadUsers(0);
    } else if (tab === 'audit') {
      this.ensureActiveAuditSubViewLoaded();
    } else if (tab === 'policies' && !this.overview() && !this.isLoadingOverview()) {
      this.loadOverview();
    }
  }

  refreshCurrentView(): void {
    const tab = this.activeTab();
    this.loadOverview();

    if (tab === 'spaces') {
      this.loadSpaces(this.spacesPage());
    } else if (tab === 'users') {
      this.loadUsers(this.usersPage());
    } else if (tab === 'audit') {
      this.reloadActiveAuditSubView(true);
    }
  }

  goToDlpAudit(): void {
    this.activeTab.set('audit');
    this.auditSubView.set('dlp');
    this.loadDlpEvents(0);
  }

  // ════════════════════════════════════════════════════════════════════
  // TAB 1: RESUMEN EJECUTIVO
  // ════════════════════════════════════════════════════════════════════

  loadOverview(): void {
    this.isLoadingOverview.set(true);
    this.overviewError.set(null);

    this.governanceService
      .getOverview()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingOverview.set(false))
      )
      .subscribe({
        next: (data) => {
          this.overview.set(data);
          this.lastUpdatedAt.set(new Date());
        },
        error: (err: HttpErrorResponse) => {
          this.overviewError.set(this.extractErrorMessage(err, 'No se pudo obtener el resumen ejecutivo.'));
        },
      });

    this.isLoadingRecentDlp.set(true);
    this.governanceService
      .getDlpEvents({ days: 7, page: 0, size: 5 })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingRecentDlp.set(false))
      )
      .subscribe({
        next: (res) => {
          this.recentDlpAlerts.set((res?.content ?? []).slice(0, 5));
        },
        error: () => {
          this.recentDlpAlerts.set([]);
        },
      });
  }

  // ════════════════════════════════════════════════════════════════════
  // TAB 2: ESPACIOS Y GOBERNANZA
  // ════════════════════════════════════════════════════════════════════

  loadSpaces(page = this.spacesPage()): void {
    this.isLoadingSpaces.set(true);
    this.spacesError.set(null);
    this.spacesPage.set(page);

    const status = this.spaceStatusFilter();
    const search = this.spaceSearch().trim();

    this.governanceService
      .getSpaces({
        status: status === 'ALL' ? undefined : status,
        search: search || undefined,
        page,
        size: this.pageSize,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoadingSpaces.set(false);
          this.spacesLoadedOnce.set(true);
        })
      )
      .subscribe({
        next: (res) => {
          this.spacesData.set(res);
          this.lastUpdatedAt.set(new Date());
        },
        error: (err: HttpErrorResponse) => {
          this.spacesError.set(this.extractErrorMessage(err, 'No se pudo cargar la lista de espacios.'));
        },
      });
  }

  setSpaceStatusFilter(status: SpaceStatusFilter): void {
    this.spaceStatusFilter.set(status);
    this.loadSpaces(0);
  }

  onSpaceSearchChange(value: string): void {
    this.spaceSearch.set(value);
    if (this.spaceSearchTimer) clearTimeout(this.spaceSearchTimer);
    this.spaceSearchTimer = setTimeout(() => {
      this.loadSpaces(0);
    }, 320);
  }

  clearSpaceSearch(): void {
    if (this.spaceSearchTimer) clearTimeout(this.spaceSearchTimer);
    this.spaceSearch.set('');
    this.loadSpaces(0);
  }

  changeSpacesPage(delta: number): void {
    const total = Math.max(1, this.spacesData()?.totalPages ?? 1);
    const next = this.spacesPage() + delta;
    if (next < 0 || next >= total) return;
    this.loadSpaces(next);
  }

  changeSpaceStatus(space: GovernanceSpaceDto, status: 'ACTIVE' | 'FROZEN' | 'ARCHIVED'): void {
    if (this.updatingSpaceId()) return;
    this.updatingSpaceId.set(space.id);

    this.governanceService
      .updateSpaceStatus(space.id, status)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.updatingSpaceId.set(null))
      )
      .subscribe({
        next: (updated) => {
          this.spacesData.update((curr) => {
            if (!curr) return curr;
            return {
              ...curr,
              content: curr.content.map((item) => (item.id === space.id ? updated : item)),
            };
          });
          const statusMsg =
            status === 'FROZEN'
              ? `Espacio "${space.name}" congelado en modo solo lectura.`
              : status === 'ARCHIVED'
                ? `Espacio "${space.name}" archivado.`
                : `Espacio "${space.name}" reactivado.`;
          this.toast.success(statusMsg);
          this.loadOverview();
        },
        error: (err: HttpErrorResponse) => {
          this.toast.error(this.extractErrorMessage(err, 'No se pudo actualizar el estado del espacio.'));
        },
      });
  }

  openSpaceInChat(spaceId: string): void {
    this.chatService.openDrawer();
    this.chatService.selectConversation(spaceId);
  }

  // ════════════════════════════════════════════════════════════════════
  // TAB 3: USUARIOS CHAT Y ACCESOS
  // ════════════════════════════════════════════════════════════════════

  loadUsers(page = this.usersPage()): void {
    this.isLoadingUsers.set(true);
    this.usersError.set(null);
    this.usersPage.set(page);

    const filter = this.userFilter();
    const search = this.userSearch().trim();

    this.governanceService
      .getUsers({
        filter,
        search: search || undefined,
        page,
        size: this.pageSize,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoadingUsers.set(false);
          this.usersLoadedOnce.set(true);
        })
      )
      .subscribe({
        next: (res) => {
          this.usersData.set(res);
          this.lastUpdatedAt.set(new Date());
        },
        error: (err: HttpErrorResponse) => {
          this.usersError.set(this.extractErrorMessage(err, 'No se pudo cargar el directorio de usuarios.'));
        },
      });
  }

  setUserFilter(filter: UserAccessFilter): void {
    this.userFilter.set(filter);
    this.loadUsers(0);
  }

  onUserSearchChange(value: string): void {
    this.userSearch.set(value);
    if (this.userSearchTimer) clearTimeout(this.userSearchTimer);
    this.userSearchTimer = setTimeout(() => {
      this.loadUsers(0);
    }, 320);
  }

  clearUserSearch(): void {
    if (this.userSearchTimer) clearTimeout(this.userSearchTimer);
    this.userSearch.set('');
    this.loadUsers(0);
  }

  changeUsersPage(delta: number): void {
    const total = Math.max(1, this.usersData()?.totalPages ?? 1);
    const next = this.usersPage() + delta;
    if (next < 0 || next >= total) return;
    this.loadUsers(next);
  }

  isUserFrozen(user: GovernanceChatUserDto): boolean {
    if (!user.isEnabled) return true;
    const normStatus = (user.status || '').toUpperCase();
    if (normStatus === 'FROZEN' || normStatus === 'SUSPENDED') return true;
    if (user.chatFrozenUntil) {
      const ms = Date.parse(user.chatFrozenUntil);
      if (!Number.isNaN(ms) && ms > Date.now()) return true;
    }
    return false;
  }

  isFreezeIndefinite(until?: string | null): boolean {
    if (!until) return true;
    const d = new Date(until);
    return Number.isNaN(d.getTime()) || d.getUTCFullYear() >= 2090;
  }

  openFreezeModal(user: GovernanceChatUserDto): void {
    this.freezeChatOnly.set(true);
    this.freezeDuration.set(24);
    this.freezeReason.set('');
    this.freezeError.set(null);
    this.freezeModalUser.set(user);
  }

  closeFreezeModal(): void {
    if (this.isSubmittingFreeze()) return;
    this.freezeModalUser.set(null);
    this.freezeError.set(null);
  }

  submitFreeze(): void {
    const target = this.freezeModalUser();
    if (!target || this.isSubmittingFreeze()) return;

    const reason = this.freezeReason().trim();
    if (reason.length < 5) {
      this.freezeError.set('Ingresa un motivo claro (mínimo 5 caracteres) para auditar la restricción.');
      return;
    }

    const dur = this.freezeDuration();
    const durationHours = dur === 'INDEFINITE' ? undefined : dur;
    const chatOnlyFreeze = this.freezeChatOnly();

    this.isSubmittingFreeze.set(true);
    this.freezeError.set(null);

    this.governanceService
      .freezeUser(target.id, {
        reason,
        chatOnlyFreeze,
        durationHours,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSubmittingFreeze.set(false))
      )
      .subscribe({
        next: () => {
          this.freezeModalUser.set(null);
          this.toast.warning(
            chatOnlyFreeze
              ? `Chat congelado para ${target.fullName} (acceso WMS/RF conservado).`
              : `Cuenta suspendida y sesiones revocadas para ${target.fullName}.`
          );
          this.loadUsers(this.usersPage());
          this.loadOverview();
        },
        error: (err: HttpErrorResponse) => {
          this.freezeError.set(this.extractErrorMessage(err, 'No se pudo aplicar el congelamiento al usuario.'));
        },
      });
  }

  onUnfreezeUser(user: GovernanceChatUserDto): void {
    if (this.unfreezingUserId()) return;
    this.unfreezingUserId.set(user.id);

    this.governanceService
      .unfreezeUser(user.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.unfreezingUserId.set(null))
      )
      .subscribe({
        next: () => {
          this.toast.success(`Acceso restablecido para ${user.fullName}.`);
          this.loadUsers(this.usersPage());
          this.loadOverview();
        },
        error: (err: HttpErrorResponse) => {
          this.toast.error(this.extractErrorMessage(err, 'No se pudo descongelar al usuario.'));
        },
      });
  }

  // ════════════════════════════════════════════════════════════════════
  // TAB 4: AUDITORÍA FORENSE Y DLP
  // ════════════════════════════════════════════════════════════════════

  selectAuditSubView(view: AuditSubView): void {
    this.auditSubView.set(view);
    this.ensureActiveAuditSubViewLoaded();
  }

  setAuditDays(days: 1 | 7 | 30): void {
    if (this.auditDays() === days) return;
    this.auditDays.set(days);
    this.reloadActiveAuditSubView(true);
  }

  setAuditMessageType(type: AuditMessageTypeFilter): void {
    if (this.auditMessageType() === type) return;
    this.auditMessageType.set(type);
    this.loadAuditMessages(0);
  }

  private ensureActiveAuditSubViewLoaded(): void {
    const view = this.auditSubView();
    if (view === 'messages' && !this.auditMessagesLoadedOnce()) {
      this.loadAuditMessages(0);
    } else if (view === 'dlp' && !this.dlpEventsLoadedOnce()) {
      this.loadDlpEvents(0);
    } else if (view === 'attachments' && !this.attachmentsLoadedOnce()) {
      this.loadAuditAttachments(0);
    }
  }

  private reloadActiveAuditSubView(resetPage: boolean): void {
    const view = this.auditSubView();
    if (view === 'messages') {
      this.loadAuditMessages(resetPage ? 0 : this.auditMessagesPage());
    } else if (view === 'dlp') {
      this.loadDlpEvents(resetPage ? 0 : this.dlpEventsPage());
    } else {
      this.loadAuditAttachments(resetPage ? 0 : this.attachmentsPage());
    }
  }

  loadAuditMessages(page = this.auditMessagesPage()): void {
    this.isLoadingAuditMessages.set(true);
    this.auditMessagesError.set(null);
    this.auditMessagesPage.set(page);

    const typeFilter = this.auditMessageType();

    this.governanceService
      .getAuditMessages({
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        days: this.auditDays(),
        page,
        size: this.pageSize,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoadingAuditMessages.set(false);
          this.auditMessagesLoadedOnce.set(true);
        })
      )
      .subscribe({
        next: (res) => {
          this.auditMessagesData.set(res);
          this.lastUpdatedAt.set(new Date());
        },
        error: (err: HttpErrorResponse) => {
          this.auditMessagesError.set(
            this.extractErrorMessage(err, 'No se pudo cargar la bitácora de mensajes editados o eliminados.')
          );
        },
      });
  }

  changeAuditMessagesPage(delta: number): void {
    const total = Math.max(1, this.auditMessagesData()?.totalPages ?? 1);
    const next = this.auditMessagesPage() + delta;
    if (next < 0 || next >= total) return;
    this.loadAuditMessages(next);
  }

  loadDlpEvents(page = this.dlpEventsPage()): void {
    this.isLoadingDlpEvents.set(true);
    this.dlpEventsError.set(null);
    this.dlpEventsPage.set(page);

    this.governanceService
      .getDlpEvents({
        days: this.auditDays(),
        page,
        size: this.pageSize,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoadingDlpEvents.set(false);
          this.dlpEventsLoadedOnce.set(true);
        })
      )
      .subscribe({
        next: (res) => {
          this.dlpEventsData.set(res);
          this.lastUpdatedAt.set(new Date());
        },
        error: (err: HttpErrorResponse) => {
          this.dlpEventsError.set(
            this.extractErrorMessage(err, 'No se pudieron cargar los eventos de seguridad DLP.')
          );
        },
      });
  }

  changeDlpEventsPage(delta: number): void {
    const total = Math.max(1, this.dlpEventsData()?.totalPages ?? 1);
    const next = this.dlpEventsPage() + delta;
    if (next < 0 || next >= total) return;
    this.loadDlpEvents(next);
  }

  loadAuditAttachments(page = this.attachmentsPage()): void {
    this.isLoadingAttachments.set(true);
    this.attachmentsError.set(null);
    this.attachmentsPage.set(page);

    this.governanceService
      .getAuditAttachments({
        days: this.auditDays(),
        page,
        size: this.pageSize,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoadingAttachments.set(false);
          this.attachmentsLoadedOnce.set(true);
        })
      )
      .subscribe({
        next: (res) => {
          this.attachmentsData.set(res);
          this.lastUpdatedAt.set(new Date());
        },
        error: (err: HttpErrorResponse) => {
          this.attachmentsError.set(
            this.extractErrorMessage(err, 'No se pudo cargar la galería forense de evidencias.')
          );
        },
      });
  }

  changeAttachmentsPage(delta: number): void {
    const total = Math.max(1, this.attachmentsData()?.totalPages ?? 1);
    const next = this.attachmentsPage() + delta;
    if (next < 0 || next >= total) return;
    this.loadAuditAttachments(next);
  }

  openAttachmentOnDemand(att: GovernanceAttachmentDto): void {
    if (this.downloadingAttachmentId()) return;
    this.downloadingAttachmentId.set(att.id);

    this.governanceService
      .downloadAuditAttachment(att.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.downloadingAttachmentId.set(null))
      )
      .subscribe({
        next: (blob) => {
          this.revokePreviewObjectUrl();
          const typedBlob =
            blob.type || !att.contentType ? blob : new Blob([blob], { type: att.contentType });
          const objectUrl = URL.createObjectURL(typedBlob);
          this.previewRawObjectUrl = objectUrl;
          this.previewSafeUrl.set(this.sanitizer.bypassSecurityTrustUrl(objectUrl));
          this.previewSafeResourceUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl));
          this.previewAttachment.set(att);
        },
        error: (err: HttpErrorResponse) => {
          this.toast.error(this.extractErrorMessage(err, 'No se pudo descargar la evidencia seleccionada.'));
        },
      });
  }

  closeAttachmentPreview(): void {
    this.previewAttachment.set(null);
    this.previewSafeUrl.set(null);
    this.previewSafeResourceUrl.set(null);
    this.revokePreviewObjectUrl();
  }

  private revokePreviewObjectUrl(): void {
    if (this.previewRawObjectUrl) {
      URL.revokeObjectURL(this.previewRawObjectUrl);
      this.previewRawObjectUrl = null;
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // MODAL DE ACCESO EXCEPCIONAL BREAK-GLASS
  // ════════════════════════════════════════════════════════════════════

  openBreakGlassModal(conversationId = '', conversationLabel = ''): void {
    this.breakGlassConversationId.set(conversationId);
    this.breakGlassConversationLabel.set(conversationLabel);
    this.breakGlassReason.set('');
    this.breakGlassError.set(null);
    this.breakGlassTranscript.set(null);
    this.showBreakGlassModal.set(true);
  }

  closeBreakGlassModal(): void {
    if (this.isSubmittingBreakGlass()) return;
    this.showBreakGlassModal.set(false);
    this.breakGlassError.set(null);
    this.breakGlassTranscript.set(null);
  }

  resetBreakGlassTranscript(): void {
    this.breakGlassTranscript.set(null);
    this.breakGlassError.set(null);
  }

  submitBreakGlass(): void {
    const convId = this.breakGlassConversationId().trim();
    const reason = this.breakGlassReason().trim();

    if (!convId) {
      this.breakGlassError.set('Ingresa el ID de la conversación a inspeccionar.');
      return;
    }
    if (reason.length < 10) {
      this.breakGlassError.set('El motivo debe tener al menos 10 caracteres para quedar registrado en wms.audit_logs.');
      return;
    }

    this.isSubmittingBreakGlass.set(true);
    this.breakGlassError.set(null);

    this.governanceService
      .breakGlassInspect(convId, reason)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSubmittingBreakGlass.set(false))
      )
      .subscribe({
        next: (transcript) => {
          this.breakGlassTranscript.set(transcript);
          this.toast.info('Inspección Break-Glass registrada de forma inmutable en wms.audit_logs.');
          this.loadOverview();
          if (this.activeTab() === 'audit' && this.auditSubView() === 'dlp') {
            this.loadDlpEvents(this.dlpEventsPage());
          }
        },
        error: (err: HttpErrorResponse) => {
          this.breakGlassError.set(
            this.extractErrorMessage(err, 'No se pudo ejecutar la inspección Break-Glass sobre esa conversación.')
          );
        },
      });
  }

  // ════════════════════════════════════════════════════════════════════
  // UTILIDADES DE FORMATO Y ETIQUETAS
  // ════════════════════════════════════════════════════════════════════

  formatDateTime(iso?: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatTimeOnly(date: Date | null): string {
    if (!date) return '—';
    return date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  formatFileSize(bytes?: number | null): string {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  formatMb(mb?: number | null): string {
    if (mb === null || mb === undefined || Number.isNaN(mb)) return '0.0 MB';
    return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
  }

  getInitials(fullName?: string | null): string {
    if (!fullName) return 'US';
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'US';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  formatRoleName(role?: string | null): string {
    if (!role) return 'Colaborador';
    const key = role.toUpperCase().replace(/^ROLE_/, '');
    const labels: Record<string, string> = {
      CEO: 'Dirección General',
      DIRECTOR: 'Dirección General',
      ADMIN: 'Administrador / Dirección',
      OPERATIONS_MANAGER: 'Gerente de Operaciones',
      GERENTE_OPERACIONES: 'Gerente de Operaciones',
      OPERATIONS_COORDINATOR: 'Coord. de Operaciones',
      OPERATIONS_SUPERVISOR: 'Supervisor de Operaciones',
      CONTROL_DESK: 'Mesa de Control',
      SECURITY_CHIEF: 'Jefe de Seguridad',
      SECURITY_GUARD: 'Vigilancia / Caseta',
      GATE_SECURITY: 'Vigilancia / Caseta',
      RECEIVING_OPERATOR: 'Recepción',
      WAREHOUSE_OPERATOR: 'Almacén',
      FORKLIFT_OPERATOR: 'Montacarguista',
      QM_INSPECTOR: 'Inspector Calidad',
      QUALITY_INSPECTOR: 'Inspector Calidad',
      QUALITY_MANAGER: 'Jefe de Calidad',
      SHIPPING_OPERATOR: 'Embarques',
      CHAT_ONLY: 'Solo Chat',
    };
    return labels[key] || key.replace(/_/g, ' ');
  }

  spaceStatusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'Activo';
      case 'FROZEN':
        return 'Solo Lectura';
      case 'ARCHIVED':
        return 'Archivado';
      default:
        return status;
    }
  }

  formatDlpEventType(eventType?: string | null): string {
    const key = (eventType || '').toUpperCase();
    const map: Record<string, string> = {
      SCREENSHOT_ATTEMPT: 'Intento de Captura (PrintScreen)',
      PRINT_BLOCKED: 'Impresión Bloqueada (Ctrl+P)',
      SAVE_BLOCKED: 'Guardado Bloqueado (Ctrl+S)',
      BREAK_GLASS_ACCESS: 'Acceso Break-Glass WORM',
      USER_FROZEN: 'Usuario Congelado / Suspendido',
      USER_UNFROZEN: 'Usuario Descongelado',
      SPACE_FROZEN: 'Espacio Congelado',
      SPACE_ARCHIVED: 'Espacio Archivado',
      SPACE_REACTIVATED: 'Espacio Reactivado',
    };
    return map[key] || (eventType || 'Evento DLP').replace(/_/g, ' ');
  }

  dlpSeverityLabel(severity?: string | null): string {
    const key = (severity || '').toUpperCase();
    if (key === 'HIGH' || key === 'CRITICAL') return 'ALTA';
    if (key === 'MEDIUM' || key === 'WARN') return 'MEDIA';
    return 'BAJA';
  }

  dlpSeverityTone(severity?: string | null): 'danger' | 'warning' | 'info' {
    const key = (severity || '').toUpperCase();
    if (key === 'HIGH' || key === 'CRITICAL') return 'danger';
    if (key === 'MEDIUM' || key === 'WARN') return 'warning';
    return 'info';
  }

  isImageType(contentType?: string | null): boolean {
    return (contentType || '').toLowerCase().startsWith('image/');
  }

  isPdfType(contentType?: string | null): boolean {
    return (contentType || '').toLowerCase().includes('pdf');
  }

  private extractErrorMessage(err: HttpErrorResponse, fallback: string): string {
    if (err.status === 403) {
      return err.error?.message || 'Acceso restringido: esta función es exclusiva de Dirección General.';
    }
    return err.error?.message || err.message || fallback;
  }
}
