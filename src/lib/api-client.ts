import type {
  AgentTurnResult,
  AudioTurnResult,
  AiAgentConfig,
  BroadcastCampaign,
  ChannelProvider,
  ChannelSession,
  ConversationStatus,
  DashboardSummary,
  EvolutionAntiBanConfig,
  EvolutionSecretTtl,
  KnowledgeSource,
  Lead,
  LeadTask,
  Message,
  MetaTemplate,
  Organization,
  Pipeline,
  QuickReply,
  RoleDef,
  Stage,
  TeamMember,
  TemplateStatus,
  TenantStateResponse,
  UserRole,
} from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

const TOKEN_STORAGE_KEY = "crm_orbit_token";

export interface AuthSession {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
  activeOrganization: Organization;
  organizations: Organization[];
}

export interface MeResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
  permissions: string[];
  activeOrganization: Organization;
  organizations: Organization[];
}

export class UnauthorizedError extends Error {
  status = 401;
  constructor(message = "Sessão expirada ou não autenticada.") {
    super(message);
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const json = (await res.json()) as { ok: boolean; data?: T; error?: string };
  if (
    res.status === 401 ||
    /Acesso bloqueado a esta organiza|Sess[aã]o expirada|organiza[cç][aã]o recriada/i.test(
      json.error ?? "",
    )
  ) {
    clearStoredToken();
    throw new UnauthorizedError(json.error ?? "Sessão expirada.");
  }
  if (!res.ok || !json.ok) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  return json.data as T;
}

export const apiClient = {
  getHealth(): Promise<{
    ok: boolean;
    service: string;
    postgres?: { connected: boolean; dbMode: string; detail: string };
  }> {
    return fetch(`${API_BASE_URL}/health`, { cache: "no-store" }).then((r) => r.json());
  },

  async login(email: string, password: string): Promise<AuthSession> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = (await res.json()) as { ok: boolean; data?: AuthSession; error?: string };
    if (!res.ok || !json.ok || !json.data) {
      throw new Error(json.error ?? "Falha ao fazer login.");
    }
    setStoredToken(json.data.token);
    return json.data;
  },

  getMe(): Promise<MeResponse> {
    return apiRequest<MeResponse>("/auth/me");
  },

  logout(): void {
    clearStoredToken();
  },

  getState(): Promise<TenantStateResponse> {
    return apiRequest<TenantStateResponse>("/state");
  },

  getDashboard(days = 7): Promise<DashboardSummary> {
    return apiRequest<DashboardSummary>(`/dashboard?days=${days}`);
  },

