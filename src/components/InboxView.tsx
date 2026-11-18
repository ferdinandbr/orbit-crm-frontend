"use client";

import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  Bot,
  CheckCheck,
  CheckSquare,
  Clock,
  FileText,
  Lock,
  MapPin,
  MessageSquare,
  Mic,
  Plus,
  QrCode,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  UserCheck,
  UserPlus,
  X,
  Zap,
} from "lucide-react";
import { AudioBubblePlayer } from "@/components/AudioBubblePlayer";
import { apiClient } from "@/lib/api-client";
import { getChannelCapabilities } from "@/lib/channel-capabilities";
import type {
  AiAgentConfig,
  AssignmentEvent,
  ChannelSession,
  Conversation,
  ConversationStatus,
  Lead,
  Message,
  MetaTemplate,
  QuickReply,
  Stage,
  TeamMember,
} from "@/lib/types";
import { cn, formatCurrencyBRL, getInitials, isMetaWindowOpen, remainingWindowLabel } from "@/lib/utils";

interface InboxViewProps {
  vocabularyLead: string;
  currentUser: TeamMember;
  members: TeamMember[];
  channels: ChannelSession[];
  metaTemplates: MetaTemplate[];
  conversations: Conversation[];
  messages: Message[];
  assignmentEvents: AssignmentEvent[];
  leads: Lead[];
  stages: Stage[];
  aiAgent: AiAgentConfig | undefined;
  quickReplies: QuickReply[];
  selectedConversationId: string | null;
  canCreateConversation?: boolean;
  canDeleteConversation?: boolean;
  canSend?: boolean;
  canClaim?: boolean;
  canTransfer?: boolean;
  canManageQuickReplies?: boolean;
  canViewLeads?: boolean;
  canEditLeads?: boolean;
  canMoveLeads?: boolean;
  onSelectConversation: (id: string | null) => void;
  onOpenKanban: () => void;
  onRefreshState: () => Promise<void>;
  onNotify: (msg: string) => void;
}

