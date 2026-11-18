export type UserRole = "developer" | "admin" | "manager" | "agent" | "viewer";
export type PresenceStatus = "online" | "busy" | "offline";
export type RoutingMode = "round_robin" | "manual_queue" | "ai_first";
export type ChannelProvider = "evolution" | "meta_cloud";
export type ChannelStatus = "connected" | "scan_qr" | "disconnected" | "error";
export type EvolutionSecretTtl = "1w" | "1m" | "1y" | "never";
export type TemplateStatus = "APPROVED" | "PENDING" | "REJECTED";
export type TemplateCategory = "UTILITY" | "MARKETING" | "AUTHENTICATION";
export type ConversationStatus = "new_request" | "open" | "resolved";
export type AssigneeKind = "user" | "ai" | null;
export type MessageDirection = "inbound" | "outbound" | "internal_note" | "system";
export type MessageType = "text" | "template" | "invoice" | "location" | "audio";
export type DeliveryStatus = "sent" | "delivered" | "read" | "failed";
export type AssignmentReason = "claim" | "transfer" | "release" | "routing" | "handoff";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  niche: string;
  routingMode: RoutingMode;
  vocabulary: {
    lead: string;
    won: string;
    lost: string;
  };
}

export interface TeamMember {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: UserRole;
  roleId: string | null;
  roleName: string;
  isActive: boolean;
  presence: PresenceStatus;
  avatarBg: string;
  avatarUrl?: string | null;
  activeChatsCount: number;
  avgResponseMinutes: number;
}

export interface PermissionDef {
  key: string;
  label: string;
  group: string;
}

export interface RoleDef {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
  membersCount: number;
}

export interface EvolutionAntiBanConfig {
  throttleMinMs: number;
  throttleMaxMs: number;
  dailyCap: number;
  sentToday: number;
  warmupEnabled: boolean;
  businessHoursOnly: boolean;
  stopOptOutEnabled: boolean;
}

export interface ChannelSession {
  id: string;
  organizationId: string;
  provider: ChannelProvider;
  displayName: string;
  phoneNumber: string;
  status: ChannelStatus;
  webhookPathToken: string;
  aiEnabledByDefault: boolean;
  evolutionBaseUrl?: string;
  evolutionInstanceName?: string;
  evolutionApiKey?: string;
  evolutionWebhookSecret?: string;
  evolutionWebhookSecretSet?: boolean;
  evolutionWebhookSecretExpiresAt?: string | null;
  antiBan?: EvolutionAntiBanConfig;
  metaWabaId?: string;
  metaPhoneNumberId?: string;
  metaAccessToken?: string;
  metaAppSecret?: string;
  metaVerifyToken?: string;
  webhookRegistered?: boolean;
}

export interface MetaTemplate {
  id: string;
  organizationId: string;
  channelSessionId: string;
  name: string;
  language: string;
  category: TemplateCategory;
  status: TemplateStatus;
  headerText?: string;
  bodyText: string;
  footerText?: string;
  metaTemplateId?: string;
  variablesCount: number;
}

export interface ChannelCapabilities {
  provider: ChannelProvider;
  label: string;
  freeformOutsideWindow: boolean;
  requiresTemplates: boolean;
  canManageTemplates: boolean;
  banRisk: boolean;
  minIntervalMs: number | null;
  voiceNote: "server-convert" | "opus-only";
  groups: "full" | "limited";
  costPerMessage: boolean;
  canEditSentMessage: boolean;
}

export interface Conversation {
  id: string;
  organizationId: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactCompany: string;
  avatarBg: string;
  channelSessionId: string;
  provider: ChannelProvider;
  status: ConversationStatus;
  assigneeKind: AssigneeKind;
  assignedToUserId: string | null;
  aiPaused: boolean;
  unreadCount: number;
  responseTimeMinutes: number;
  minutesSinceLastMsg: number;
  metaWindowExpiresAt: string | null;
  lastMessagePreview: string;
  lastMessageTime: string;
  sentimentScore: number;
  tags: string[];
}

