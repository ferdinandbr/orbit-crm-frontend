"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Megaphone,
  QrCode,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type {
  BroadcastCampaign,
  ChannelSession,
  Conversation,
  EvolutionAntiBanConfig,
  Lead,
  MetaTemplate,
  Stage,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface BroadcastViewProps {
  channels: ChannelSession[];
  metaTemplates: MetaTemplate[];
  conversations: Conversation[];
  leads: Lead[];
  stages: Stage[];
  campaigns: BroadcastCampaign[];
  canSend?: boolean;
  canDelete?: boolean;
  onRefreshState: () => Promise<void>;
  onNotify: (msg: string) => void;
}

function splitCsvFields(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseRecipientsText(raw: string): Array<{ name: string; phone: string }> {
  const result: Array<{ name: string; phone: string }> = [];
  for (const line of raw.split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean) continue;

    const delimiter = clean.includes(";")
      ? ";"
      : clean.includes(",")
        ? ","
        : clean.includes("\t")
          ? "\t"
          : null;

    if (delimiter) {
      const cols = splitCsvFields(clean, delimiter).filter((c) => c.length > 0);
      if (cols.length === 0) continue;

      const phoneCol = cols.find((c) => {
        const digits = c.replace(/\D/g, "");
        return digits.length >= 8 && digits.length <= 15 && /^[+\d\s().-]+$/.test(c);
      }) ?? cols.find((c) => c.replace(/\D/g, "").length >= 8);

      if (!phoneCol) continue;
      const nameCol = cols.find((c) => c !== phoneCol) ?? phoneCol;
      result.push({ name: nameCol.trim() || phoneCol, phone: phoneCol.trim() });
    } else if (clean.replace(/\D/g, "").length >= 8) {
      result.push({ name: clean, phone: clean });
    }
  }
  return result;
}

export function BroadcastView({
  channels,
  metaTemplates,
  conversations,
  leads,
  stages,
  campaigns,
  canSend = true,
  canDelete = true,
  onRefreshState,
  onNotify,
}: BroadcastViewProps) {
  const [selectedChannelId, setSelectedChannelId] = useState(channels[0]?.id ?? "");
  const activeChannel = useMemo(
    () => channels.find((c) => c.id === selectedChannelId) ?? channels[0],
    [channels, selectedChannelId],
  );

  const isEvolution = activeChannel?.provider === "evolution";
  const approvedTemplates = useMemo(
    () =>
      metaTemplates.filter(
        (t) =>
          t.status === "APPROVED" &&
          (!activeChannel || t.channelSessionId === activeChannel.id || t.organizationId === activeChannel.organizationId),
      ),
    [metaTemplates, activeChannel],
  );

  const [campaignName, setCampaignName] = useState("");
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [selectedStageImport, setSelectedStageImport] = useState("");

  // Evolution API fields + travas anti-ban
  const [bodyText, setBodyText] = useState(
    "Olá {{nome}}, tudo bem? Temos uma atualização importante sobre seu atendimento.",
  );
  const [antiBan, setAntiBan] = useState<EvolutionAntiBanConfig>(
    activeChannel?.antiBan ?? {
      throttleMinMs: 1800,
      throttleMaxMs: 4200,
      dailyCap: 250,
      sentToday: 0,
      warmupEnabled: true,
      businessHoursOnly: true,
      stopOptOutEnabled: true,
    },
  );
  const [respectBusinessHours, setRespectBusinessHours] = useState(false);

  // Meta Oficial fields
  const [selectedTemplateId, setSelectedTemplateId] = useState(approvedTemplates[0]?.id ?? "");
  const [var1, setVar1] = useState("{{nome}}");
  const [var2, setVar2] = useState("nosso atendimento comercial");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(
    campaigns[0]?.id ?? null,
  );

  useEffect(() => {
    if (activeChannel?.antiBan) {
      setAntiBan(activeChannel.antiBan);
      setRespectBusinessHours(activeChannel.antiBan.businessHoursOnly);
    }
  }, [activeChannel]);

  useEffect(() => {
    if (!selectedTemplateId && approvedTemplates[0]) {
      setSelectedTemplateId(approvedTemplates[0].id);
    }
  }, [approvedTemplates, selectedTemplateId]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const parsedRecipients = useMemo(() => parseRecipientsText(recipientsRaw), [recipientsRaw]);
  const selectedTemplate = useMemo(
    () => approvedTemplates.find((t) => t.id === selectedTemplateId) ?? approvedTemplates[0],
    [approvedTemplates, selectedTemplateId],
  );

  const appendContacts = (items: Array<{ name: string; phone: string }>) => {
    const existing = new Set(parsedRecipients.map((r) => r.phone.replace(/\D/g, "")));
    const lines = recipientsRaw.trim() ? [recipientsRaw.trim()] : [];
    let added = 0;
    for (const item of items) {
      const digits = item.phone.replace(/\D/g, "");
      if (digits.length < 8 || existing.has(digits)) continue;
      existing.add(digits);
      lines.push(`${item.name}, ${item.phone}`);
      added += 1;
    }
    setRecipientsRaw(lines.join("\n"));
    onNotify(`${added} contato(s) importado(s) para a lista.`);
  };

  const handleCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsedFromCsv = parseRecipientsText(text);
      if (parsedFromCsv.length === 0) {
        onNotify("Nenhum contato válido encontrado no CSV (use colunas Nome, Telefone).");
      } else {
        appendContacts(parsedFromCsv);
      }
    } finally {
      e.target.value = "";
    }
  };

  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChannel) return;
    setErrorMsg(null);
    if (parsedRecipients.length === 0) {
      setErrorMsg("Adicione pelo menos um destinatário válido (Nome, +5511999999999).");
      return;
    }
    if (!isEvolution && !selectedTemplate) {
      setErrorMsg("Selecione um Template da Meta APPROVED para disparar pela API Oficial.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await apiClient.createBroadcast({
        name:
          campaignName.trim() ||
          `${isEvolution ? "Campanha Evolution" : "Campanha Meta"} ${new Date().toLocaleDateString("pt-BR")}`,
        channelSessionId: activeChannel.id,
        messageType: isEvolution ? "text" : "template",
        bodyText: isEvolution ? bodyText : undefined,
        templateId: !isEvolution ? selectedTemplate?.id : undefined,
        templateVariables: !isEvolution ? [var1, var2].filter((v) => v.trim().length > 0) : undefined,
        recipients: parsedRecipients,
        antiBanOverride: isEvolution ? antiBan : undefined,
        respectBusinessHours: isEvolution ? respectBusinessHours : undefined,
      });
      setCampaignName("");
      setExpandedCampaignId(created.id);
      await onRefreshState();
      onNotify(
        `Disparo finalizado: ${created.stats.sent}/${created.stats.total} enviado(s).`,
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao executar disparo em massa.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="thin-scrollbar h-full overflow-y-auto bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#16A34A] text-white shadow-sm">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Disparo em Massa
              </h2>
              <p className="text-xs text-slate-500">
                Execute campanhas segmentadas com proteção automática de envio ou modelos aprovados na conexão oficial.
              </p>
            </div>
          </div>

          {canSend && (
            <div className="flex flex-wrap gap-2">
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setSelectedChannelId(ch.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition",
                    activeChannel?.id === ch.id
                      ? ch.provider === "evolution"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm"
                        : "border-blue-500 bg-blue-50 text-blue-800 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {ch.provider === "evolution" ? (
                    <QrCode className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                  )}
                  {ch.displayName}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Formulário de Nova Campanha */}
        {canSend ? (
          <form onSubmit={handleLaunchCampaign} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700">Nome da Campanha *</label>
                <input
                  type="text"
                  required
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Ex.: Reativação Leads Novembro"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Canal Selecionado</label>
                <div className="mt-1 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800">
                  <span>{activeChannel?.displayName ?? "Nenhum canal"}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px]",
                      isEvolution ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800",
                    )}
                  >
                    {isEvolution ? "Evolution Anti-Ban" : "Meta Oficial"}
                  </span>
                </div>
              </div>
            </div>

            {isEvolution ? (
              <>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Mensagem com Personalização Anti-Spam
                    </label>
                    <button
                      type="button"
                      onClick={() => setBodyText((prev) => `${prev} {{nome}}`)}
                      className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
                    >
                      + Inserir {"{{nome}}"}
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    required
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    placeholder="Use {{nome}} para variar o texto a cada destinatário e reduzir risco de spam..."
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                {/* Painel de Travas Anti-Ban Evolution */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                      <ShieldAlert className="h-4 w-4 text-emerald-700" />
                      Travas de Segurança Anti-Bloqueio (Evolution API)
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">
                      Consumo hoje: {antiBan.sentToday} / {antiBan.dailyCap}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                    <div>
                      <label className="font-semibold text-slate-700">Delay mín. (ms)</label>
                      <input
                        type="number"
                        value={antiBan.throttleMinMs}
                        onChange={(e) =>
                          setAntiBan((a) => ({ ...a, throttleMinMs: Number(e.target.value) }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700">Delay máx. (ms)</label>
                      <input
                        type="number"
                        value={antiBan.throttleMaxMs}
                        onChange={(e) =>
                          setAntiBan((a) => ({ ...a, throttleMaxMs: Number(e.target.value) }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700">Teto diário (msgs)</label>
                      <input
                        type="number"
                        value={antiBan.dailyCap}
                        onChange={(e) =>
                          setAntiBan((a) => ({ ...a, dailyCap: Number(e.target.value) }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-700">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
                      <input
                        type="checkbox"
                        checked={antiBan.warmupEnabled}
                        onChange={(e) =>
                          setAntiBan((a) => ({ ...a, warmupEnabled: e.target.checked }))
                        }
                        className="accent-emerald-600"
                      />
                      Warm-up (piso 1500ms)
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
                      <input
                        type="checkbox"
                        checked={respectBusinessHours}
                        onChange={(e) => setRespectBusinessHours(e.target.checked)}
                        className="accent-emerald-600"
                      />
                      Bloquear fora do horário comercial (08h-20h)
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
                      <input
                        type="checkbox"
                        checked={antiBan.stopOptOutEnabled}
                        onChange={(e) =>
                          setAntiBan((a) => ({ ...a, stopOptOutEnabled: e.target.checked }))
                        }
                        className="accent-emerald-600"
                      />
                      Respeitar Opt-Out (STOP/SAIR)
                    </label>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    Disparo Oficial Meta (Exige Template APPROVED)
                  </div>
                  <span className="text-[11px] font-semibold text-blue-700">
                    {approvedTemplates.length} template(s) aprovado(s)
                  </span>
                </div>

                <select
                  value={selectedTemplate?.id ?? ""}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {approvedTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} ({tpl.category} · {tpl.language})
                    </option>
                  ))}
                </select>

                {selectedTemplate ? (
                  <>
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                      {selectedTemplate.headerText && (
                        <div className="font-bold text-slate-900">{selectedTemplate.headerText}</div>
                      )}
                      <p className="mt-1 whitespace-pre-wrap text-slate-700">
                        {selectedTemplate.bodyText}
                      </p>
                      {selectedTemplate.footerText && (
                        <div className="mt-1.5 text-[10px] text-slate-400">
                          {selectedTemplate.footerText}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600">
                          Variável {"{{1}}"} (suporta {"{{nome}}"})
                        </label>
                        <input
                          type="text"
                          value={var1}
                          onChange={(e) => setVar1(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600">
                          Variável {"{{2}}"}
                        </label>
                        <input
                          type="text"
                          value={var2}
                          onChange={(e) => setVar2(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-800">
                    Nenhum template APPROVED encontrado. Crie ou aprove um template em Configurações → API Oficial da Meta.
                  </p>
                )}
              </div>
            )}

            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !activeChannel || parsedRecipients.length === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#16A34A] py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {submitting
                ? "Executando disparo com travas..."
                : `Disparar para ${parsedRecipients.length} destinatário(s)`}
            </button>
          </div>

          {/* Lista de Destinatários + Importação */}
          <div className="flex flex-col justify-between space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <Users className="h-4 w-4 text-emerald-600" />
                  Destinatários ({parsedRecipients.length})
                </h3>
                {recipientsRaw && (
                  <button
                    type="button"
                    onClick={() => setRecipientsRaw("")}
                    className="text-[11px] font-semibold text-red-600 hover:underline"
                  >
                    Limpar
                  </button>
                )}
              </div>

              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Importar do CRM ou CSV
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,text/csv"
                    onChange={handleCsvFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
                  >
                    <Upload className="h-3 w-3" /> Importar CSV (.csv)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      appendContacts(
                        conversations.map((c) => ({ name: c.contactName, phone: c.contactPhone })),
                      )
                    }
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Conversas ({conversations.length})
                  </button>
                </div>
                {stages.length > 0 && (
                  <div className="flex gap-1.5">
                    <select
                      value={selectedStageImport || stages[0]?.id || ""}
                      onChange={(e) => setSelectedStageImport(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]"
                    >
                      {stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          Etapa: {s.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const targetStage = selectedStageImport || stages[0]?.id;
                        const filtered = leads.filter((l) => l.stageId === targetStage);
                        appendContacts(
                          filtered.map((l) => ({ name: l.contactName, phone: l.contactPhone })),
                        );
                      }}
                      className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white"
                    >
                      Importar
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Lista CSV (Nome, Telefone ou Nome;Telefone)
                </label>
                <textarea
                  rows={8}
                  value={recipientsRaw}
                  onChange={(e) => setRecipientsRaw(e.target.value)}
                  placeholder={"Maria Silva, +5511999990001\nJoão Costa, +5511999990002"}
                  className="thin-scrollbar mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs"
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] text-slate-500">
              <Sparkles className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />
              Números duplicados são removidos automaticamente e contatos que enviaram{" "}
              <code className="font-mono">STOP/SAIR</code> são ignorados em ambos os canais.
            </div>
          </div>
          </form>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
            Modo somente leitura — seu perfil pode consultar o histórico de campanhas abaixo, mas não possui permissão para criar ou executar novos disparos.
          </div>
        )}

        {/* Histórico de Campanhas */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Histórico de Campanhas ({campaigns.length})
              </h3>
              <p className="text-xs text-slate-500">
                Auditoria completa de disparos, bloqueios anti-ban, opt-out e logs por destinatário.
              </p>
            </div>
          </div>

          {campaigns.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              Nenhuma campanha disparada ainda. Configure os destinatários acima para iniciar.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {campaigns.map((camp) => {
                const isExpanded = expandedCampaignId === camp.id;
                return (
                  <div
                    key={camp.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "rounded-lg px-2 py-1 text-[10px] font-bold uppercase",
                            camp.provider === "evolution"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-blue-100 text-blue-800",
                          )}
                        >
                          {camp.provider === "evolution" ? "Evolution" : "Meta Oficial"}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{camp.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {camp.createdAtLabel}
                            {camp.templateName ? ` · Template: ${camp.templateName}` : ""}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                            camp.status === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800",
                          )}
                        >
                          {camp.status === "completed" ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {camp.status === "completed" ? "Concluída" : "Pausada Anti-Ban"}
                        </span>

                        <button
                          type="button"
                          onClick={() => setExpandedCampaignId(isExpanded ? null : camp.id)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          {isExpanded ? "Ocultar detalhes" : "Ver log"}
                        </button>

                        {canDelete && (
                          <button
                            type="button"
                            onClick={async () => {
                              await apiClient.deleteBroadcast(camp.id);
                              await onRefreshState();
                            }}
                            className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Excluir campanha"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-5">
                      <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200/70">
                        <div className="text-[10px] text-slate-400">Enviados</div>
                        <div className="font-bold text-emerald-700">
                          {camp.stats.sent}/{camp.stats.total}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200/70">
                        <div className="text-[10px] text-slate-400">Opt-Out Bloq.</div>
                        <div className="font-bold text-amber-700">{camp.stats.skippedOptOut}</div>
                      </div>
                      <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200/70">
                        <div className="text-[10px] text-slate-400">Teto Diário</div>
                        <div className="font-bold text-red-600">{camp.stats.skippedDailyCap}</div>
                      </div>
                      <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200/70">
                        <div className="text-[10px] text-slate-400">Fora Horário</div>
                        <div className="font-bold text-slate-700">
                          {camp.stats.skippedBusinessHours}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200/70">
                        <div className="text-[10px] text-slate-400">Delay Médio</div>
                        <div className="inline-flex items-center gap-1 font-bold text-slate-800">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {camp.stats.avgDelayMs}ms
                        </div>
                      </div>
                    </div>

                    {isExpanded && camp.recipients.length > 0 && (
                      <div className="thin-scrollbar mt-3 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                            <tr>
                              <th className="px-3 py-2">Contato</th>
                              <th className="px-3 py-2">Telefone</th>
                              <th className="px-3 py-2">Status</th>
                              <th className="px-3 py-2">Detalhe</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {camp.recipients.map((rec, i) => (
                              <tr key={`${rec.phone}-${i}`}>
                                <td className="px-3 py-2 font-semibold text-slate-800">
                                  {rec.name}
                                </td>
                                <td className="px-3 py-2 font-mono text-[11px] text-slate-600">
                                  {rec.phone}
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={cn(
                                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                                      rec.status === "sent" || rec.status === "saved_only"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-amber-100 text-amber-800",
                                    )}
                                  >
                                    {rec.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-[11px] text-slate-500">
                                  {rec.detail}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