  updateOrganization(
    targetOrgId: string,
    patch: Partial<Pick<Organization, "routingMode">>,
  ): Promise<void> {
    return apiRequest(`/organizations/${targetOrgId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  createConversation(payload: {
    contactName: string;
    contactPhone: string;
    contactEmail?: string;
    contactCompany?: string;
    channelSessionId: string;
    initialMessage?: string;
    createLead?: boolean;
    leadTitle?: string;
    valueCents?: number;
  }): Promise<{ conversationId: string }> {
    return apiRequest<{ conversationId: string }>("/conversations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  deleteConversation(conversationId: string): Promise<void> {
    return apiRequest(`/conversations/${conversationId}`, { method: "DELETE" });
  },

  sendMessage(
    conversationId: string,
    payload: {
      body: string;
      direction: "inbound" | "outbound" | "internal_note" | "system";
      messageType?: "text" | "template" | "invoice" | "location";
      senderKind?: "contact" | "agent" | "ai" | "system";
      senderName?: string;
      metadata?: Message["metadata"];
    },
  ): Promise<Message> {
    return apiRequest<Message>(`/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  claimConversation(conversationId: string): Promise<void> {
    return apiRequest(`/conversations/${conversationId}/claim`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  transferConversation(
    conversationId: string,
    targetUserId: string | null,
    kind: "user" | "ai",
  ): Promise<void> {
    return apiRequest(`/conversations/${conversationId}/transfer`, {
      method: "POST",
      body: JSON.stringify({ targetUserId, kind }),
    });
  },

  patchConversation(
    conversationId: string,
    patch: { status?: ConversationStatus; aiPaused?: boolean; tags?: string[] },
  ): Promise<void> {
    return apiRequest(`/conversations/${conversationId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  createQuickReply(payload: { shortcut: string; title: string; body: string }): Promise<QuickReply> {
    return apiRequest<QuickReply>("/quick-replies", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  deleteQuickReply(id: string): Promise<void> {
    return apiRequest(`/quick-replies/${id}`, { method: "DELETE" });
  },

  createPipeline(name: string): Promise<Pipeline> {
    return apiRequest<Pipeline>("/pipelines", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  deletePipeline(pipelineId: string): Promise<void> {
    return apiRequest(`/pipelines/${pipelineId}`, { method: "DELETE" });
  },

  createStage(payload: {
    pipelineId: string;
    name: string;
    color: string;
    winProbability: number;
    requiresHuman: boolean;
  }): Promise<Stage> {
    return apiRequest<Stage>("/stages", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  deleteStage(stageId: string): Promise<void> {
    return apiRequest(`/stages/${stageId}`, { method: "DELETE" });
  },

  createLead(payload: {
    pipelineId: string;
    stageId: string;
    title: string;
    contactName: string;
    contactPhone: string;
    company: string;
    valueCents: number;
    ownerUserId: string | null;
  }): Promise<Lead> {
    return apiRequest<Lead>("/leads", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  moveLeadStage(
    leadId: string,
    stageId: string,
    actorName: string,
    lostReason?: string,
  ): Promise<void> {
    return apiRequest(`/leads/${leadId}/stage`, {
      method: "PATCH",
      body: JSON.stringify({ stageId, actorName, lostReason }),
    });
  },

  patchLead(
    leadId: string,
    patch: { valueCents?: number; title?: string; notes?: string; tasks?: LeadTask[] },
  ): Promise<void> {
    return apiRequest(`/leads/${leadId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  deleteLead(leadId: string): Promise<void> {
    return apiRequest(`/leads/${leadId}`, { method: "DELETE" });
  },

  runAiTurn(payload: {
    userMessage: string;
    contactName: string;
    conversationId?: string;
    currentStageId?: string;
    history?: Array<{ role: "user" | "assistant"; text: string }>;
  }): Promise<AgentTurnResult> {
    return apiRequest<AgentTurnResult>("/ai/turn", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  runAiAudioTurn(payload: {
    audioBase64: string;
    mimeType?: string;
    language?: string;
    contactName: string;
    conversationId?: string;
    currentStageId?: string;
    history?: Array<{ role: "user" | "assistant"; text: string }>;
  }): Promise<AudioTurnResult> {
    return apiRequest<AudioTurnResult>("/ai/audio-turn", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateAiAgent(patch: Partial<AiAgentConfig>): Promise<void> {
    return apiRequest("/ai/agent", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  addKnowledgeSource(payload: {
    title: string;
    sourceType: "faq" | "pdf" | "policy" | "catalog";
    content: string;
  }): Promise<KnowledgeSource> {
    return apiRequest<KnowledgeSource>("/ai/knowledge", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  uploadKnowledgeDocument(payload: {
    title?: string;
    fileName: string;
    mimeType?: string;
    dataBase64: string;
  }): Promise<{ source: KnowledgeSource; flaggedCount: number; flaggedLines: string[] }> {
    return apiRequest("/ai/knowledge/upload", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  deleteKnowledgeSource(id: string): Promise<void> {
    return apiRequest(`/ai/knowledge/${id}`, { method: "DELETE" });
  },

  addTeamMember(payload: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    roleId?: string;
  }): Promise<TeamMember> {
    return apiRequest<TeamMember>("/team", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateTeamMember(
    memberId: string,
    patch: {
      role?: UserRole;
      roleId?: string;
      presence?: TeamMember["presence"];
      isActive?: boolean;
      name?: string;
      email?: string;
      password?: string;
      avatarUrl?: string | null;
    },
  ): Promise<void> {
    return apiRequest(`/team/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  deleteTeamMember(memberId: string): Promise<void> {
    return apiRequest(`/team/${memberId}`, { method: "DELETE" });
  },

  createRole(payload: {
    name: string;
    description?: string;
    permissions: string[];
  }): Promise<RoleDef> {
    return apiRequest<RoleDef>("/roles", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateRole(
    roleId: string,
    patch: { name?: string; description?: string; permissions?: string[] },
  ): Promise<void> {
    return apiRequest(`/roles/${roleId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  deleteRole(roleId: string): Promise<void> {
    return apiRequest(`/roles/${roleId}`, { method: "DELETE" });
  },

  createChannel(payload: { provider: ChannelProvider; displayName: string }): Promise<ChannelSession> {
    return apiRequest<ChannelSession>("/channels", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateChannel(channelId: string, patch: Partial<ChannelSession>): Promise<void> {
    return apiRequest(`/channels/${channelId}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
  },

  deleteChannel(channelId: string): Promise<void> {
    return apiRequest(`/channels/${channelId}`, { method: "DELETE" });
  },

  disconnectChannel(channelId: string): Promise<{ status: string }> {
    return apiRequest<{ status: string }>(`/channels/${channelId}/disconnect`, {
      method: "POST",
    });
  },

  getEvolutionQr(channelId: string): Promise<{ status: string; qrImageBase64: string | null }> {
    return apiRequest<{ status: string; qrImageBase64: string | null }>(`/channels/${channelId}/qr`);
  },

  regenerateEvolutionWebhookSecret(
    channelId: string,
    ttl: EvolutionSecretTtl,
  ): Promise<{ secret: string; expiresAt: string | null }> {
    return apiRequest<{ secret: string; expiresAt: string | null }>(
      `/channels/${channelId}/evolution/webhook-secret`,
      { method: "POST", body: JSON.stringify({ ttl }) },
    );
  },

  async testChannelConnection(
    payload:
      | { provider: "evolution"; baseUrl: string; instanceName: string; apiKey?: string }
      | { provider: "meta_cloud"; phoneNumberId: string; wabaId: string; accessToken: string },
  ): Promise<{
    ok: boolean;
    mode?: string;
    status?: string;
    message?: string;
    error?: string;
    displayName?: string;
    phoneNumber?: string;
  }> {
    const token = getStoredToken();
    const res = await fetch(`${API_BASE_URL}/channels/test-connection`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  addMetaTemplate(
    payload: Omit<MetaTemplate, "id" | "organizationId"> & { submitToMeta?: boolean },
  ): Promise<MetaTemplate & { metaSyncStatus?: string }> {
    return apiRequest<MetaTemplate & { metaSyncStatus?: string }>("/meta-templates", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateMetaTemplate(
    id: string,
    patch: { status?: TemplateStatus; headerText?: string; bodyText?: string; footerText?: string },
  ): Promise<void> {
    return apiRequest(`/meta-templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  syncMetaTemplates(channelSessionId: string): Promise<{ imported: number }> {
    return apiRequest<{ imported: number }>("/meta-templates/sync", {
      method: "POST",
      body: JSON.stringify({ channelSessionId }),
    });
  },

  deleteMetaTemplate(id: string): Promise<void> {
    return apiRequest(`/meta-templates/${id}`, { method: "DELETE" });
  },

  createBroadcast(payload: {
    name: string;
    channelSessionId: string;
    messageType?: "text" | "template";
    bodyText?: string;
    templateId?: string;
    templateVariables?: string[];
    recipients: Array<{ name: string; phone: string }>;
    antiBanOverride?: Partial<EvolutionAntiBanConfig>;
    respectBusinessHours?: boolean;
  }): Promise<BroadcastCampaign> {
    return apiRequest<BroadcastCampaign>("/broadcasts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  deleteBroadcast(id: string): Promise<void> {
    return apiRequest(`/broadcasts/${id}`, { method: "DELETE" });
  },

  updateProfileAvatar(avatarUrl: string | null): Promise<void> {
    return apiRequest("/profile/avatar", {
      method: "PATCH",
      body: JSON.stringify({ avatarUrl }),
    });
  },

  updateProfileEmail(email: string): Promise<void> {
    return apiRequest("/profile/email", {
      method: "PATCH",
      body: JSON.stringify({ email }),
    });
  },

  updateProfilePassword(payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<void> {
    return apiRequest("/profile/password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
