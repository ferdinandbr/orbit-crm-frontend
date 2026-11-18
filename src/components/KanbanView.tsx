"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckSquare,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { AiAgentConfig, Lead, Organization, Pipeline, Stage, TeamMember } from "@/lib/types";
import { cn, formatCurrencyBRL } from "@/lib/utils";

interface KanbanViewProps {
  organization: Organization;
  pipelines: Pipeline[];
  stages: Stage[];
  leads: Lead[];
  members: TeamMember[];
  aiAgent: AiAgentConfig | undefined;
  currentUser: TeamMember;
  canCreateLeads?: boolean;
  canMoveLeads?: boolean;
  canDeleteLeads?: boolean;
  canManagePipelines?: boolean;
  canViewInbox?: boolean;
  onRefreshState: () => Promise<void>;
  onOpenConversation: (conversationId: string) => void;
  onNotify: (msg: string) => void;
}

export function KanbanView({
  organization,
  pipelines,
  stages,
  leads,
  members,
  aiAgent,
  currentUser,
  canCreateLeads = true,
  canMoveLeads = true,
  canDeleteLeads = true,
  canManagePipelines = true,
  canViewInbox = true,
  onRefreshState,
  onOpenConversation,
  onNotify,
}: KanbanViewProps) {
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>(
    pipelines.find((p) => p.isDefault)?.id ?? pipelines[0]?.id ?? "",
  );
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContact, setNewContact] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newValueReais, setNewValueReais] = useState("");

  const [showNewPipelineModal, setShowNewPipelineModal] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");

  const [showNewStageModal, setShowNewStageModal] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageProb, setNewStageProb] = useState(50);
  const [newStageReqHuman, setNewStageReqHuman] = useState(false);

  const [losePrompt, setLosePrompt] = useState<{ leadId: string; stageId: string } | null>(null);
  const [loseReason, setLoseReason] = useState("Preço / Orçamento");

  const activePipeline = useMemo(
    () => pipelines.find((p) => p.id === selectedPipelineId) ?? pipelines[0],
    [pipelines, selectedPipelineId],
  );

  const pipelineStages = useMemo(
    () =>
      stages
        .filter((s) => s.pipelineId === activePipeline?.id)
        .sort((a, b) => a.position - b.position),
    [stages, activePipeline],
  );

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (lead.pipelineId !== activePipeline?.id) return false;
      if (ownerFilter === "ai" && lead.ownerKind !== "ai") return false;
      if (ownerFilter !== "all" && ownerFilter !== "ai" && lead.ownerUserId !== ownerFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          lead.title.toLowerCase().includes(q) ||
          lead.contactName.toLowerCase().includes(q) ||
          lead.company.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [leads, activePipeline, ownerFilter, search]);

  const totalPipelineCents = useMemo(
    () => filteredLeads.reduce((acc, l) => acc + l.valueCents, 0),
    [filteredLeads],
  );

  const handleAttemptMove = async (leadId: string, targetStageId: string) => {
    const targetStage = pipelineStages.find((s) => s.id === targetStageId);
    if (targetStage?.isLost) {
      setLosePrompt({ leadId, stageId: targetStageId });
      return;
    }
    await apiClient.moveLeadStage(leadId, targetStageId, currentUser.name);
    await onRefreshState();
    onNotify("Negócio movido no funil.");
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePipeline || pipelineStages.length === 0 || !newTitle.trim() || !newContact.trim()) return;
    const cents = Math.max(0, Math.round((Number(newValueReais.replace(",", ".")) || 0) * 100));
    await apiClient.createLead({
      pipelineId: activePipeline.id,
      stageId: pipelineStages[0].id,
      title: newTitle.trim(),
      contactName: newContact.trim(),
      contactPhone: newPhone.trim(),
      company: newCompany.trim(),
      valueCents: cents,
      ownerUserId: currentUser.id,
    });
    setShowNewLeadModal(false);
    setNewTitle("");
    setNewContact("");
    setNewPhone("");
    setNewCompany("");
    setNewValueReais("");
    await onRefreshState();
    onNotify("Novo negócio criado.");
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={activePipeline?.id ?? ""}
            onChange={(e) => setSelectedPipelineId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {canManagePipelines && (
            <>
              <button
                type="button"
                onClick={() => setShowNewPipelineModal(true)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                + Funil
              </button>

              <button
                type="button"
                onClick={() => setShowNewStageModal(true)}
                disabled={!activePipeline}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                + Etapa
              </button>

              {pipelines.length > 1 && activePipeline && !activePipeline.isDefault && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await apiClient.deletePipeline(activePipeline.id);
                      const remaining = pipelines.find((p) => p.id !== activePipeline.id);
                      setSelectedPipelineId(remaining?.id ?? "");
                      await onRefreshState();
                      onNotify("Funil excluído.");
                    } catch (err) {
                      onNotify(err instanceof Error ? err.message : "Erro ao excluir funil.");
                    }
                  }}
                  title="Excluir funil atual"
                  className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}

          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            {filteredLeads.length} {organization.vocabulary.lead.toLowerCase()}(s) ·{" "}
            <span className="font-bold">{formatCurrencyBRL(totalPipelineCents)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Buscar ${organization.vocabulary.lead.toLowerCase()}...`}
              className="rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>

          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">Todos responsáveis</option>
            <option value="ai">🤖 {aiAgent?.name ?? "Agente IA"}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          {canCreateLeads && (
            <button
              type="button"
              onClick={() => setShowNewLeadModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#16A34A] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Novo {organization.vocabulary.lead}
            </button>
          )}
        </div>
      </div>

      <div className="thin-scrollbar flex flex-1 gap-4 overflow-x-auto p-5">
        {pipelineStages.map((stage) => {
          const colLeads = filteredLeads.filter((l) => l.stageId === stage.id);
          const colSum = colLeads.reduce((acc, l) => acc + l.valueCents, 0);
          const isDropTarget = dragOverStageId === stage.id;

          return (
            <div
              key={stage.id}
              onDragOver={(e) => {
                if (!canMoveLeads) return;
                e.preventDefault();
                setDragOverStageId(stage.id);
              }}
              onDragLeave={() => {
                if (canMoveLeads) setDragOverStageId(null);
              }}
              onDrop={(e) => {
                if (!canMoveLeads) return;
                e.preventDefault();
                setDragOverStageId(null);
                if (draggingLeadId) {
                  handleAttemptMove(draggingLeadId, stage.id);
                  setDraggingLeadId(null);
                }
              }}
              className={cn(
                "flex w-80 shrink-0 flex-col rounded-2xl border bg-slate-100/80 transition",
                isDropTarget ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-200" : "border-slate-200/90",
              )}
            >
              <div className="rounded-t-2xl border-b border-slate-200/80 bg-white/80 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                    <h3 className="text-sm font-bold text-slate-900">
                      {stage.isWon
                        ? `${stage.name} (${organization.vocabulary.won})`
                        : stage.isLost
                          ? `${stage.name} (${organization.vocabulary.lost})`
                          : stage.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                      {colLeads.length}
                    </span>
                    {canManagePipelines && !stage.isWon && !stage.isLost && colLeads.length === 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await apiClient.deleteStage(stage.id);
                            await onRefreshState();
                          } catch (err) {
                            onNotify(err instanceof Error ? err.message : "Erro ao excluir etapa.");
                          }
                        }}
                        className="text-slate-300 hover:text-red-600"
                        title="Excluir etapa vazia"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{formatCurrencyBRL(colSum)}</span>
                  <span>{stage.winProbability}% prob.</span>
                </div>

                {stage.requiresHuman && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                    Exige atendente humano
                  </div>
                )}
              </div>

              <div className="thin-scrollbar flex-1 space-y-2.5 overflow-y-auto p-3">
                {colLeads.map((lead) => {
                  const ownerMember = members.find((m) => m.id === lead.ownerUserId);
                  const doneTasks = lead.tasks.filter((t) => t.done).length;

                  return (
                    <div
                      key={lead.id}
                      draggable={canMoveLeads}
                      onDragStart={() => {
                        if (canMoveLeads) setDraggingLeadId(lead.id);
                      }}
                      onDragEnd={() => {
                        setDraggingLeadId(null);
                        setDragOverStageId(null);
                      }}
                      className={cn(
                        "rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-emerald-300 hover:shadow",
                        canMoveLeads && "cursor-grab active:cursor-grabbing",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-400">{lead.company || "Contato"}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-emerald-700">
                            {formatCurrencyBRL(lead.valueCents)}
                          </span>
                          {canDeleteLeads && (
                            <button
                              type="button"
                              onClick={async () => {
                                await apiClient.deleteLead(lead.id);
                                await onRefreshState();
                                onNotify("Negócio removido.");
                              }}
                              className="text-slate-300 hover:text-red-600"
                              title="Excluir negócio"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <h4 className="mt-1 text-sm font-bold text-slate-900">{lead.title}</h4>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {lead.contactName} {lead.contactPhone ? `· ${lead.contactPhone}` : ""}
                      </p>

                      {lead.lostReason && stage.isLost && (
                        <p className="mt-1.5 rounded bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700">
                          Motivo: {lead.lostReason}
                        </p>
                      )}

                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                        {lead.ownerKind === "ai" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800">
                            <Bot className="h-3 w-3" /> IA
                          </span>
                        ) : ownerMember ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#DCFCE7] px-2 py-0.5 text-[11px] font-semibold text-[#15803D]">
                            <UserCheck className="h-3 w-3" /> {ownerMember.name.split(" ")[0]}
                          </span>
                        ) : (
                          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            Sem dono
                          </span>
                        )}

                        <div className="flex items-center gap-1.5">
                          {lead.tasks.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400">
                              <CheckSquare className="h-3 w-3" />
                              {doneTasks}/{lead.tasks.length}
                            </span>
                          )}

                          {lead.conversationId && canViewInbox && (
                            <button
                              type="button"
                              onClick={() => onOpenConversation(lead.conversationId!)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              <MessageCircle className="h-3 w-3" />
                              Chat
                            </button>
                          )}
                        </div>
                      </div>

                      {canMoveLeads && (
                        <select
                          value={lead.stageId}
                          onChange={(e) => handleAttemptMove(lead.id, e.target.value)}
                          className="mt-2 w-full rounded-lg border border-slate-100 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 focus:outline-none"
                        >
                          {pipelineStages.map((st) => (
                            <option key={st.id} value={st.id}>
                              Mover para: {st.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Novo Negócio */}
      {showNewLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={handleCreateSubmit} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Novo {organization.vocabulary.lead}</h3>
              <button type="button" onClick={() => setShowNewLeadModal(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Título da Oportunidade *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Nome do Contato *</label>
                  <input
                    type="text"
                    required
                    value={newContact}
                    onChange={(e) => setNewContact(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">WhatsApp (com DDI)</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+5511999999999"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Empresa</label>
                  <input
                    type="text"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Valor (R$)</label>
                  <input
                    type="text"
                    value={newValueReais}
                    onChange={(e) => setNewValueReais(e.target.value)}
                    placeholder="0,00"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewLeadModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Criar no Funil
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Novo Funil */}
      {showNewPipelineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newPipelineName.trim()) return;
              const pip = await apiClient.createPipeline(newPipelineName);
              setShowNewPipelineModal(false);
              setNewPipelineName("");
              setSelectedPipelineId(pip.id);
              await onRefreshState();
              onNotify("Novo funil criado.");
            }}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
          >
            <h3 className="text-base font-bold text-slate-900">Criar Novo Funil</h3>
            <input
              type="text"
              required
              value={newPipelineName}
              onChange={(e) => setNewPipelineName(e.target.value)}
              placeholder="Nome do funil"
              className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewPipelineModal(false)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#16A34A] px-3 py-1.5 text-xs font-semibold text-white"
              >
                Criar Funil
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Nova Etapa */}
      {showNewStageModal && activePipeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newStageName.trim()) return;
              await apiClient.createStage({
                pipelineId: activePipeline.id,
                name: newStageName,
                color: "#0EA5E9",
                winProbability: newStageProb,
                requiresHuman: newStageReqHuman,
              });
              setShowNewStageModal(false);
              setNewStageName("");
              await onRefreshState();
              onNotify("Etapa adicionada.");
            }}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
          >
            <h3 className="text-base font-bold text-slate-900">Nova Etapa em {activePipeline.name}</h3>
            <div className="mt-3 space-y-3">
              <input
                type="text"
                required
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder="Nome da etapa"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <div>
                <label className="text-xs font-semibold text-slate-700">Probabilidade (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={newStageProb}
                  onChange={(e) => setNewStageProb(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={newStageReqHuman}
                  onChange={(e) => setNewStageReqHuman(e.target.checked)}
                  className="accent-emerald-600"
                />
                Exige atendimento humano
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewStageModal(false)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#16A34A] px-3 py-1.5 text-xs font-semibold text-white"
              >
                Adicionar Etapa
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Motivo de Perda */}
      {losePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Registrar Motivo de {organization.vocabulary.lost}</h3>
            <select
              value={loseReason}
              onChange={(e) => setLoseReason(e.target.value)}
              className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="Preço / Orçamento">Preço / Orçamento</option>
              <option value="Fechou com concorrente">Fechou com concorrente</option>
              <option value="Sem resposta (Follow-up)">Sem resposta (Follow-up)</option>
              <option value="Perfil fora do ICP">Perfil fora do ICP</option>
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLosePrompt(null)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await apiClient.moveLeadStage(losePrompt.leadId, losePrompt.stageId, currentUser.name, loseReason);
                  setLosePrompt(null);
                  await onRefreshState();
                }}
                className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                Confirmar {organization.vocabulary.lost}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
