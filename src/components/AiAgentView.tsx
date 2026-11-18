"use client";

import React, { useEffect, useState } from "react";
import {
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Loader2,
  Mic,
  Play,
  Plus,
  Send,
  Square,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { AudioBubblePlayer } from "@/components/AudioBubblePlayer";
import { apiClient } from "@/lib/api-client";
import {
  DEFAULT_AI_GUARDRAILS,
  type AgentTurnResult,
  type AiAgentConfig,
  type AiGuardrails,
  type KnowledgeSource,
  type NoAnswerBehavior,
} from "@/lib/types";
import { cn, formatCurrencyBRL } from "@/lib/utils";

interface AiAgentViewProps {
  agent: AiAgentConfig | null;
  knowledgeSources: KnowledgeSource[];
  isDeveloper: boolean;
  canConfigure?: boolean;
  canManageKnowledge?: boolean;
  canTest?: boolean;
  onRefreshState: () => Promise<void>;
  onNotify: (msg: string) => void;
}

const AVAILABLE_MCP_TOOLS = [
  { id: "crm_move_lead_stage", label: "Mover negócio no funil", desc: "Avança o negócio de etapa após qualificar o contato" },
  { id: "crm_qualify_lead", label: "Qualificar contato", desc: "Registra perfil e interesse comercial do contato" },
  { id: "crm_request_human_handoff", label: "Transferir para atendente", desc: "Permite passar a conversa para um humano (handoff). Desligado: a IA nunca transfere" },
  { id: "crm_add_tag", label: "Aplicar etiquetas", desc: "Adiciona tags automáticas (ex.: Interesse Comercial)" },
];

const SOURCE_TYPE_LABEL: Record<KnowledgeSource["sourceType"], string> = {
  faq: "Perguntas & Respostas",
  pdf: "Documento",
  policy: "Política / Regras",
  catalog: "Catálogo / Preços",
};

// Rigor da correspondência (não-técnico) → limiar de similaridade.
const STRICTNESS = [
  { key: "flexivel", label: "Flexível", score: 0.33, hint: "Responde mesmo com correspondência parcial" },
  { key: "equilibrado", label: "Equilibrado", score: 0.42, hint: "Recomendado" },
  { key: "rigoroso", label: "Rigoroso", score: 0.52, hint: "Só responde com alta certeza" },
] as const;

function strictnessKeyFromScore(score: number): (typeof STRICTNESS)[number]["key"] {
  let best: (typeof STRICTNESS)[number] = STRICTNESS[1];
  let bestDiff = Infinity;
  for (const s of STRICTNESS) {
    const d = Math.abs(s.score - score);
    if (d < bestDiff) {
      bestDiff = d;
      best = s;
    }
  }
  return best.key;
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Icon className="h-4 w-4 text-violet-600" />
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

export function AiAgentView({
  agent,
  knowledgeSources,
  isDeveloper,
  canConfigure = true,
  canManageKnowledge = true,
  canTest = true,
  onRefreshState,
  onNotify,
}: AiAgentViewProps) {
  const [name, setName] = useState(agent?.name ?? "");
  const [provider, setProvider] = useState<AiAgentConfig["provider"]>(agent?.provider ?? "openai");
  const [model, setModel] = useState(agent?.model ?? "gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(agent?.temperature ?? 0.3);
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt ?? "");
  const [isActive, setIsActive] = useState(agent?.isActive ?? true);
  const [handoffRules, setHandoffRules] = useState(
    agent?.handoffRules ?? {
      explicitHumanRequest: true,
      negativeSentimentThreshold: 0.35,
      lowRagConfidenceHandoff: true,
      stageRequiresHuman: true,
    },
  );
  const [guardrails, setGuardrails] = useState<AiGuardrails>(agent?.guardrails ?? DEFAULT_AI_GUARDRAILS);
  const [mcpToolsEnabled, setMcpToolsEnabled] = useState<string[]>(agent?.mcpToolsEnabled ?? []);
  const [blockedInput, setBlockedInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [kbTitle, setKbTitle] = useState("");
  const [kbType, setKbType] = useState<KnowledgeSource["sourceType"]>("faq");
  const [kbContent, setKbContent] = useState("");
  const [addingKb, setAddingKb] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadWarn, setUploadWarn] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeSource | null>(null);
  const [deletingKb, setDeletingKb] = useState(false);

  const [testOpen, setTestOpen] = useState(false);
  const [testPrompt, setTestPrompt] = useState("");
  const [testContact, setTestContact] = useState("");
  const [testRunning, setTestRunning] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    Array<{
      role: "client" | "assistant";
      text: string;
      trace?: AgentTurnResult["trace"];
      /** Mensagem de áudio (simulação de voz): player + transcrição. */
      audioUrl?: string;
      durationSeconds?: number;
      transcribing?: boolean;
      /** Aviso do sistema (ex.: handoff pela regra dos 5 min). */
      system?: boolean;
    }>
  >([]);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  // Gravação de áudio na simulação (MediaRecorder).
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, testRunning]);

  useEffect(() => {
    if (!agent) return;
    setName(agent.name);
    setProvider(agent.provider);
    setModel(agent.model);
    setTemperature(agent.temperature);
    setSystemPrompt(agent.systemPrompt);
    setIsActive(agent.isActive);
    setHandoffRules(agent.handoffRules);
    setGuardrails(agent.guardrails ?? DEFAULT_AI_GUARDRAILS);
    setMcpToolsEnabled(agent.mcpToolsEnabled);
  }, [agent]);

  if (!agent) {
    return (
      <div className="p-8 text-sm text-slate-500">Nenhum assistente configurado para esta organização.</div>
    );
  }

  const budgetPct = Math.min(100, Math.round((agent.spentCents / Math.max(1, agent.monthlyBudgetCents)) * 100));
  const updateGuard = (patch: Partial<AiGuardrails>) => setGuardrails((g) => ({ ...g, ...patch }));

  const handleSaveAgent = async () => {
    setSaving(true);
    try {
      await apiClient.updateAiAgent({
        name,
        provider,
        model,
        ...(apiKey.trim() ? { apiKey } : {}),
        temperature,
        systemPrompt,
        isActive,
        handoffRules,
        guardrails,
        mcpToolsEnabled,
      });
      setApiKey("");
      await onRefreshState();
      onNotify("Assistente salvo.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddKb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kbTitle.trim() || !kbContent.trim()) return;
    setAddingKb(true);
    try {
      await apiClient.addKnowledgeSource({ title: kbTitle, sourceType: kbType, content: kbContent });
      setKbTitle("");
      setKbContent("");
      await onRefreshState();
      onNotify("Conteúdo adicionado e indexado na base.");
    } finally {
      setAddingKb(false);
    }
  };

  const handleUploadFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(pdf|docx|txt)$/i.test(file.name)) {
      onNotify("Formato não suportado. Envie PDF, DOCX ou TXT.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onNotify("Arquivo acima do limite de 5 MB.");
      return;
    }
    setUploading(true);
    setUploadWarn(null);
    setUploadSuccess(null);
    try {
      const dataBase64 = await fileToDataUrl(file);
      const res = await apiClient.uploadKnowledgeDocument({
        fileName: file.name,
        mimeType: file.type || undefined,
        dataBase64,
      });
      await onRefreshState();
      if (res.flaggedCount > 0) {
        setUploadWarn(
          `${res.flaggedCount} trecho(s) com possíveis instruções ocultas foram removidos por segurança.`,
        );
      }
      setUploadSuccess(`“${res.source.title}” adicionado e indexado (${res.source.chunksCount} trechos).`);
      onNotify(`Documento “${res.source.title}” adicionado e indexado.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Falha ao enviar o documento.");
    } finally {
      setUploading(false);
    }
  };

  const confirmDeleteKb = async () => {
    if (!deleteTarget) return;
    setDeletingKb(true);
    try {
      await apiClient.deleteKnowledgeSource(deleteTarget.id);
      await onRefreshState();
      onNotify("Conteúdo removido da base.");
      setDeleteTarget(null);
    } finally {
      setDeletingKb(false);
    }
  };

  const closeTest = () => {
    setTestOpen(false);
    setChatMessages([]);
    setTestPrompt("");
  };

  const sendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = testPrompt.trim();
    if (!text || testRunning) return;
    const history = chatMessages.map((m) => ({
      role: (m.role === "client" ? "user" : "assistant") as "user" | "assistant",
      text: m.text,
    }));
    setChatMessages((prev) => [...prev, { role: "client", text }]);
    setTestPrompt("");
    setTestRunning(true);
    try {
      const res = await apiClient.runAiTurn({
        userMessage: text,
        contactName: testContact.trim() || "Cliente",
        history,
      });
      const reply =
        res.replyText ||
        (res.shouldHandoff
          ? `↪ Transferido para um atendente — ${res.handoffReason ?? "handoff"}`
          : "(sem resposta — modo silencioso)");
      setChatMessages((prev) => [...prev, { role: "assistant", text: reply, trace: res.trace }]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: err instanceof Error ? err.message : "Erro ao simular resposta." },
      ]);
    } finally {
      setTestRunning(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read_error"));
      reader.readAsDataURL(blob);
    });

  // Envia um áudio gravado: transcreve no backend (whisper.cpp) e conduz o turno.
  const sendAudio = async (blob: Blob, approxDurationSeconds: number) => {
    if (testRunning) return;
    const history = chatMessages
      .map((m) => ({
        role: (m.role === "client" ? "user" : "assistant") as "user" | "assistant",
        text: m.text,
      }))
      .filter((h) => h.text.trim().length > 0);
    const audioUrl = URL.createObjectURL(blob);
    const idx = chatMessages.length;
    setChatMessages((prev) => [
      ...prev,
      { role: "client", text: "", audioUrl, durationSeconds: approxDurationSeconds, transcribing: true },
    ]);
    setTestRunning(true);
    try {
      const dataUrl = await blobToBase64(blob);
      const res = await apiClient.runAiAudioTurn({
        audioBase64: dataUrl,
        mimeType: blob.type || "audio/webm",
        contactName: testContact.trim() || "Cliente",
        history,
      });

      if (!res.ok) {
        setChatMessages((prev) =>
          prev.map((m, i) => (i === idx ? { ...m, transcribing: false, text: "(não foi possível transcrever)" } : m)),
        );
        const msg = res.disabled
          ? "Serviço de transcrição não configurado. Suba o transcription-service e defina TRANSCRIPTION_SERVICE_URL no backend."
          : res.error ?? "Falha ao transcrever o áudio.";
        setChatMessages((prev) => [...prev, { role: "assistant", text: `⚠ ${msg}`, system: true }]);
        return;
      }

      // Atualiza a bolha do áudio com a transcrição e a duração medida pelo serviço.
      setChatMessages((prev) =>
        prev.map((m, i) =>
          i === idx
            ? {
                ...m,
                transcribing: false,
                text: res.transcript || "(áudio sem fala reconhecida)",
                durationSeconds: res.durationSeconds || approxDurationSeconds,
              }
            : m,
        ),
      );

      if (res.handoff) {
        const reason = res.handoffReason ? ` (${res.handoffReason})` : "";
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `↪ ${res.replyText ?? "Transferido para um atendente humano."}${reason}`,
            system: true,
            trace: res.turn?.trace,
          },
        ]);
      } else {
        const reply = res.replyText || res.turn?.replyText || "(sem resposta — modo silencioso)";
        setChatMessages((prev) => [...prev, { role: "assistant", text: reply, trace: res.turn?.trace }]);
      }
    } catch (err) {
      setChatMessages((prev) => prev.map((m, i) => (i === idx ? { ...m, transcribing: false } : m)));
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: err instanceof Error ? err.message : "Erro ao transcrever/responder.", system: true },
      ]);
    } finally {
      setTestRunning(false);
    }
  };

  const startRecording = async () => {
    if (recording || testRunning) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      const startedAt = Date.now();
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        if (blob.size > 0) void sendAudio(blob, durationSeconds);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      onNotify("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
  };

  const addBlockedTopic = () => {
    const t = blockedInput.trim();
    if (!t) return;
    if (!guardrails.blockedTopics.includes(t)) {
      updateGuard({ blockedTopics: [...guardrails.blockedTopics, t] });
    }
    setBlockedInput("");
  };

  const strictnessKey = strictnessKeyFromScore(guardrails.minRelevanceScore);
  const toggleMcp = (id: string) =>
    setMcpToolsEnabled((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="thin-scrollbar flex h-full flex-col bg-slate-50">
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl space-y-5">
          {/* Cabeçalho + liga/desliga */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Assistente de atendimento</h2>
                <p className="text-xs text-slate-500">
                  Responde seus clientes no WhatsApp com base no que você ensinar abaixo.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canTest && (
                <button
                  type="button"
                  onClick={() => setTestOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-800 hover:bg-violet-100"
                >
                  <Play className="h-3.5 w-3.5" /> Testar assistente
                </button>
              )}
              <button
                type="button"
                disabled={!canConfigure}
                onClick={() => canConfigure && setIsActive((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-75",
                  isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", isActive ? "bg-emerald-500" : "bg-slate-400")} />
                {isActive ? "Respostas automáticas LIGADAS" : "Respostas automáticas DESLIGADAS"}
              </button>
            </div>
          </div>

          {/* Layout de 2 colunas */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
            {/* Coluna esquerda */}
            <div className="space-y-5">
              {/* Personalidade */}
              <SectionCard icon={Sparkles} title="Personalidade">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Nome do assistente</label>
                  <input
                    value={name}
                    disabled={!canConfigure}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Sofia, da Loja X"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Como o assistente deve se comportar
                  </label>
                  <p className="mb-1 text-[11px] text-slate-400">
                    Descreva o tom e o papel dele em linguagem natural. Ex.: “Você é a Sofia, atendente
                    simpática da Loja X. Seja breve, cordial e ajude o cliente a escolher produtos.”
                  </p>
                  <textarea
                    value={systemPrompt}
                    disabled={!canConfigure}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={5}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </SectionCard>

              {/* Habilidades do bot */}
              <SectionCard icon={Wrench} title="Habilidades do assistente">
                <p className="text-xs text-slate-500">
                  O que o assistente pode fazer sozinho durante o atendimento. Marque para ativar.
                </p>
                <div className="space-y-2">
                  {AVAILABLE_MCP_TOOLS.map((tool) => {
                    const on = mcpToolsEnabled.includes(tool.id);
                    return (
                      <label
                        key={tool.id}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-3 transition",
                          canConfigure ? "cursor-pointer" : "cursor-default opacity-80",
                          on ? "border-violet-200 bg-violet-50/50" : "border-slate-200 hover:bg-slate-50",
                        )}
                      >
                        <input
                          type="checkbox"
                          disabled={!canConfigure}
                          checked={on}
                          onChange={() => toggleMcp(tool.id)}
                          className="mt-0.5 accent-violet-600 disabled:cursor-not-allowed"
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-slate-800">{tool.label}</span>
                          <span className="block text-[11px] text-slate-500">{tool.desc}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </SectionCard>

              {/* Travas de segurança */}
              <SectionCard icon={ShieldCheck} title="Travas de segurança">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    disabled={!canConfigure}
                    checked={guardrails.groundingStrict}
                    onChange={(e) => updateGuard({ groundingStrict: e.target.checked })}
                    className="mt-0.5 accent-violet-600 disabled:cursor-not-allowed"
                  />
                  <span className="text-xs">
                    <span className="font-semibold text-slate-800">
                      Responder somente com a base de conhecimento
                    </span>
                    <span className="block text-slate-500">
                      A IA nunca inventa. Se a resposta não estiver na base, segue a regra abaixo.
                    </span>
                  </span>
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Rigor da correspondência</label>
                    <select
                      disabled={!canConfigure}
                      value={strictnessKey}
                      onChange={(e) =>
                        updateGuard({
                          minRelevanceScore: STRICTNESS.find((s) => s.key === e.target.value)?.score ?? 0.78,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      {STRICTNESS.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label} — {s.hint}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Quando a IA não souber</label>
                    <select
                      disabled={!canConfigure}
                      value={guardrails.noAnswerBehavior}
                      onChange={(e) => updateGuard({ noAnswerBehavior: e.target.value as NoAnswerBehavior })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      <option value="handoff">Transferir para um atendente</option>
                      <option value="safe_reply">Responder que não sabe</option>
                      <option value="silent">Ficar em silêncio (só sinalizar)</option>
                    </select>
                  </div>
                </div>

                {guardrails.noAnswerBehavior !== "silent" && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Mensagem quando não souber</label>
                    <textarea
                      disabled={!canConfigure}
                      value={guardrails.fallbackMessage}
                      onChange={(e) => updateGuard({ fallbackMessage: e.target.value })}
                      rows={2}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-700">Assuntos proibidos</label>
                  <p className="mb-1 text-[11px] text-slate-400">
                    A IA nunca responde sobre estes temas (ex.: “jurídico”, “reembolso”).
                  </p>
                  {canConfigure && (
                    <div className="flex items-center gap-2">
                      <input
                        value={blockedInput}
                        onChange={(e) => setBlockedInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addBlockedTopic();
                          }
                        }}
                        placeholder="Digite um tema e Enter"
                        className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={addBlockedTopic}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Adicionar
                      </button>
                    </div>
                  )}
                  {guardrails.blockedTopics.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {guardrails.blockedTopics.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700"
                        >
                          {t}
                          {canConfigure && (
                            <button
                              type="button"
                              onClick={() =>
                                updateGuard({ blockedTopics: guardrails.blockedTopics.filter((x) => x !== t) })
                              }
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : (
                    !canConfigure && <p className="text-[11px] italic text-slate-400">Nenhum assunto proibido cadastrado.</p>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <div className="mb-2 text-xs font-semibold text-slate-700">Transferir para um humano quando…</div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        disabled={!canConfigure}
                        checked={handoffRules.explicitHumanRequest}
                        onChange={(e) => setHandoffRules((r) => ({ ...r, explicitHumanRequest: e.target.checked }))}
                        className="accent-violet-600 disabled:cursor-not-allowed"
                      />
                      O cliente pedir para falar com uma pessoa
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        disabled={!canConfigure}
                        checked={handoffRules.stageRequiresHuman}
                        onChange={(e) => setHandoffRules((r) => ({ ...r, stageRequiresHuman: e.target.checked }))}
                        className="accent-violet-600 disabled:cursor-not-allowed"
                      />
                      O negócio estiver numa etapa do funil que exige atendimento humano
                    </label>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Coluna direita */}
            <div className="space-y-5">
              {/* Base de conhecimento */}
              <SectionCard icon={BookOpen} title="Base de conhecimento">
                <p className="text-xs text-slate-500">
                  Tudo o que o assistente pode responder vem daqui. Adicione perguntas &amp; respostas,
                  políticas, preços — ele usa só este conteúdo.
                </p>

                {canManageKnowledge && (
                  <>
                    <label
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!uploading) setDragActive(true);
                      }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragActive(false);
                        if (!uploading) handleUploadFile(e.dataTransfer.files?.[0]);
                      }}
                      className={cn(
                        "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-6 text-center transition",
                        uploading
                          ? "pointer-events-none border-slate-200 bg-slate-50 opacity-80"
                          : dragActive
                            ? "border-violet-400 bg-violet-50"
                            : "border-slate-200 bg-slate-50/60 hover:border-violet-300 hover:bg-slate-100",
                      )}
                    >
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          handleUploadFile(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                      {uploading ? (
                        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                      ) : (
                        <Upload className={cn("h-6 w-6", dragActive ? "text-violet-500" : "text-slate-400")} />
                      )}
                      <span className="text-xs font-semibold text-slate-700">
                        {uploading
                          ? "Processando documento…"
                          : dragActive
                            ? "Solte o arquivo aqui"
                            : "Arraste um arquivo ou clique para enviar"}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        PDF, DOCX ou TXT · até 5 MB · texto extraído e verificado contra instruções ocultas.
                      </span>
                    </label>
                    {uploadSuccess && (
                      <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-[11px] font-medium text-emerald-800">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {uploadSuccess}
                      </div>
                    )}
                    {uploadWarn && (
                      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800">
                        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {uploadWarn}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                      <span className="h-px flex-1 bg-slate-100" /> ou cole o texto
                      <span className="h-px flex-1 bg-slate-100" />
                    </div>

                    <form onSubmit={handleAddKb} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                        <input
                          value={kbTitle}
                          onChange={(e) => setKbTitle(e.target.value)}
                          placeholder="Título (ex.: Formas de pagamento)"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                        <select
                          value={kbType}
                          onChange={(e) => setKbType(e.target.value as KnowledgeSource["sourceType"])}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                        >
                          {Object.entries(SOURCE_TYPE_LABEL)
                            .filter(([v]) => v !== "pdf")
                            .map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                        </select>
                      </div>
                      <textarea
                        value={kbContent}
                        onChange={(e) => setKbContent(e.target.value)}
                        rows={3}
                        placeholder="Conteúdo. Ex.: Aceitamos Pix, cartão em até 12x e boleto. Pedidos acima de R$200 têm frete grátis."
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={addingKb || !kbTitle.trim() || !kbContent.trim()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" /> {addingKb ? "Indexando..." : "Adicionar à base"}
                      </button>
                    </form>
                  </>
                )}

                <div className="thin-scrollbar max-h-72 space-y-2 overflow-y-auto pr-1">
                  {knowledgeSources.length === 0 && (
                    <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                      Nenhum conteúdo ainda. Comece pelas perguntas e respostas mais comuns.
                    </p>
                  )}
                  {knowledgeSources.map((src) => (
                    <div
                      key={src.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-slate-900">{src.title}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {SOURCE_TYPE_LABEL[src.sourceType]}
                          </span>
                          {src.indexed ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" /> Indexada ({src.chunksCount})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              <ShieldAlert className="h-3 w-3" /> Sem busca semântica
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{src.content}</p>
                      </div>
                      {canManageKnowledge && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(src)}
                          title="Remover"
                          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {knowledgeSources.some((s) => !s.indexed) && (
                  <p className="text-[11px] text-amber-600">
                    Itens “sem busca semântica” não têm embeddings — configure a API Key da OpenAI na área
                    Avançado para ativar a busca inteligente.
                  </p>
                )}
              </SectionCard>

            </div>
          </div>

          {/* Avançado (somente developer) */}
          {isDeveloper && (
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex w-full items-center justify-between gap-2 p-5"
              >
                <span className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-bold text-slate-900">Avançado (Developer)</span>
                </span>
                <ChevronDown className={cn("h-4 w-4 text-slate-400 transition", showAdvanced && "rotate-180")} />
              </button>
              {showAdvanced && (
                <div className="grid grid-cols-1 gap-4 border-t border-slate-100 p-5 lg:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Provedor</label>
                    <select
                      disabled={!canConfigure}
                      value={provider}
                      onChange={(e) => setProvider(e.target.value as AiAgentConfig["provider"])}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="google">Google</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Modelo</label>
                    <input
                      disabled={!canConfigure}
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      API Key {provider === "openai" ? "(OpenAI)" : ""}
                    </label>
                    <input
                      type="password"
                      disabled={!canConfigure}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="•••••• (deixe em branco para manter)"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Usada também para gerar os embeddings da base (OpenAI).
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      Temperatura ({temperature.toFixed(1)})
                    </label>
                    <input
                      type="range"
                      disabled={!canConfigure}
                      min={0}
                      max={1}
                      step={0.1}
                      value={temperature}
                      onChange={(e) => setTemperature(Number(e.target.value))}
                      className="mt-3 w-full accent-violet-600 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 lg:col-span-2">
                    <div className="text-[11px] font-semibold text-slate-400">Orçamento mensal</div>
                    <div className="text-xs font-bold text-slate-800">
                      {formatCurrencyBRL(agent.spentCents)} / {formatCurrencyBRL(agent.monthlyBudgetCents)} ({budgetPct}%)
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-violet-600" style={{ width: `${budgetPct}%` }} />
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* Barra de salvar */}
      {canConfigure && (
        <div className="flex shrink-0 justify-end border-t border-slate-200 bg-white px-6 py-3">
          <button
            type="button"
            onClick={handleSaveAgent}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#16A34A] px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      )}

      {/* Modal: confirmar exclusão */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => !deletingKb && setDeleteTarget(null)}
            className="absolute inset-0 cursor-default"
          />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Excluir conteúdo</h3>
            </div>
            <p className="mt-3 text-xs text-slate-600">
              Remover <span className="font-semibold text-slate-900">“{deleteTarget.title}”</span> da base
              de conhecimento? A IA deixará de usar este conteúdo. Esta ação não pode ser desfeita.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingKb}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteKb}
                disabled={deletingKb}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> {deletingKb ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Testar assistente (chat simulado) */}
      {testOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <button type="button" aria-label="Fechar" onClick={closeTest} className="absolute inset-0 cursor-default" />
          <div className="relative flex h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Cabeçalho estilo conversa */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Simulação de atendimento</div>
                  <div className="text-[11px] text-slate-400">Você escreve como o cliente</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={testContact}
                  onChange={(e) => setTestContact(e.target.value)}
                  placeholder="Nome do cliente"
                  className="hidden w-32 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs sm:block"
                />
                <button
                  type="button"
                  onClick={closeTest}
                  title="Fechar e limpar"
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Área de mensagens */}
            <div className="thin-scrollbar flex-1 space-y-2.5 overflow-y-auto bg-slate-100 p-4">
              {chatMessages.length === 0 && (
                <div className="mx-auto mt-8 max-w-[80%] rounded-xl bg-white/70 px-4 py-3 text-center text-xs text-slate-500">
                  Escreva uma mensagem como se fosse o cliente. O assistente responde usando a base de
                  conhecimento e as travas configuradas.
                </div>
              )}
              {chatMessages.map((m, i) => {
                const isClient = m.role === "client";
                if (m.system) {
                  return (
                    <div key={i} className="flex justify-center">
                      <div className="max-w-[85%] rounded-xl bg-amber-50 px-3 py-1.5 text-center text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
                        {m.text}
                      </div>
                    </div>
                  );
                }
                const hasAudio = isClient && Boolean(m.audioUrl);
                return (
                  <div key={i} className={cn("flex", isClient ? "justify-start" : "justify-end")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                        isClient
                          ? "rounded-tl-sm bg-white text-slate-900"
                          : "rounded-tr-sm bg-[#D9FDD3] text-slate-900",
                      )}
                    >
                      {!isClient && (
                        <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">
                          <Bot className="h-3 w-3" /> {name || "Assistente"} (IA)
                        </div>
                      )}
                      {hasAudio && m.audioUrl && (
                        <div className="mb-1.5">
                          <AudioBubblePlayer
                            src={m.audioUrl}
                            durationSeconds={m.durationSeconds}
                          />
                        </div>
                      )}
                      {hasAudio ? (
                        m.transcribing ? (
                          <p className="flex items-center gap-1.5 text-xs italic text-slate-500">
                            <Loader2 className="h-3 w-3 animate-spin" /> transcrevendo áudio…
                          </p>
                        ) : (
                          <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
                            <span className="font-semibold text-slate-400">Transcrição: </span>
                            <span className="italic">{m.text}</span>
                          </p>
                        )
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                      )}
                      {m.trace && (
                        <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
                          {typeof m.trace.ragTopScore === "number" && (
                            <span className="rounded bg-black/5 px-1.5 py-0.5 font-semibold text-slate-600">
                              {(m.trace.ragTopScore * 100).toFixed(0)}%
                            </span>
                          )}
                          {m.trace.ragSourcesUsed.length > 0 && (
                            <span className="rounded bg-violet-100 px-1.5 py-0.5 font-semibold text-violet-700">
                              {m.trace.ragSourcesUsed.join(", ")}
                            </span>
                          )}
                          {m.trace.mcpToolsCalled.map((t, j) => (
                            <span key={j} className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-700">
                              {t.summary}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {testRunning && (
                <div className="flex justify-end">
                  <div className="rounded-2xl rounded-tr-sm bg-[#D9FDD3] px-4 py-2.5 shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Barra de envio */}
            <form onSubmit={sendChat} className="flex items-center gap-2 border-t border-slate-200 bg-white p-3">
              <input
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                placeholder={recording ? "Gravando áudio…" : "Mensagem do cliente…"}
                disabled={recording}
                className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-300 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={testRunning && !recording}
                title={recording ? "Parar e transcrever" : "Gravar áudio"}
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40",
                  recording ? "animate-pulse bg-red-500 hover:bg-red-600" : "bg-slate-500 hover:bg-slate-600",
                )}
              >
                {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                type="submit"
                disabled={testRunning || recording || !testPrompt.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#16A34A] text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
