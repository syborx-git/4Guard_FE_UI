export type ConversationType = 'DM' | 'SPACE' | 'THREAD';
export type NotificationPref = 'ALL' | 'MENTIONS' | 'MUTED';

export interface ChatUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  roleName: string;
  branchId?: string | null;
  active: boolean;
  online?: boolean;
}

export interface ChatParticipant {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  notificationPref: NotificationPref;
  lastReadAt: string;
  online?: boolean;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  usernames: string[];
}

export interface ChatAttachment {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  storageUrl: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  senderFullName: string;
  parentMessageId?: string | null;
  parentMessageContent?: string | null;
  parentSenderName?: string | null;
  content: string;
  messageType: 'TEXT' | 'SYSTEM' | 'ENTITY_REF';
  metadataJson?: string | null;
  isEdited: boolean;
  editedAt?: string | null;
  isDeleted: boolean;
  isPinned?: boolean;
  pinnedAt?: string | null;
  pinnedBy?: string | null;
  pinnedByName?: string | null;
  createdAt: string;
  reactions: ReactionSummary[];
  attachments: ChatAttachment[];
  replyCount: number;
}

export interface ConversationSummary {
  id: string;
  organizationId: string;
  branchId?: string | null;
  type: ConversationType;
  name: string;
  description?: string | null;
  icon?: string | null;
  category?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  lastMessageAt?: string | null;
  unreadCount: number;
  lastMessage?: ChatMessage | null;
  participants: ChatParticipant[];
  myNotificationPref: NotificationPref;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
}