export interface AiTurnTrace {
  provider: string;
  model: string;
  ragSourcesUsed: string[];
  mcpToolsCalled: Array<{ tool: string; summary: string }>;
  handoffTriggered: boolean;
  handoffTriggerCode?:
    | "G1_EXPLICIT_HUMAN"
    | "G2_NEGATIVE_SENTIMENT"
    | "G3_LOW_RAG"
    | "G4_STAGE_REQUIRES_HUMAN"
    | "G5_LOW_CONFIDENCE"
    | "G6_BLOCKED_TOPIC";
  guardrailsPassed: boolean;
  ragTopScore?: number;
  latencyMs: number;
}

export type NoAnswerBehavior = "handoff" | "safe_reply" | "silent";

export interface AiGuardrails {
  groundingStrict: boolean;
  minRelevanceScore: number;
  noAnswerBehavior: NoAnswerBehavior;
  fallbackMessage: string;
  blockedTopics: string[];
}

export const DEFAULT_AI_GUARDRAILS: AiGuardrails = {
  groundingStrict: true,
  minRelevanceScore: 0.42,
  noAnswerBehavior: "handoff",
  fallbackMessage:
    "Não tenho essa informação por aqui, mas já vou chamar um atendente da equipe para te ajudar.",
  blockedTopics: [],
};

export interface Message {
  id: string;
  organizationId: string;
  conversationId: string;
  direction: MessageDirection;
  senderKind: "contact" | "agent" | "ai" | "system";
  senderName: string;
  messageType: MessageType;
  body: string;
  timestampLabel: string;
  deliveryStatus: DeliveryStatus;
  metadata?: {
    templateName?: string;
    templateLanguage?: string;
    templateVariables?: string[];
    invoiceAmountCents?: number;
    invoiceCode?: string;
    invoiceStatus?: "Aguardando pagamento" | "Pago";
    locationAddress?: string;
    aiTrace?: AiTurnTrace;
    // Áudio transcrito (igual à visualização do WhatsApp)
    audioTranscript?: string;
    audioDurationSeconds?: number;
    transcriptionStatus?: "processing" | "done" | "error" | "skipped";
    transcriptionError?: string;
    audioUrl?: string;
  };
}

export interface AssignmentEvent {
  id: string;
  organizationId: string;
  conversationId: string;
  fromName: string;
  toName: string;
  changedByName: string;
  reason: AssignmentReason;
  timestampLabel: string;
}

export interface Pipeline {
  id: string;
  organizationId: string;
  name: string;
  isDefault: boolean;
}

export interface Stage {
  id: string;
  organizationId: string;
  pipelineId: string;
  name: string;
  position: number;
  color: string;
  winProbability: number;
  isWon: boolean;
  isLost: boolean;
  requiresHuman: boolean;
  requiredFields: string[];
}

export interface LeadTask {
  id: string;
  title: string;
  done: boolean;
  dueDate: string;
}

export interface Lead {
  id: string;
  organizationId: string;
  pipelineId: string;
  stageId: string;
  conversationId: string | null;
  contactName: string;
  contactPhone: string;
  company: string;
  title: string;
  valueCents: number;
  ownerUserId: string | null;
  ownerKind: AssigneeKind;
  tags: string[];
  lostReason?: string;
  notes: string;
  tasks: LeadTask[];
  createdAtLabel: string;
}

export interface AiAgentConfig {
  id: string;
  organizationId: string;
  name: string;
  provider: "openai" | "anthropic" | "google" | "openrouter";
  model: string;
  apiKey?: string;
  systemPrompt: string;
  temperature: number;
  isActive: boolean;
  handoffRules: {
    explicitHumanRequest: boolean;
    negativeSentimentThreshold: number;
    lowRagConfidenceHandoff: boolean;
    stageRequiresHuman: boolean;
  };
  guardrails: AiGuardrails;
  mcpToolsEnabled: string[];
  monthlyBudgetCents: number;
  spentCents: number;
}

export interface KnowledgeSource {
  id: string;
  organizationId: string;
  title: string;
  sourceType: "faq" | "pdf" | "policy" | "catalog";
  content: string;
  chunksCount: number;
  indexed?: boolean;
  updatedAtLabel: string;
}

export interface QuickReply {
  id: string;
  organizationId: string;
  shortcut: string;
  title: string;
  body: string;
}

