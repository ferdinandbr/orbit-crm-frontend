"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bot,
  Clock,
  Headset,
  Kanban,
  Layers,
  Megaphone,
  MessageSquare,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { DashboardSummary, Organization } from "@/lib/types";
import { cn, formatCurrencyBRL } from "@/lib/utils";

interface DashboardViewProps {
  organization: Organization;
  userName: string;
  roleName?: string;
  canViewInbox?: boolean;
  canCreateConversation?: boolean;
  canViewKanban?: boolean;
  canCreateLead?: boolean;
  canSendBroadcast?: boolean;
  canEditChannels?: boolean;
  onNavigate: (tab: "inbox" | "kanban" | "broadcast" | "ai" | "settings") => void;
  onOpenConversation: (convId: string) => void;
}

function DashboardSkeleton() {
  return (
    <div className="thin-scrollbar h-full overflow-y-auto bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="space-y-2">
            <div className="h-5 w-52 animate-pulse rounded bg-slate-200" />
            <div className="h-3.5 w-72 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-28 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-9 w-36 animate-pulse rounded-xl bg-slate-200" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="h-3.5 w-28 rounded bg-slate-200" />
              <div className="mt-4 h-7 w-36 rounded bg-slate-200" />
              <div className="mt-4 h-4 w-24 rounded bg-slate-100" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2" />
          <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white p-5" />
        </div>

        <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white p-5" />
      </div>
    </div>
  );
}