export function InboxView({
  vocabularyLead,
  currentUser,
  members,
  channels,
  metaTemplates,
  conversations,
  messages,
  assignmentEvents,
  leads,
  stages,
  aiAgent,
  quickReplies,
  selectedConversationId,
  canCreateConversation = true,
  canDeleteConversation = true,
  canSend = true,
  canClaim = true,
  canTransfer = true,
  canManageQuickReplies = true,
  canViewLeads = true,
  canEditLeads = true,
  canMoveLeads = true,
  onSelectConversation,
  onOpenKanban,
  onRefreshState,
  onNotify,
}: InboxViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "new_request" | "open" | "ai" | "resolved">("all");
  const [channelFilter, setChannelFilter] = useState<"all" | "evolution" | "meta_cloud">("all");
  const [composerMode, setComposerMode] = useState<"whatsapp" | "internal_note">("whatsapp");
  const [draftText, setDraftText] = useState("");
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showTransferMenu, setShowTransferMenu] = useState(false);

  // Modais reais
  const [showNewConvModal, setShowNewConvModal] = useState(false);
  const [ncName, setNcName] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  const [ncEmail, setNcEmail] = useState("");
  const [ncCompany, setNcCompany] = useState("");
  const [ncChannelId, setNcChannelId] = useState(channels[0]?.id ?? "");
  const [ncMessage, setNcMessage] = useState("");
  const [ncCreating, setNcCreating] = useState(false);

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateVar1, setTemplateVar1] = useState("");
  const [templateVar2, setTemplateVar2] = useState("");

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invCode, setInvCode] = useState("");
  const [invDesc, setInvDesc] = useState("");
  const [invReais, setInvReais] = useState("");

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locAddress, setLocAddress] = useState("");
  const [locCaption, setLocCaption] = useState("");

  const [showQuickReplyModal, setShowQuickReplyModal] = useState(false);
  const [qrShortcut, setQrShortcut] = useState("");
  const [qrTitle, setQrTitle] = useState("");
  const [qrBody, setQrBody] = useState("");

  const [newTagInput, setNewTagInput] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [aiRunning, setAiRunning] = useState(false);
  const [editingValue, setEditingValue] = useState(false);
  const [valueInput, setValueInput] = useState("");

  const newRequestsCount = useMemo(
    () => conversations.filter((c) => c.status === "new_request").length,
    [conversations],
  );
  const aiCount = useMemo(
    () => conversations.filter((c) => c.assigneeKind === "ai" && c.status !== "resolved").length,
    [conversations],
  );

  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      if (channelFilter !== "all" && conv.provider !== channelFilter) return false;
      if (statusFilter === "new_request" && conv.status !== "new_request") return false;
      if (statusFilter === "open" && conv.status !== "open") return false;
      if (statusFilter === "ai" && (conv.assigneeKind !== "ai" || conv.status === "resolved")) return false;
      if (statusFilter === "resolved" && conv.status !== "resolved") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          conv.contactName.toLowerCase().includes(q) ||
          conv.contactPhone.toLowerCase().includes(q) ||
          conv.lastMessagePreview.toLowerCase().includes(q) ||
          conv.contactCompany.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [conversations, channelFilter, statusFilter, searchQuery]);

  const activeConv = useMemo(() => {
    return (
      conversations.find((c) => c.id === selectedConversationId) ??
      filteredConversations[0] ??
      conversations[0] ??
      null
    );
  }, [conversations, selectedConversationId, filteredConversations]);

  const activeChannel = useMemo(
    () => channels.find((ch) => ch.id === activeConv?.channelSessionId),
    [channels, activeConv],
  );

  const activeCapabilities = activeConv ? getChannelCapabilities(activeConv.provider) : null;
  const metaWindowOpen = activeConv
    ? activeConv.provider === "evolution" || isMetaWindowOpen(activeConv.metaWindowExpiresAt)
    : true;

  const activeMessages = useMemo(
    () => messages.filter((m) => m.conversationId === activeConv?.id),
    [messages, activeConv],
  );

  const activeLead = useMemo(
    () => leads.find((l) => l.conversationId === activeConv?.id) ?? null,
    [leads, activeConv],
  );

  const activeEvents = useMemo(
    () => assignmentEvents.filter((ev) => ev.conversationId === activeConv?.id),
    [assignmentEvents, activeConv],
  );

  const approvedTemplates = useMemo(
    () =>
      metaTemplates.filter(
        (t) =>
          t.status === "APPROVED" &&
          (!activeConv || t.channelSessionId === activeConv.channelSessionId || t.organizationId === activeConv.organizationId),
      ),
    [metaTemplates, activeConv],
  );

  const lastAiTrace = useMemo(() => {
    for (let i = activeMessages.length - 1; i >= 0; i -= 1) {
      if (activeMessages[i].metadata?.aiTrace) {
        return activeMessages[i].metadata?.aiTrace;
      }
    }
    return null;
  }, [activeMessages]);

  const getAssigneeLabel = (conv: Conversation) => {
    if (conv.assigneeKind === "ai") {
      return { label: `IA: ${aiAgent?.name ?? "Agente IA"}`, isAi: true, isUnassigned: false };
    }
    if (conv.assignedToUserId) {
      const m = members.find((u) => u.id === conv.assignedToUserId);
      return { label: `Atendente: ${m?.name ?? "Equipe"}`, isAi: false, isUnassigned: false };
    }
    return { label: "Aguardando atendimento", isAi: false, isUnassigned: true };
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeConv || !draftText.trim()) return;
    if (composerMode === "whatsapp" && activeCapabilities?.requiresTemplates && !metaWindowOpen) {
      setShowTemplateModal(true);
      return;
    }

    try {
      await apiClient.sendMessage(activeConv.id, {
        body: draftText.trim(),
        direction: composerMode === "internal_note" ? "internal_note" : "outbound",
        messageType: "text",
        senderKind: "agent",
        senderName: currentUser.name,
      });
      setDraftText("");
      await onRefreshState();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Erro ao enviar mensagem");
    }
  };

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetChannelId = ncChannelId || channels[0]?.id;
    if (!targetChannelId || !ncName.trim() || !ncPhone.trim()) return;
    setNcCreating(true);
    try {
      const res = await apiClient.createConversation({
        contactName: ncName.trim(),
        contactPhone: ncPhone.trim(),
        contactEmail: ncEmail.trim(),
        contactCompany: ncCompany.trim(),
        channelSessionId: targetChannelId,
        initialMessage: ncMessage.trim() || undefined,
      });
      setShowNewConvModal(false);
      setNcName("");
      setNcPhone("");
      setNcEmail("");
      setNcCompany("");
      setNcMessage("");
      onSelectConversation(res.conversationId);
      await onRefreshState();
      onNotify("Conversa criada.");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Erro ao criar conversa.");
    } finally {
      setNcCreating(false);
    }
  };

  const handleTriggerAiReply = async () => {
    if (!activeConv || !aiAgent || aiRunning) return;
    setAiRunning(true);
    try {
      const lastInbound =
        [...activeMessages].reverse().find((m) => m.direction === "inbound")?.body ??
        activeConv.lastMessagePreview;

      await apiClient.runAiTurn({
        userMessage: lastInbound,
        contactName: activeConv.contactName,
        conversationId: activeConv.id,
        currentStageId: activeLead?.stageId,
      });
      await onRefreshState();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Erro ao executar Agente de IA.");
    } finally {
      setAiRunning(false);
    }
  };

  const handleSendMetaTemplate = async () => {
    if (!activeConv) return;
    const tpl = approvedTemplates.find((t) => t.id === selectedTemplateId) ?? approvedTemplates[0];
    if (!tpl) return;
    const var1 = templateVar1 || activeConv.contactName.split(" ")[0];
    const var2 = templateVar2 || activeLead?.title || "";
    const rendered = tpl.bodyText.replace("{{1}}", var1).replace("{{2}}", var2);
    const vars = [var1, var2].filter((v) => v.trim().length > 0);

    try {
      await apiClient.sendMessage(activeConv.id, {
        body: rendered,
        direction: "outbound",
        messageType: "template",
        senderKind: "agent",
        senderName: currentUser.name,
        metadata: {
          templateName: tpl.name,
          templateLanguage: tpl.language,
          templateVariables: vars,
        },
      });
      setShowTemplateModal(false);
      setTemplateVar1("");
      setTemplateVar2("");
      await onRefreshState();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Erro ao disparar template.");
    }
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 bg-slate-50 lg:grid-cols-[340px_1fr_330px]">
      {/* =================================================================== */}
      {/* COLUNA 1: CONVERSAS                                                 */}
      {/* =================================================================== */}
      <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Conversas</h2>
            {canCreateConversation && (
              <button
                type="button"
                onClick={() => {
                  setNcChannelId(channels[0]?.id ?? "");
                  setShowNewConvModal(true);
                }}
                className="inline-flex items-center gap-1 rounded-xl bg-[#16A34A] px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                <Plus className="h-3.5 w-3.5" /> Nova Conversa
              </button>
            )}
          </div>

          <div className="mt-2.5 flex items-center gap-1 rounded-full bg-slate-100 p-0.5 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setChannelFilter("all")}
              className={cn(
                "flex-1 rounded-full py-1 transition",
                channelFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600",
              )}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setChannelFilter("evolution")}
              className={cn(
                "flex-1 rounded-full py-1 transition",
                channelFilter === "evolution" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600",
              )}
            >
              Evolution
            </button>
            <button
              type="button"
              onClick={() => setChannelFilter("meta_cloud")}
              className={cn(
                "flex-1 rounded-full py-1 transition",
                channelFilter === "meta_cloud" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600",
              )}
            >
              Meta API
            </button>
          </div>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar contato, telefone ou empresa..."
              className="w-full rounded-xl border border-slate-200 bg-slate-100/80 py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition",
                statusFilter === "all"
                  ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70",
              )}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("new_request")}
              className={cn(
                "relative inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition",
                statusFilter === "new_request"
                  ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70",
              )}
            >
              Novas
              {newRequestsCount > 0 && <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("open")}
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition",
                statusFilter === "open"
                  ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70",
              )}
            >
              Abertas
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ai")}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition",
                statusFilter === "ai"
                  ? "bg-violet-100 text-violet-800 ring-1 ring-violet-300"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70",
              )}
            >
              <Bot className="h-3 w-3" />
              IA ({aiCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("resolved")}
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition",
                statusFilter === "resolved"
                  ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70",
              )}
            >
              Resolvidas
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-xs font-semibold text-slate-500">
          <span>Resultados ({filteredConversations.length})</span>
          <span className="text-[11px] font-normal text-slate-400">Sincronizado</span>
        </div>

        <div className="thin-scrollbar flex-1 divide-y divide-slate-100 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <MessageSquare className="h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-600">Nenhuma conversa cadastrada</p>
              {canCreateConversation && (
                <button
                  type="button"
                  onClick={() => {
                    setNcChannelId(channels[0]?.id ?? "");
                    setShowNewConvModal(true);
                  }}
                  className="mt-3 inline-flex items-center gap-1 rounded-xl bg-[#16A34A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Iniciar primeira conversa
                </button>
              )}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const assignee = getAssigneeLabel(conv);
              const isSelected = activeConv?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => onSelectConversation(conv.id)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3.5 text-left transition",
                    isSelected ? "border-l-4 border-l-emerald-600 bg-emerald-50/70" : "hover:bg-slate-50",
                  )}
                >
                  <div className="relative shrink-0">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
                      style={{ backgroundColor: conv.avatarBg }}
                    >
                      {getInitials(conv.contactName)}
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-slate-900">{conv.contactName}</span>
                      <span className="shrink-0 text-[11px] font-medium text-slate-400">
                        {conv.lastMessageTime}
                      </span>
                    </div>

                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-600">
                      {conv.lastMessagePreview}
                    </p>

                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
                      <span>Tempo resp.: {conv.responseTimeMinutes} min</span>
                      <span>|</span>
                      <span>
                        Há:{" "}
                        {conv.minutesSinceLastMsg >= 60
                          ? `${Math.floor(conv.minutesSinceLastMsg / 60)}h`
                          : `${conv.minutesSinceLastMsg} min`}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                          assignee.isAi
                            ? "bg-violet-100 text-violet-800"
                            : assignee.isUnassigned
                              ? "bg-amber-100 text-amber-800"
                              : "bg-[#DCFCE7] text-[#15803D]",
                        )}
                      >
                        {assignee.isAi ? <Bot className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                        {assignee.label}
                      </span>

                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                          conv.provider === "evolution" ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-blue-700",
                        )}
                      >
                        {conv.provider === "evolution" ? (
                          <>
                            <QrCode className="h-2.5 w-2.5" /> Evolution
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-2.5 w-2.5" /> Meta API
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* =================================================================== */}
      {/* COLUNA 2: THREAD WHATSAPP                                           */}
      {/* =================================================================== */}
      {activeConv ? (
        <section className="flex min-h-0 flex-col bg-[#EFEAE2]">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: activeConv.avatarBg }}
              >
                {getInitials(activeConv.contactName)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">{activeConv.contactName}</h3>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      activeConv.provider === "evolution"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-blue-200 bg-blue-50 text-blue-700",
                    )}
                  >
                    {activeConv.provider === "evolution" ? "Conexão por QR Code" : "Conexão oficial"}
                  </span>
                  {activeConv.provider === "meta_cloud" && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        metaWindowOpen ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800",
                      )}
                    >
                      <Clock className="h-2.5 w-2.5" />
                      {remainingWindowLabel(activeConv.metaWindowExpiresAt)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {activeConv.contactPhone} · {activeChannel?.displayName ?? "Canal WhatsApp"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                  activeConv.assigneeKind === "ai"
                    ? "bg-violet-100 text-violet-800"
                    : activeConv.assignedToUserId
                      ? "bg-[#DCFCE7] text-[#15803D]"
                      : "bg-amber-100 text-amber-800",
                )}
              >
                {activeConv.assigneeKind === "ai" ? (
                  <>
                    <Bot className="h-3.5 w-3.5" /> IA: {aiAgent?.name}
                  </>
                ) : activeConv.assignedToUserId ? (
                  <>
                    <UserCheck className="h-3.5 w-3.5" />
                    {members.find((m) => m.id === activeConv.assignedToUserId)?.name ?? "Atendente"}
                  </>
                ) : (
                  "Sem atendente"
                )}
              </span>

              {canClaim && activeConv.assignedToUserId !== currentUser.id && (
                <button
                  type="button"
                  onClick={async () => {
                    await apiClient.claimConversation(activeConv.id);
                    await onRefreshState();
                    onNotify("Conversa assumida!");
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Eu cuido
                </button>
              )}

              {canTransfer && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTransferMenu((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Transferir
                  </button>
                  {showTransferMenu && (
                    <div className="absolute right-0 z-30 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Transferir conversa para
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiClient.transferConversation(activeConv.id, null, "ai");
                          setShowTransferMenu(false);
                          await onRefreshState();
                          onNotify("Transferida para Agente de IA.");
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-violet-700 hover:bg-violet-50"
                      >
                        <Bot className="h-3.5 w-3.5" />
                        {aiAgent?.name ?? "Agente de IA"}
                      </button>
                      {members.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={async () => {
                            await apiClient.transferConversation(activeConv.id, m.id, "user");
                            setShowTransferMenu(false);
                            await onRefreshState();
                            onNotify(`Transferida para ${m.name}.`);
                          }}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"
                        >
                          <span className="font-medium">{m.name}</span>
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              m.presence === "online"
                                ? "bg-emerald-500"
                                : m.presence === "busy"
                                  ? "bg-amber-500"
                                  : "bg-slate-300",
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {canSend && (
                <button
                  type="button"
                  onClick={async () => {
                    await apiClient.patchConversation(activeConv.id, {
                      status: activeConv.status === "resolved" ? "open" : "resolved",
                    });
                    await onRefreshState();
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {activeConv.status === "resolved" ? "Reabrir" : "Resolver"}
                </button>
              )}

              {canDeleteConversation && (
                <button
                  type="button"
                  onClick={async () => {
                    await apiClient.deleteConversation(activeConv.id);
                    onSelectConversation(null);
                    await onRefreshState();
                    onNotify("Conversa excluída.");
                  }}
                  title="Excluir conversa"
                  className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </header>

          {/* Mensagens */}
          <div className="whatsapp-canvas-bg thin-scrollbar flex-1 space-y-3 overflow-y-auto p-4 md:p-6">
            <div className="flex justify-center">
              <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm">
                Canal: {activeCapabilities?.label}
              </span>
            </div>

            {activeMessages.length === 0 && (
              <div className="flex justify-center pt-6">
                <span className="rounded-xl bg-white/90 px-4 py-2 text-xs text-slate-500 shadow-sm">
                  Nenhuma mensagem nesta conversa ainda. Envie uma mensagem abaixo ou acione a IA.
                </span>
              </div>
            )}

            {activeMessages.map((msg) => {
              if (msg.direction === "system") {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <span className="rounded-full bg-slate-800/10 px-3 py-1 text-[11px] font-medium text-slate-700 backdrop-blur-sm">
                      {msg.body} · {msg.timestampLabel}
                    </span>
                  </div>
                );
              }

              if (msg.direction === "internal_note") {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <div className="w-full max-w-lg rounded-xl border border-amber-300 bg-amber-50/95 px-4 py-2.5 shadow-sm">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-amber-800">
                        <span className="inline-flex items-center gap-1">
                          <Lock className="h-3 w-3" /> Nota Interna · {msg.senderName}
                        </span>
                        <span>{msg.timestampLabel}</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-amber-950">{msg.body}</p>
                    </div>
                  </div>
                );
              }

              const isInbound = msg.direction === "inbound";

              return (
                <div key={msg.id} className={cn("flex", isInbound ? "justify-start" : "justify-end")}>
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl px-3.5 py-2.5 shadow-sm",
                      isInbound
                        ? "rounded-tl-sm bg-white text-slate-900"
                        : "rounded-tr-sm bg-[#D9FDD3] text-slate-900",
                    )}
                  >
                    {!isInbound && (
                      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800/80">
                        {msg.senderKind === "ai" ? (
                          <>
                            <Bot className="h-3 w-3 text-violet-700" />
                            <span className="text-violet-700">{msg.senderName} (IA)</span>
                          </>
                        ) : (
                          <span>{msg.senderName}</span>
                        )}
                        {msg.messageType === "template" && (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] text-blue-800">
                            Template Meta: {msg.metadata?.templateName}
                          </span>
                        )}
                      </div>
                    )}

                    {msg.messageType === "invoice" && msg.metadata && (
                      <div className="mb-2 rounded-xl border border-emerald-200 bg-white/90 p-3">
                        <div className="flex items-center justify-between gap-4">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                            <FileText className="h-3.5 w-3.5" /> {msg.metadata.invoiceCode}
                          </span>
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                            {msg.metadata.invoiceStatus}
                          </span>
                        </div>
                        <p className="mt-1 text-base font-bold text-slate-900">
                          {formatCurrencyBRL(msg.metadata.invoiceAmountCents ?? 0)}
                        </p>
                      </div>
                    )}

                    {msg.messageType === "location" && msg.metadata && (
                      <div className="mb-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 p-2.5 text-xs text-slate-700">
                        <MapPin className="h-4 w-4 shrink-0 text-red-500" />
                        <span>{msg.metadata.locationAddress}</span>
                      </div>
                    )}

                    {msg.messageType === "audio" && (
                      <div className="mb-1.5">
                        {msg.metadata?.audioUrl ? (
                          <AudioBubblePlayer
                            src={msg.metadata.audioUrl}
                            durationSeconds={msg.metadata?.audioDurationSeconds}
                          />
                        ) : (
                          <div className="flex items-center gap-2 py-0.5">
                            <Mic className="h-4 w-4 shrink-0 text-emerald-600" />
                            <span className="text-xs text-slate-500">Mensagem de voz</span>
                            {typeof msg.metadata?.audioDurationSeconds === "number" &&
                              msg.metadata.audioDurationSeconds > 0 && (
                                <span className="text-[10px] text-slate-400">
                                  {Math.floor(msg.metadata.audioDurationSeconds / 60)}:
                                  {String(Math.round(msg.metadata.audioDurationSeconds % 60)).padStart(2, "0")}
                                </span>
                              )}
                          </div>
                        )}
                        {msg.metadata?.transcriptionStatus === "processing" ? (
                          <p className="mt-1 text-xs italic text-slate-500">transcrevendo áudio…</p>
                        ) : msg.metadata?.transcriptionStatus === "error" ? (
                          <p className="mt-1 text-xs italic text-slate-400">transcrição indisponível</p>
                        ) : (
                          (msg.metadata?.audioTranscript || msg.body) && (
                            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
                              <span className="font-semibold text-slate-400">Transcrição: </span>
                              <span className="italic">{msg.metadata?.audioTranscript || msg.body}</span>
                            </p>
                          )
                        )}
                      </div>
                    )}

                    {msg.messageType !== "audio" && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.body}</p>
                    )}

                    {msg.metadata?.aiTrace && (
                      <div className="mt-2 rounded-lg bg-white/75 px-2.5 py-1.5 text-[10px] text-slate-600">
                        <span className="font-semibold text-violet-700">
                          Base usada: {msg.metadata.aiTrace.ragSourcesUsed.join(", ") || "conhecimento geral"}
                        </span>
                        {msg.metadata.aiTrace.mcpToolsCalled.length > 0 && (
                          <span className="ml-2 text-emerald-700">
                            · Ações: {msg.metadata.aiTrace.mcpToolsCalled.map((t) => t.summary).join("; ")}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500">
                      <span>{msg.timestampLabel}</span>
                      {!isInbound && <CheckCheck className="h-3.5 w-3.5 text-sky-600" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {activeCapabilities?.requiresTemplates && !metaWindowOpen && (
            <div className="border-t border-amber-200 bg-amber-50 px-4 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-amber-900">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    <strong>Regra da Meta (Janela 24h fechada):</strong> Aguardando resposta do cliente ou janela expirada. Dispare um <strong>Template APPROVED</strong>.
                  </span>
                </div>
                {canSend && (
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(true)}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    Enviar Template da Meta
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Composer */}
          {canSend ? (
            <footer className="border-t border-slate-200 bg-white p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setComposerMode("whatsapp")}
                    className={cn(
                      "rounded-md px-2.5 py-1 transition",
                      composerMode === "whatsapp" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600",
                    )}
                  >
                    Mensagem WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setComposerMode("internal_note")}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2.5 py-1 transition",
                      composerMode === "internal_note" ? "bg-amber-100 text-amber-900 shadow-sm" : "text-slate-600",
                    )}
                  >
                    <Lock className="h-3 w-3" /> Nota Interna
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleTriggerAiReply}
                  disabled={aiRunning || !aiAgent}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {aiRunning ? "Gerando resposta..." : "Responder com o assistente"}
                </button>
              </div>

              <form onSubmit={handleSend} className="relative flex items-end gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowActionsMenu((v) => !v)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    title="Ações rápidas de atendimento"
                  >
                    <Plus className="h-5 w-5" />
                  </button>

                  {showActionsMenu && (
                    <div className="absolute bottom-12 left-0 z-30 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Ações de Atendimento
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTemplateModal(true);
                          setShowActionsMenu(false);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-emerald-50"
                      >
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                        <div>
                          <div>Enviar Template da Meta</div>
                          <div className="text-[10px] text-slate-400">Somente templates APPROVED</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setInvCode("");
                          setInvDesc("");
                          setInvReais(activeLead ? (activeLead.valueCents / 100).toString() : "");
                          setShowInvoiceModal(true);
                          setShowActionsMenu(false);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-emerald-50"
                      >
                        <FileText className="h-4 w-4 text-emerald-600" />
                        <div>
                          <div>Enviar Fatura / Proposta</div>
                          <div className="text-[10px] text-slate-400">Informar valor e descrição</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowLocationModal(true);
                          setShowActionsMenu(false);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-emerald-50"
                      >
                        <MapPin className="h-4 w-4 text-red-500" />
                        <div>
                          <div>Enviar Localização</div>
                          <div className="text-[10px] text-slate-400">Informar endereço</div>
                        </div>
                      </button>

                      <div className="my-1 border-t border-slate-100" />
                      <div className="flex items-center justify-between px-2 py-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Respostas Rápidas ({quickReplies.length})
                        </span>
                        {canManageQuickReplies && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowQuickReplyModal(true);
                              setShowActionsMenu(false);
                            }}
                            className="text-[10px] font-bold text-emerald-700 hover:underline"
                          >
                            + Nova
                          </button>
                        )}
                      </div>
                      {quickReplies.map((qr) => (
                        <div
                          key={qr.id}
                          className="flex items-center justify-between rounded-xl px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setDraftText(qr.body);
                              setShowActionsMenu(false);
                            }}
                            className="flex flex-1 items-center justify-between text-left"
                          >
                            <span className="font-medium">{qr.title}</span>
                            <code className="text-[10px] text-emerald-700">{qr.shortcut}</code>
                          </button>
                          {canManageQuickReplies && (
                            <button
                              type="button"
                              onClick={async () => {
                                await apiClient.deleteQuickReply(qr.id);
                                await onRefreshState();
                              }}
                              className="ml-2 text-slate-300 hover:text-red-600"
                              title="Excluir resposta rápida"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative flex-1">
                  <textarea
                    rows={1}
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={
                      composerMode === "internal_note"
                        ? "Escreva uma nota interna para a equipe..."
                        : activeCapabilities?.requiresTemplates && !metaWindowOpen
                          ? "Janela 24h expirada — envie um Template Meta"
                          : "Digite sua mensagem no WhatsApp..."
                    }
                    className={cn(
                      "w-full resize-none rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none",
                      composerMode === "internal_note"
                        ? "border-amber-300 bg-amber-50/70 placeholder:text-amber-700/60"
                        : "border-slate-200 bg-slate-50 focus:border-emerald-500 focus:bg-white",
                    )}
                  />
                </div>

                <button
                  type="submit"
                  className={cn(
                    "flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white shadow-sm transition",
                    composerMode === "internal_note" ? "bg-amber-600 hover:bg-amber-700" : "bg-[#16A34A] hover:bg-emerald-700",
                  )}
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Enviar</span>
                </button>
              </form>
            </footer>
          ) : (
            <footer className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs font-medium text-slate-500">
              Visualização somente leitura — seu perfil não possui permissão para enviar mensagens.
            </footer>
          )}
        </section>
      ) : (
        <div className="flex flex-col items-center justify-center bg-[#EFEAE2] p-6 text-center text-sm text-slate-600">
          <MessageSquare className="h-10 w-10 text-slate-400" />
          <p className="mt-3 font-semibold">Nenhuma conversa selecionada</p>
          <p className="mt-1 text-xs text-slate-500">
            Crie uma nova conversa pelo botão acima ou conecte uma conta nas Configurações.
          </p>
        </div>
      )}

      {/* =================================================================== */}
      {/* COLUNA 3: DOSSIÊ CRM 360                                            */}
      {/* =================================================================== */}
      {activeConv && (
        <aside className="thin-scrollbar hidden min-h-0 flex-col overflow-y-auto border-l border-slate-200 bg-white p-4 lg:flex">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Dossiê CRM 360</h4>
              <p className="text-sm font-bold text-slate-900">{activeConv.contactCompany || activeConv.contactName}</p>
            </div>
            {canViewLeads && (
              <button
                type="button"
                onClick={onOpenKanban}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                Kanban
              </button>
            )}
          </div>

          {activeLead ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">{vocabularyLead} vinculado</span>
                {canEditLeads && editingValue ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const numeric = Number(valueInput.replace(",", ".")) * 100;
                      if (!Number.isNaN(numeric) && numeric >= 0) {
                        await apiClient.patchLead(activeLead.id, { valueCents: Math.round(numeric) });
                        await onRefreshState();
                      }
                      setEditingValue(false);
                    }}
                    className="flex items-center gap-1"
                  >
                    <input
                      type="text"
                      value={valueInput}
                      onChange={(e) => setValueInput(e.target.value)}
                      className="w-20 rounded border border-emerald-400 bg-white px-1.5 py-0.5 text-xs font-bold"
                      autoFocus
                    />
                    <button type="submit" className="text-[11px] font-bold text-emerald-600">
                      OK
                    </button>
                  </form>
                ) : canEditLeads ? (
                  <button
                    type="button"
                    onClick={() => {
                      setValueInput((activeLead.valueCents / 100).toString());
                      setEditingValue(true);
                    }}
                    className="text-sm font-bold text-emerald-700 hover:underline"
                    title="Clique para editar valor"
                  >
                    {formatCurrencyBRL(activeLead.valueCents)}
                  </button>
                ) : (
                  <span className="text-sm font-bold text-emerald-700">
                    {formatCurrencyBRL(activeLead.valueCents)}
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm font-bold text-slate-900">{activeLead.title}</p>

              <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Etapa do Funil
              </label>
              <select
                disabled={!canMoveLeads}
                value={activeLead.stageId}
                onChange={async (e) => {
                  await apiClient.moveLeadStage(activeLead.id, e.target.value, currentUser.name);
                  await onRefreshState();
                  onNotify("Etapa do funil atualizada.");
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              >
                {stages
                  .filter((s) => s.pipelineId === activeLead.pipelineId)
                  .sort((a, b) => a.position - b.position)
                  .map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name} {stage.requiresHuman ? "(Exige Humano)" : ""}
                    </option>
                  ))}
              </select>

              {/* Tarefas reais do negócio */}
              <div className="mt-3 border-t border-slate-200/70 pt-2.5">
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                  <CheckSquare className="h-3.5 w-3.5 text-emerald-600" /> Tarefas ({activeLead.tasks.length})
                </div>
                <div className="mt-1.5 space-y-1">
                  {activeLead.tasks.map((task) => (
                    <label key={task.id} className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        disabled={!canEditLeads}
                        checked={task.done}
                        onChange={async () => {
                          const nextTasks = activeLead.tasks.map((t) =>
                            t.id === task.id ? { ...t, done: !t.done } : t,
                          );
                          await apiClient.patchLead(activeLead.id, { tasks: nextTasks });
                          await onRefreshState();
                        }}
                        className="accent-emerald-600 disabled:cursor-not-allowed"
                      />
                      <span className={task.done ? "line-through text-slate-400" : ""}>{task.title}</span>
                    </label>
                  ))}
                </div>
                {canEditLeads && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newTaskTitle.trim()) return;
                      const nextTasks = [
                        ...activeLead.tasks,
                        {
                          id: crypto.randomUUID(),
                          title: newTaskTitle.trim(),
                          done: false,
                          dueDate: new Date().toLocaleDateString("pt-BR"),
                        },
                      ];
                      await apiClient.patchLead(activeLead.id, { tasks: nextTasks });
                      setNewTaskTitle("");
                      await onRefreshState();
                    }}
                    className="mt-2 flex gap-1"
                  >
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Nova tarefa..."
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-semibold text-white"
                    >
                      +
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-3 text-center text-xs text-slate-500">
              Nenhum negócio vinculado ainda.
            </div>
          )}

          {/* Controle do Agente de IA */}
          <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 p-3.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-900">
                <Bot className="h-4 w-4 text-violet-600" />
                Agente de IA na Conversa
              </span>
              {canSend ? (
                <button
                  type="button"
                  onClick={async () => {
                    await apiClient.patchConversation(activeConv.id, { aiPaused: !activeConv.aiPaused });
                    await onRefreshState();
                  }}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-bold transition",
                    activeConv.aiPaused ? "bg-slate-200 text-slate-700" : "bg-violet-600 text-white",
                  )}
                >
                  {activeConv.aiPaused ? "Pausada" : "Ativa"}
                </button>
              ) : (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                    activeConv.aiPaused ? "bg-slate-200 text-slate-700" : "bg-violet-600 text-white",
                  )}
                >
                  {activeConv.aiPaused ? "Pausada" : "Ativa"}
                </span>
              )}
            </div>

            <div className="mt-2.5 flex items-center justify-between text-xs">
              <span className="text-slate-600">Sentimento detectado:</span>
              <span
                className={cn(
                  "font-bold",
                  activeConv.sentimentScore >= 0.7
                    ? "text-emerald-700"
                    : activeConv.sentimentScore >= 0.4
                      ? "text-amber-700"
                      : "text-red-600",
                )}
              >
                {Math.round(activeConv.sentimentScore * 100)}% positivo
              </span>
            </div>

            {lastAiTrace && (
              <div className="mt-2 rounded-lg bg-white p-2 text-[11px] text-slate-600 shadow-sm">
                <div className="font-semibold text-slate-800">Última resposta do assistente:</div>
                <div className="mt-0.5">Base usada: {lastAiTrace.ragSourcesUsed.join(", ") || "conhecimento geral"}</div>
                {lastAiTrace.handoffTriggered && (
                  <div className="mt-1 font-semibold text-amber-700">Transferido para atendente</div>
                )}
              </div>
            )}
          </div>

          {/* Etiquetas */}
          <div className="mt-4">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Tag className="h-3.5 w-3.5" /> Etiquetas
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {activeConv.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                >
                  {tag}
                  {canSend && (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiClient.patchConversation(activeConv.id, {
                          tags: activeConv.tags.filter((t) => t !== tag),
                        });
                        await onRefreshState();
                      }}
                      className="text-slate-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
            {canSend && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newTagInput.trim()) return;
                  if (!activeConv.tags.includes(newTagInput.trim())) {
                    await apiClient.patchConversation(activeConv.id, {
                      tags: [...activeConv.tags, newTagInput.trim()],
                    });
                    await onRefreshState();
                  }
                  setNewTagInput("");
                }}
                className="mt-2 flex gap-1.5"
              >
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="Adicionar etiqueta..."
                  className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-900"
                >
                  +
                </button>
              </form>
            )}
          </div>

          {/* Auditoria */}
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h5 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Zap className="h-3.5 w-3.5" /> Auditoria de Atendimento
            </h5>
            <div className="mt-2 space-y-2">
              {activeEvents.length === 0 ? (
                <p className="text-xs text-slate-400">Sem transferências registradas ainda.</p>
              ) : (
                activeEvents.map((ev) => (
                  <div key={ev.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-[11px]">
                    <div className="font-semibold text-slate-800">
                      {ev.fromName} → {ev.toName}
                    </div>
                    <div className="mt-0.5 text-slate-500">
                      Motivo: <code className="font-mono text-emerald-700">{ev.reason}</code> · {ev.timestampLabel}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      )}

      {/* =================================================================== */}
      {/* MODAIS REAIS (Nova Conversa, Template Meta, Fatura, Local, QuickReply)*/}
      {/* =================================================================== */}
      {showNewConvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={handleCreateConversation} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Iniciar Nova Conversa</h3>
              <button type="button" onClick={() => setShowNewConvModal(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Nome do Contato *</label>
                <input
                  type="text"
                  required
                  value={ncName}
                  onChange={(e) => setNcName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700">WhatsApp (com DDI) *</label>
                  <input
                    type="text"
                    required
                    value={ncPhone}
                    onChange={(e) => setNcPhone(e.target.value)}
                    placeholder="+5511999999999"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Empresa</label>
                  <input
                    type="text"
                    value={ncCompany}
                    onChange={(e) => setNcCompany(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700">E-mail</label>
                  <input
                    type="email"
                    value={ncEmail}
                    onChange={(e) => setNcEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Canal WhatsApp *</label>
                  <select
                    value={ncChannelId || channels[0]?.id || ""}
                    onChange={(e) => setNcChannelId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold"
                  >
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.displayName} ({ch.provider === "evolution" ? "Evolution" : "Meta"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Primeira Mensagem (Opcional)</label>
                <textarea
                  rows={2}
                  value={ncMessage}
                  onChange={(e) => setNcMessage(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewConvModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={ncCreating}
                className="rounded-xl bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {ncCreating ? "Salvando..." : "Criar Conversa"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Disparar Template Oficial da Meta</h3>
                <p className="text-xs text-slate-500">
                  Apenas templates com status <span className="font-bold text-emerald-700">APPROVED</span> podem ser disparados.
                </p>
              </div>
              <button type="button" onClick={() => setShowTemplateModal(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <select
                value={selectedTemplateId || approvedTemplates[0]?.id || ""}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {approvedTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.category} · {tpl.language})
                  </option>
                ))}
              </select>

              {(() => {
                const tpl = approvedTemplates.find((t) => t.id === selectedTemplateId) ?? approvedTemplates[0];
                if (!tpl) {
                  return (
                    <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                      Nenhum template APPROVED encontrado. Cadastre ou sincronize em Configurações → API Oficial da Meta.
                    </p>
                  );
                }
                return (
                  <>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                      {tpl.bodyText}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={templateVar1}
                        onChange={(e) => setTemplateVar1(e.target.value)}
                        placeholder="Variável {{1}}"
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        value={templateVar2}
                        onChange={(e) => setTemplateVar2(e.target.value)}
                        placeholder="Variável {{2}}"
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSendMetaTemplate}
                disabled={approvedTemplates.length === 0}
                className="rounded-xl bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Disparar Template
              </button>
            </div>
          </div>
        </div>
      )}

      {showInvoiceModal && activeConv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const cents = Math.round((Number(invReais.replace(",", ".")) || 0) * 100);
              await apiClient.sendMessage(activeConv.id, {
                body: invDesc.trim(),
                direction: "outbound",
                messageType: "invoice",
                senderKind: "agent",
                senderName: currentUser.name,
                metadata: {
                  invoiceCode: invCode.trim() || `FAT-${Date.now().toString().slice(-4)}`,
                  invoiceAmountCents: cents,
                  invoiceStatus: "Aguardando pagamento",
                },
              });
              setShowInvoiceModal(false);
              await onRefreshState();
            }}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
          >
            <h3 className="text-base font-bold text-slate-900">Enviar Proposta / Fatura</h3>
            <div className="mt-3 space-y-3">
              <input
                type="text"
                value={invCode}
                onChange={(e) => setInvCode(e.target.value)}
                placeholder="Código (ex.: PROP-001)"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="text"
                required
                value={invReais}
                onChange={(e) => setInvReais(e.target.value)}
                placeholder="Valor em R$ (ex.: 1500.00)"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <textarea
                rows={2}
                required
                value={invDesc}
                onChange={(e) => setInvDesc(e.target.value)}
                placeholder="Descrição do item ou serviço"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowInvoiceModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white"
              >
                Enviar
              </button>
            </div>
          </form>
        </div>
      )}

      {showLocationModal && activeConv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await apiClient.sendMessage(activeConv.id, {
                body: locCaption.trim() || "Localização compartilhada:",
                direction: "outbound",
                messageType: "location",
                senderKind: "agent",
                senderName: currentUser.name,
                metadata: { locationAddress: locAddress.trim() },
              });
              setShowLocationModal(false);
              setLocAddress("");
              setLocCaption("");
              await onRefreshState();
            }}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
          >
            <h3 className="text-base font-bold text-slate-900">Enviar Localização</h3>
            <div className="mt-3 space-y-3">
              <input
                type="text"
                required
                value={locAddress}
                onChange={(e) => setLocAddress(e.target.value)}
                placeholder="Endereço completo"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={locCaption}
                onChange={(e) => setLocCaption(e.target.value)}
                placeholder="Observação opcional"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white"
              >
                Enviar
              </button>
            </div>
          </form>
        </div>
      )}

      {showQuickReplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await apiClient.createQuickReply({ shortcut: qrShortcut, title: qrTitle, body: qrBody });
              setShowQuickReplyModal(false);
              setQrShortcut("");
              setQrTitle("");
              setQrBody("");
              await onRefreshState();
              onNotify("Resposta rápida salva.");
            }}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
          >
            <h3 className="text-base font-bold text-slate-900">Nova Resposta Rápida</h3>
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={qrShortcut}
                  onChange={(e) => setQrShortcut(e.target.value)}
                  placeholder="Atalho (ex.: /ola)"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
                />
                <input
                  type="text"
                  required
                  value={qrTitle}
                  onChange={(e) => setQrTitle(e.target.value)}
                  placeholder="Título"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <textarea
                rows={3}
                required
                value={qrBody}
                onChange={(e) => setQrBody(e.target.value)}
                placeholder="Texto da mensagem rápida..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowQuickReplyModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