export interface BroadcastRecipientItem {
  name: string;
  phone: string;
  status:
    | "sent"
    | "saved_only"
    | "skipped_optout"
    | "skipped_daily_cap"
    | "skipped_business_hours"
    | "failed";
  detail: string;
  delayAppliedMs?: number;
  conversationId?: string;
}

export interface BroadcastStats {
  total: number;
  sent: number;
  skippedOptOut: number;
  skippedDailyCap: number;
  skippedBusinessHours: number;
  failed: number;
  avgDelayMs: number;
}

export interface BroadcastCampaign {
  id: string;
  organizationId: string;
  channelSessionId: string;
  provider: ChannelProvider;
  name: string;
  status: "completed" | "paused_antiban" | "failed";
  messageType: "text" | "template";
  bodyText: string;
  templateId?: string;
  templateName?: string;
  templateVariables: string[];
  recipients: BroadcastRecipientItem[];
  stats: BroadcastStats;
  antiBanSnapshot?: EvolutionAntiBanConfig;
  createdAtLabel: string;
}

export interface TenantStateResponse {
  dbMode: "postgres";
  organizations: Organization[];
  activeOrganization: Organization;
  currentUser?: TeamMember;
  members: TeamMember[];
  roles: RoleDef[];
  permissionCatalog: PermissionDef[];
  currentUserPermissions: string[];
  channels: ChannelSession[];
  metaTemplates: MetaTemplate[];
  conversations: Conversation[];
  messages: Message[];
  assignmentEvents: AssignmentEvent[];
  pipelines: Pipeline[];
  stages: Stage[];
  leads: Lead[];
  aiAgent: AiAgentConfig | null;
  knowledgeSources: KnowledgeSource[];
  quickReplies: QuickReply[];
  broadcastCampaigns: BroadcastCampaign[];
}

export interface DashboardSummary {
  canViewFinancials: boolean;
  roleSlug: string;
  myMetrics: {
    myAssignedConversationsCount: number;
    myResolvedConversationsCount: number;
    unassignedQueueCount: number;
    myOpenLeadsCount: number;
    myWonLeadsCount: number;
    onlineAgentsCount: number;
  };
  kpis: {
    pipelineValueCents: number | null;
    wonValueCents: number | null;
    totalLeadsCount: number;
    openLeadsCount: number;
    wonLeadsCount: number;
    lostLeadsCount: number;
    winRatePercent: number;
    avgResponseFormatted: string;
    avgResponseMinutes: number;
    openConversationsCount: number;
    newRequestsCount: number;
    resolvedConversationsCount: number;
    aiActiveConversationsCount: number;
    averageSentimentPercent: number;
  };
  dailyActivity: Array<{
    date: string;
    label: string;
    inboundMessages: number;
    outboundMessages: number;
    newLeads: number;
    broadcastSent: number;
  }>;
  channelBreakdown: {
    totalMessages: number;
    evolutionMessages: number;
    metaCloudMessages: number;
    aiMessages: number;
    evolutionDailySent: number;
    evolutionDailyCap: number;
  };
  stageBreakdown: Array<{
    id: string;
    name: string;
    color: string;
    leadsCount: number;
    valueCents: number | null;
  }>;
  recentDeals: Array<{
    id: string;
    code: string;
    title: string;
    contactName: string;
    contactPhone: string;
    company: string;
    provider: ChannelProvider | null;
    stageName: string;
    stageColor: string;
    valueCents: number | null;
    status: "won" | "lost" | "open";
    createdAtLabel: string;
    conversationId: string | null;
  }>;
}

export interface AgentTurnResult {
  replyText: string;
  shouldHandoff: boolean;
  handoffReason?: string;
  suppressReply?: boolean;
  smallTalk?: boolean;
  moveToStageId?: string;
  moveToStageName?: string;
  tagsToAdd: string[];
  sentimentScore: number;
  trace: AiTurnTrace;
}

export interface AudioTurnResult {
  ok: boolean;
  transcript: string;
  durationSeconds: number;
  language: string | null;
  exceededAudioLimit: boolean;
  maxAudioSeconds: number;
  handoff: boolean;
  handoffReason?: string;
  replyText?: string;
  turn?: AgentTurnResult;
  error?: string;
  disabled?: boolean;
}