export function DashboardView({
  organization,
  userName,
  roleName,
  canViewInbox = true,
  canCreateConversation = true,
  canViewKanban = true,
  canCreateLead = true,
  canSendBroadcast = true,
  canEditChannels = true,
  onNavigate,
  onOpenConversation,
}: DashboardViewProps) {
  const [days, setDays] = useState<7 | 30>(7);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dealFilter, setDealFilter] = useState<"all" | "open" | "won" | "lost">("all");
  const [dealSearch, setDealSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (targetDays: number, silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getDashboard(targetDays);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar métricas da dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(days, summary !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, organization.id]);

  const maxDailyTotal = useMemo(() => {
    if (!summary) return 1;
    const vals = summary.dailyActivity.map(
      (d) => d.inboundMessages + d.outboundMessages + d.broadcastSent,
    );
    return Math.max(1, ...vals);
  }, [summary]);

  const maxStageValue = useMemo(() => {
    if (!summary) return 1;
    return Math.max(1, ...summary.stageBreakdown.map((s) => s.valueCents ?? 0));
  }, [summary]);

  const maxStageLeads = useMemo(() => {
    if (!summary) return 1;
    return Math.max(1, ...summary.stageBreakdown.map((s) => s.leadsCount));
  }, [summary]);

  const filteredDeals = useMemo(() => {
    if (!summary) return [];
    return summary.recentDeals.filter((d) => {
      if (dealFilter !== "all" && d.status !== dealFilter) return false;
      if (dealSearch.trim()) {
        const q = dealSearch.toLowerCase();
        return (
          d.title.toLowerCase().includes(q) ||
          d.contactName.toLowerCase().includes(q) ||
          d.code.toLowerCase().includes(q) ||
          d.company.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [summary, dealFilter, dealSearch]);

  if (loading && !summary) {
    return <DashboardSkeleton />;
  }

  if (error && !summary) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => fetchDashboard(days, false)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const { kpis, dailyActivity, channelBreakdown, stageBreakdown, canViewFinancials, myMetrics } =
    summary;
  const totalConversations =
    kpis.openConversationsCount + kpis.newRequestsCount + kpis.resolvedConversationsCount;
  const totalStageLeads = Math.max(
    1,
    stageBreakdown.reduce((acc, st) => acc + st.leadsCount, 0),
  );
  const totalChannelMsgs = Math.max(1, channelBreakdown.evolutionMessages + channelBreakdown.metaCloudMessages);
  const evolutionShare = channelBreakdown.evolutionMessages / totalChannelMsgs;
  const metaShare = channelBreakdown.metaCloudMessages / totalChannelMsgs;
  const arcLen = 150.8;
  const evolutionArc = Math.round(arcLen * evolutionShare * 10) / 10;
  const metaArc = Math.round(arcLen * (evolutionShare + metaShare) * 10) / 10;
  const antiBanPct =
    channelBreakdown.evolutionDailyCap > 0
      ? Math.min(100, Math.round((channelBreakdown.evolutionDailySent / channelBreakdown.evolutionDailyCap) * 100))
      : 0;

  return (
    <div className="thin-scrollbar h-full overflow-y-auto bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header Executivo / Operacional */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                Visão Geral · {organization.name}
              </h1>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                  canViewFinancials
                    ? "bg-emerald-50 text-[#15803D]"
                    : "bg-slate-100 text-slate-700",
                )}
              >
                {canViewFinancials
                  ? "Visão Executiva"
                  : `Visão Operacional${roleName ? ` · ${roleName}` : ""}`}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {canViewFinancials ? (
                <>
                  Olá, <strong>{userName.split(" ")[0]}</strong>. Acompanhe seu funil de vendas, atendimentos WhatsApp e envios em tempo real.
                </>
              ) : (
                <>
                  Olá, <strong>{userName.split(" ")[0]}</strong>. Acompanhe sua fila de atendimentos, volume do funil e desempenho operacional em tempo real.
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDays(7)}
                className={cn(
                  "rounded-lg px-3 py-1.5 transition",
                  days === 7 ? "bg-white text-[#15803D] shadow-sm" : "text-slate-600",
                )}
              >
                7 dias
              </button>
              <button
                type="button"
                onClick={() => setDays(30)}
                className={cn(
                  "rounded-lg px-3 py-1.5 transition",
                  days === 30 ? "bg-white text-[#15803D] shadow-sm" : "text-slate-600",
                )}
              >
                30 dias
              </button>
            </div>

            <button
              type="button"
              onClick={() => fetchDashboard(days, true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              Atualizar
            </button>

            {canSendBroadcast ? (
              <button
                type="button"
                onClick={() => onNavigate("broadcast")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#16A34A] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#15803D]"
              >
                <Megaphone className="h-3.5 w-3.5" /> Novo Disparo
              </button>
            ) : canViewInbox ? (
              <button
                type="button"
                onClick={() => onNavigate("inbox")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#16A34A] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#15803D]"
              >
                <MessageSquare className="h-3.5 w-3.5" /> Ir para o Inbox
              </button>
            ) : null}
          </div>
        </div>

        {/* Grade de KPIs adaptada ao perfil */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {canViewFinancials ? (
            <>
              {/* Card 1 (Executivo): Destaque Verde — Receita em Pipeline */}
              <div className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-[#16A34A] to-[#15803D] p-5 text-white shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-100">Negócios no Funil</span>
                  <span className="rounded-lg bg-white/15 p-1.5">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </span>
                </div>
                <div className="mt-3 text-2xl font-extrabold tracking-tight">
                  {formatCurrencyBRL(kpis.pipelineValueCents ?? 0)}
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-emerald-50">
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 font-semibold">
                    {kpis.openLeadsCount} em aberto
                  </span>
                  {canViewKanban && (
                    <button
                      type="button"
                      onClick={() => onNavigate("kanban")}
                      className="inline-flex items-center gap-0.5 font-semibold hover:underline"
                    >
                      Abrir Kanban <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Card 2 (Executivo): Receita Ganha */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Receita Ganha</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-[#15803D]">
                    Conversão {kpis.winRatePercent}%
                  </span>
                </div>
                <div className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">
                  {formatCurrencyBRL(kpis.wonValueCents ?? 0)}
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{kpis.wonLeadsCount} ganho(s)</span>
                  <span>{kpis.lostLeadsCount} perdido(s)</span>
                </div>
              </div>

              {/* Card 3 (Executivo): Performance de Chat */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Performance de Chat</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                    <Clock className="h-3 w-3 text-[#16A34A]" /> TMA
                  </span>
                </div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="text-2xl font-extrabold tracking-tight text-slate-900">
                    {kpis.avgResponseFormatted}
                  </div>
                  <svg viewBox="0 0 100 28" className="h-8 w-24 shrink-0">
                    <path
                      d="M2 22 Q 22 10, 42 18 T 74 10 T 98 6"
                      fill="none"
                      stroke="#16A34A"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{kpis.openConversationsCount + kpis.newRequestsCount} ativa(s)</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-violet-700">
                    <Bot className="h-3 w-3" /> {kpis.aiActiveConversationsCount} com IA
                  </span>
                </div>
              </div>

              {/* Card 4 (Executivo): Resumo Inbox */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Conversas no Inbox</span>
                  <span className="rounded-lg bg-emerald-50 p-1.5 text-[#16A34A]">
                    <MessageSquare className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">
                  {totalConversations}
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{kpis.newRequestsCount} nova(s) · {kpis.resolvedConversationsCount} resolvida(s)</span>
                  {canViewInbox && (
                    <button
                      type="button"
                      onClick={() => onNavigate("inbox")}
                      className="font-semibold text-[#16A34A] hover:underline"
                    >
                      Abrir Inbox
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Card 1 (Operacional): Destaque Verde — Meus Atendimentos & Fila */}
              <div className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-[#16A34A] to-[#15803D] p-5 text-white shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-100">Meus Atendimentos</span>
                  <span className="rounded-lg bg-white/15 p-1.5">
                    <Headset className="h-4 w-4 text-white" />
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold tracking-tight">
                    {myMetrics.myAssignedConversationsCount}
                  </span>
                  <span className="text-xs font-semibold text-emerald-100">
                    em andamento
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-emerald-50">
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 font-semibold">
                    {myMetrics.unassignedQueueCount} aguardando na fila
                  </span>
                  {canViewInbox && (
                    <button
                      type="button"
                      onClick={() => onNavigate("inbox")}
                      className="inline-flex items-center gap-0.5 font-semibold hover:underline"
                    >
                      Atender no Inbox <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Card 2 (Operacional): Volume do Funil (sem faturamento) */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">
                    Funil de Negócios (Volume)
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-[#15803D]">
                    Conversão {kpis.winRatePercent}%
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold tracking-tight text-slate-900">
                    {kpis.openLeadsCount}
                  </span>
                  <span className="text-xs font-medium text-slate-500">em aberto</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Layers className="h-3 w-3 text-[#16A34A]" /> {myMetrics.myOpenLeadsCount} seus · {kpis.wonLeadsCount} ganhos
                  </span>
                  {canViewKanban && (
                    <button
                      type="button"
                      onClick={() => onNavigate("kanban")}
                      className="font-semibold text-[#16A34A] hover:underline"
                    >
                      Ver Kanban
                    </button>
                  )}
                </div>
              </div>

              {/* Card 3 (Operacional): Performance de Chat (TMA + resolvidos pelo usuário) */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Performance de Chat</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                    <Clock className="h-3 w-3 text-[#16A34A]" /> TMA
                  </span>
                </div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="text-2xl font-extrabold tracking-tight text-slate-900">
                    {kpis.avgResponseFormatted}
                  </div>
                  <svg viewBox="0 0 100 28" className="h-8 w-24 shrink-0">
                    <path
                      d="M2 22 Q 22 10, 42 18 T 74 10 T 98 6"
                      fill="none"
                      stroke="#16A34A"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{myMetrics.myResolvedConversationsCount} resolvidos por você</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-violet-700">
                    <Bot className="h-3 w-3" /> {kpis.aiActiveConversationsCount} com IA
                  </span>
                </div>
              </div>

              {/* Card 4 (Operacional): Fila Geral & Equipe Online */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Fila Geral & Equipe</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-[#15803D]">
                    <Users className="h-3 w-3" /> {myMetrics.onlineAgentsCount} online
                  </span>
                </div>
                <div className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">
                  {totalConversations}
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{kpis.newRequestsCount} nova(s) · {kpis.resolvedConversationsCount} resolvida(s)</span>
                  {canViewInbox && (
                    <button
                      type="button"
                      onClick={() => onNavigate("inbox")}
                      className="font-semibold text-[#16A34A] hover:underline"
                    >
                      Abrir Inbox
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Gráficos Centrais: Movimentação Semanal + Medidor Semicircular */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Gráfico de Barras Diário */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Visão de Mensagens & Disparos ({days} dias)
                </h2>
                <p className="text-xs text-slate-500">
                  Volume diário de mensagens recebidas, enviadas e campanhas.
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#16A34A]" /> Enviadas
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-200" /> Recebidas
                </span>
              </div>
            </div>

            <div className="mt-6 flex h-44 items-end gap-2">
              {dailyActivity.slice(-14).map((day) => {
                const outH = Math.round((day.outboundMessages / maxDailyTotal) * 100);
                const inH = Math.round((day.inboundMessages / maxDailyTotal) * 100);
                const hasActivity = day.outboundMessages + day.inboundMessages > 0;
                return (
                  <div key={day.date} className="group flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex h-36 w-full max-w-[34px] items-end justify-center gap-1 rounded-t-lg bg-slate-50 px-1 pt-2">
                      <div
                        className="w-2.5 rounded-t bg-emerald-200 transition-all"
                        style={{ height: `${hasActivity ? Math.max(8, inH) : 4}%` }}
                        title={`${day.label}: ${day.inboundMessages} recebidas`}
                      />
                      <div
                        className="w-2.5 rounded-t bg-[#16A34A] transition-all"
                        style={{ height: `${hasActivity ? Math.max(8, outH) : 4}%` }}
                        title={`${day.label}: ${day.outboundMessages} enviadas`}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-slate-400">{day.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Medidor Semicircular de Canais (Estilo Card Flutuante do Login) */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Canais & Mensagens</h2>
                <p className="text-xs text-slate-500">Distribuição por provedor</p>
              </div>
              {canEditChannels && (
                <button
                  type="button"
                  onClick={() => onNavigate("settings")}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Configurar
                </button>
              )}
            </div>

            <div className="my-2 flex flex-col items-center">
              <svg viewBox="0 0 120 68" className="h-28 w-48">
                <path
                  d="M 12 60 A 48 48 0 0 1 108 60"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                {channelBreakdown.totalMessages > 0 && (
                  <>
                    <path
                      d="M 12 60 A 48 48 0 0 1 108 60"
                      fill="none"
                      stroke="#0EA5E9"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={`${metaArc} ${arcLen}`}
                    />
                    <path
                      d="M 12 60 A 48 48 0 0 1 108 60"
                      fill="none"
                      stroke="#16A34A"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={`${evolutionArc} ${arcLen}`}
                    />
                  </>
                )}
              </svg>
              <div className="-mt-9 text-center">
                <div className="text-[11px] font-medium text-slate-400">Total de Mensagens</div>
                <div className="text-2xl font-extrabold text-slate-900">
                  {channelBreakdown.totalMessages}
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 font-medium text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#16A34A]" /> Conexão por QR Code
                </span>
                <span className="font-bold text-slate-900">{channelBreakdown.evolutionMessages}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 font-medium text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#0EA5E9]" /> Meta Cloud API
                </span>
                <span className="font-bold text-slate-900">{channelBreakdown.metaCloudMessages}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 font-medium text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Respondidas por IA
                </span>
                <span className="font-bold text-slate-900">{channelBreakdown.aiMessages}</span>
              </div>
              <div className="pt-1">
                <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                  <span>Limite de envios hoje</span>
                  <span>
                    {channelBreakdown.evolutionDailySent} / {channelBreakdown.evolutionDailyCap}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#16A34A]"
                    style={{ width: `${antiBanPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Funil por Etapa + Oportunidades Recentes */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Distribuição do Funil */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Etapas do Funil</h2>
                <p className="text-xs text-slate-500">{organization.vocabulary.lead}s por coluna</p>
              </div>
              {canViewKanban && (
                <button
                  type="button"
                  onClick={() => onNavigate("kanban")}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A34A] hover:underline"
                >
                  <Kanban className="h-3.5 w-3.5" /> Ver Kanban
                </button>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {stageBreakdown.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">Nenhuma etapa configurada.</p>
              ) : (
                stageBreakdown.map((st) => {
                  const pct = canViewFinancials
                    ? Math.round(((st.valueCents ?? 0) / maxStageValue) * 100)
                    : Math.round((st.leadsCount / maxStageLeads) * 100);
                  const sharePct = Math.round((st.leadsCount / totalStageLeads) * 100);
                  const leadNoun = organization.vocabulary.lead.toLowerCase();
                  return (
                    <div key={st.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 font-semibold text-slate-800">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: st.color }}
                          />
                          {st.name}
                          {canViewFinancials && (
                            <span className="text-[11px] font-normal text-slate-400">
                              ({st.leadsCount})
                            </span>
                          )}
                        </span>
                        <span className="font-bold text-slate-700">
                          {canViewFinancials ? (
                            formatCurrencyBRL(st.valueCents ?? 0)
                          ) : (
                            <>
                              {st.leadsCount} {leadNoun}
                              {st.leadsCount === 1 ? "" : "s"}{" "}
                              <span className="font-normal text-slate-400">({sharePct}%)</span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${st.leadsCount > 0 ? Math.max(8, pct) : 0}%`,
                            backgroundColor: st.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Tabela de Negócios & Atendimentos Recentes */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Negócios & Atendimentos Recentes
                </h2>
                <p className="text-xs text-slate-500">
                  Acompanhamento direto das últimas movimentações do CRM.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={dealSearch}
                    onChange={(e) => setDealSearch(e.target.value)}
                    placeholder="Filtrar negócio..."
                    className="w-40 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2.5 text-xs focus:border-[#16A34A] focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="flex rounded-xl bg-slate-100 p-0.5 text-[11px] font-semibold">
                  {(["all", "open", "won", "lost"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setDealFilter(f)}
                      className={cn(
                        "rounded-lg px-2.5 py-1 transition",
                        dealFilter === f ? "bg-white text-[#15803D] shadow-sm" : "text-slate-600",
                      )}
                    >
                      {f === "all"
                        ? "Todos"
                        : f === "open"
                          ? "Abertos"
                          : f === "won"
                            ? "Ganhos"
                            : "Perdidos"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filteredDeals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Kanban className="h-8 w-8 text-slate-300" />
                <p className="mt-2 text-xs font-medium text-slate-500">
                  Nenhuma oportunidade registrada ainda neste período.
                </p>
                {(canCreateConversation || canCreateLead) && (
                  <div className="mt-3 flex gap-2">
                    {canCreateConversation && (
                      <button
                        type="button"
                        onClick={() => onNavigate("inbox")}
                        className="rounded-xl bg-[#16A34A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#15803D]"
                      >
                        Iniciar conversa
                      </button>
                    )}
                    {canCreateLead && (
                      <button
                        type="button"
                        onClick={() => onNavigate("kanban")}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Criar no Kanban
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="thin-scrollbar mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-2 pr-3">ID</th>
                      <th className="py-2 pr-3">Contato / Negócio</th>
                      <th className="py-2 pr-3">Canal</th>
                      <th className="py-2 pr-3">Etapa</th>
                      <th className="py-2 pr-3">{canViewFinancials ? "Valor" : "Status"}</th>
                      <th className="py-2 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDeals.map((deal) => (
                      <tr key={deal.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 pr-3 font-mono text-[11px] font-semibold text-slate-500">
                          {deal.code}
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="font-bold text-slate-900">{deal.title}</div>
                          <div className="text-[11px] text-slate-500">
                            {deal.contactName} {deal.contactPhone ? `· ${deal.contactPhone}` : ""}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          {deal.provider === "meta_cloud" ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                              <ShieldCheck className="h-3 w-3" /> Meta Oficial
                            </span>
                          ) : deal.provider === "evolution" ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-[#15803D]">
                              <QrCode className="h-3 w-3" /> Evolution
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                            style={{
                              backgroundColor: `${deal.stageColor}18`,
                              color: deal.stageColor,
                            }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: deal.stageColor }}
                            />
                            {deal.stageName}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          {canViewFinancials ? (
                            <span className="font-bold text-slate-900">
                              {formatCurrencyBRL(deal.valueCents ?? 0)}
                            </span>
                          ) : (
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold",
                                deal.status === "won"
                                  ? "bg-emerald-50 text-[#15803D]"
                                  : deal.status === "lost"
                                    ? "bg-rose-50 text-rose-700"
                                    : "bg-sky-50 text-sky-700",
                              )}
                            >
                              {deal.status === "won"
                                ? "Ganho"
                                : deal.status === "lost"
                                  ? "Perdido"
                                  : "Em andamento"}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          {deal.conversationId && canViewInbox ? (
                            <button
                              type="button"
                              onClick={() => onOpenConversation(deal.conversationId!)}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Abrir Chat
                            </button>
                          ) : canViewKanban ? (
                            <button
                              type="button"
                              onClick={() => onNavigate("kanban")}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Kanban
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
