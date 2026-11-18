"use client";

import React, { useEffect, useState } from "react";
import {
  Copy,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Wifi,
} from "lucide-react";
import { API_BASE_URL, apiClient } from "@/lib/api-client";
import type {
  ChannelSession,
  EvolutionSecretTtl,
  MetaTemplate,
  Organization,
  TemplateCategory,
  TemplateStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface SettingsViewProps {
  organization: Organization;
  channels: ChannelSession[];
  metaTemplates: MetaTemplate[];
  onRefreshState: () => Promise<void>;
  onNotify: (msg: string) => void;
  /** Pode criar/alterar a config da Evolution API (URL, instância, chaves). */
  canEditEvolutionConfig: boolean;
  /** Pode operar canais: travas anti-bloqueio, leitura de QR, etc. */
  canEditChannels: boolean;
  canCreateMetaChannel?: boolean;
  canDeleteChannel?: boolean;
  canViewSecrets?: boolean;
  canViewTemplates?: boolean;
  canCreateTemplate?: boolean;
  canSyncTemplates?: boolean;
  canEditTemplate?: boolean;
  canDeleteTemplate?: boolean;
}

export function SettingsView({
  organization,
  channels,
  metaTemplates,
  onRefreshState,
  onNotify,
  canEditEvolutionConfig,
  canEditChannels,
  canCreateMetaChannel = true,
  canDeleteChannel = true,
  canViewSecrets = true,
  canViewTemplates = true,
  canCreateTemplate = true,
  canSyncTemplates = true,
  canEditTemplate = true,
  canDeleteTemplate = true,
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<"evolution" | "meta">("evolution");

  const evolutionChannels = channels.filter((c) => c.provider === "evolution");
  const metaChannels = channels.filter((c) => c.provider === "meta_cloud");

  const [selectedEvolutionId, setSelectedEvolutionId] = useState(evolutionChannels[0]?.id ?? "");
  const [selectedMetaId, setSelectedMetaId] = useState(metaChannels[0]?.id ?? "");

  const evolutionChannel =
    evolutionChannels.find((c) => c.id === selectedEvolutionId) ?? evolutionChannels[0];
  const metaChannel = metaChannels.find((c) => c.id === selectedMetaId) ?? metaChannels[0];

  // Evolution API form
  const [evolutionBaseUrl, setEvolutionBaseUrl] = useState(evolutionChannel?.evolutionBaseUrl ?? "");
  const [evolutionInstanceName, setEvolutionInstanceName] = useState(
    evolutionChannel?.evolutionInstanceName ?? "",
  );
  const [evolutionApiKey, setEvolutionApiKey] = useState(evolutionChannel?.evolutionApiKey ?? "");
  const [evolutionWebhookSecret, setEvolutionWebhookSecret] = useState(
    evolutionChannel?.evolutionWebhookSecret ?? "",
  );
  const [antiBan, setAntiBan] = useState(
    evolutionChannel?.antiBan ?? {
      throttleMinMs: 1800,
      throttleMaxMs: 4200,
      dailyCap: 250,
      sentToday: 0,
      warmupEnabled: true,
      businessHoursOnly: true,
      stopOptOutEnabled: true,
    },
  );
  const [secretTtl, setSecretTtl] = useState<EvolutionSecretTtl>("never");
  const [generatingSecret, setGeneratingSecret] = useState(false);
  const [lastGeneratedSecret, setLastGeneratedSecret] = useState<string | null>(null);
  const [evolutionQrImg, setEvolutionQrImg] = useState<string | null>(null);
  const [evolutionQrError, setEvolutionQrError] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [testingEvolution, setTestingEvolution] = useState(false);
  const [evolutionFeedback, setEvolutionFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Meta Cloud API form
  const [metaPhoneId, setMetaPhoneId] = useState(metaChannel?.metaPhoneNumberId ?? "");
  const [metaWabaId, setMetaWabaId] = useState(metaChannel?.metaWabaId ?? "");
  const [metaToken, setMetaToken] = useState(metaChannel?.metaAccessToken ?? "");
  const [metaAppSecret, setMetaAppSecret] = useState(metaChannel?.metaAppSecret ?? "");
  const [metaVerifyToken, setMetaVerifyToken] = useState(metaChannel?.metaVerifyToken ?? "");
  const [testingMeta, setTestingMeta] = useState(false);
  const [syncingMeta, setSyncingMeta] = useState(false);
  const [metaFeedback, setMetaFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Novo Template Meta
  const [tplName, setTplName] = useState("");
  const [tplLanguage, setTplLanguage] = useState("pt_BR");
  const [tplCategory, setTplCategory] = useState<TemplateCategory>("UTILITY");
  const [tplHeader, setTplHeader] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [tplFooter, setTplFooter] = useState("");
  const [tplSubmitToMeta, setTplSubmitToMeta] = useState(true);
  const [tplCreating, setTplCreating] = useState(false);

  useEffect(() => {
    setEvolutionBaseUrl(evolutionChannel?.evolutionBaseUrl ?? "");
    setEvolutionInstanceName(evolutionChannel?.evolutionInstanceName ?? "");
    setEvolutionApiKey(evolutionChannel?.evolutionApiKey ?? "");
    setEvolutionWebhookSecret(evolutionChannel?.evolutionWebhookSecret ?? "");
    if (evolutionChannel?.antiBan) setAntiBan(evolutionChannel.antiBan);
  }, [evolutionChannel]);

  useEffect(() => {
    setMetaPhoneId(metaChannel?.metaPhoneNumberId ?? "");
    setMetaWabaId(metaChannel?.metaWabaId ?? "");
    setMetaToken(metaChannel?.metaAccessToken ?? "");
    setMetaAppSecret(metaChannel?.metaAppSecret ?? "");
    setMetaVerifyToken(metaChannel?.metaVerifyToken ?? "");
  }, [metaChannel]);

  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value);
    onNotify("Copiado para a área de transferência.");
  };

  const handleSaveAndTestEvolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evolutionChannel) return;
    // Sem permissão para a config, um submit (ex.: Enter num campo) só salva travas.
    if (!canEditEvolutionConfig) {
      if (canEditChannels) await handleSaveLocks();
      return;
    }
    setTestingEvolution(true);
    setEvolutionFeedback(null);
    try {
      await apiClient.updateChannel(evolutionChannel.id, {
        evolutionBaseUrl,
        evolutionInstanceName,
        evolutionApiKey,
        evolutionWebhookSecret,
        antiBan,
      });

      const testRes = await apiClient.testChannelConnection({
        provider: "evolution",
        baseUrl: evolutionBaseUrl,
        instanceName: evolutionInstanceName,
        apiKey: evolutionApiKey,
      });

      if (!testRes.ok) {
        setEvolutionFeedback({
          ok: false,
          msg: testRes.error ?? "Falha ao validar na Evolution API (credenciais salvas).",
        });
        await onRefreshState();
        return;
      }

      await apiClient.updateChannel(evolutionChannel.id, {
        status: testRes.status === "open" ? "connected" : "scan_qr",
        phoneNumber: testRes.phoneNumber ?? evolutionChannel.phoneNumber,
      });
      await onRefreshState();
      setEvolutionFeedback({ ok: true, msg: testRes.message ?? "Evolution API conectada." });
      onNotify("Configurações da Evolution API e travas anti-bloqueio salvas.");
    } finally {
      setTestingEvolution(false);
    }
  };

  // Salva apenas as travas anti-bloqueio (sem tocar na config da API).
  // Usado por quem pode operar o canal mas não editar a config (ex.: admin).
  const handleSaveLocks = async () => {
    if (!evolutionChannel) return;
    setTestingEvolution(true);
    setEvolutionFeedback(null);
    try {
      await apiClient.updateChannel(evolutionChannel.id, { antiBan });
      await onRefreshState();
      setEvolutionFeedback({ ok: true, msg: "Travas anti-bloqueio salvas." });
      onNotify("Travas anti-bloqueio da Evolution API salvas.");
    } catch (err) {
      setEvolutionFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : "Falha ao salvar as travas.",
      });
    } finally {
      setTestingEvolution(false);
    }
  };

  const handleGenerateSecret = async () => {
    if (!evolutionChannel) return;
    setGeneratingSecret(true);
    setEvolutionFeedback(null);
    try {
      const res = await apiClient.regenerateEvolutionWebhookSecret(evolutionChannel.id, secretTtl);
      setEvolutionWebhookSecret(res.secret);
      setLastGeneratedSecret(res.secret);
      await onRefreshState();
      setEvolutionFeedback({
        ok: true,
        msg: `Novo webhook secret gerado${
          res.expiresAt ? ` (expira em ${new Date(res.expiresAt).toLocaleString("pt-BR")})` : " (sem expiração)"
        }. Copie-o e atualize o header x-webhook-secret na Evolution.`,
      });
      onNotify("Novo webhook secret gerado.");
    } catch (err) {
      setEvolutionFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : "Falha ao gerar o webhook secret.",
      });
    } finally {
      setGeneratingSecret(false);
    }
  };

  const handleFetchEvolutionQr = async () => {
    if (!evolutionChannel) return;
    setLoadingQr(true);
    setEvolutionQrError(null);
    try {
      const res = await apiClient.getEvolutionQr(evolutionChannel.id);
      setEvolutionQrImg(res.qrImageBase64);
      if (res.status === "open") {
        onNotify("Instância Evolution API já está conectada (open)!");
      }
      await onRefreshState();
    } catch (err) {
      setEvolutionQrImg(null);
      setEvolutionQrError(err instanceof Error ? err.message : "Erro ao buscar QR Code na Evolution API.");
    } finally {
      setLoadingQr(false);
    }
  };

  const handleConnectMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metaChannel || !canEditChannels) return;
    setTestingMeta(true);
    setMetaFeedback(null);
    try {
      await apiClient.updateChannel(metaChannel.id, {
        metaPhoneNumberId: metaPhoneId,
        metaWabaId: metaWabaId,
        metaAccessToken: metaToken,
        metaAppSecret: metaAppSecret,
        metaVerifyToken: metaVerifyToken,
      });

      const res = await apiClient.testChannelConnection({
        provider: "meta_cloud",
        phoneNumberId: metaPhoneId,
        wabaId: metaWabaId,
        accessToken: metaToken,
      });
      if (!res.ok) {
        setMetaFeedback({ ok: false, msg: res.error ?? "A Meta recusou as credenciais." });
        await onRefreshState();
        return;
      }

      await apiClient.updateChannel(metaChannel.id, {
        displayName: res.displayName ?? metaChannel.displayName,
        phoneNumber: res.phoneNumber ?? metaChannel.phoneNumber,
        status: "connected",
        webhookRegistered: true,
      });
      await onRefreshState();
      setMetaFeedback({ ok: true, msg: res.message ?? "API Oficial da Meta conectada." });
      onNotify("API Oficial da Meta validada e conectada.");
    } finally {
      setTestingMeta(false);
    }
  };

  const handleSyncMetaTemplates = async () => {
    if (!metaChannel) return;
    setSyncingMeta(true);
    try {
      const res = await apiClient.syncMetaTemplates(metaChannel.id);
      await onRefreshState();
      onNotify(`${res.imported} templates sincronizados da Meta Graph API.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Erro ao sincronizar templates.");
    } finally {
      setSyncingMeta(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metaChannel || !tplName.trim() || !tplBody.trim()) return;
    setTplCreating(true);
    try {
      const varCount = (tplBody.match(/\{\{\d+\}\}/g) ?? []).length;
      const created = await apiClient.addMetaTemplate({
        channelSessionId: metaChannel.id,
        name: tplName.toLowerCase().replace(/[^a-z0-9_]+/g, "_"),
        language: tplLanguage,
        category: tplCategory,
        status: tplSubmitToMeta && metaChannel.metaWabaId && metaChannel.metaAccessToken ? "PENDING" : "APPROVED",
        headerText: tplHeader.trim() || undefined,
        bodyText: tplBody.trim(),
        footerText: tplFooter.trim() || undefined,
        variablesCount: varCount,
        submitToMeta: tplSubmitToMeta,
      });
      setTplName("");
      setTplHeader("");
      setTplBody("");
      setTplFooter("");
      await onRefreshState();
      onNotify(
        created.metaSyncStatus === "submitted_to_meta"
          ? "Modelo enviado à conta oficial e salvo!"
          : "Modelo salvo.",
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Erro ao criar template da Meta.");
    } finally {
      setTplCreating(false);
    }
  };

  const evolutionWebhookUrl = `${API_BASE_URL}/webhooks/evolution/${evolutionChannel?.webhookPathToken ?? ""}`;

  const secretExpiresAt = evolutionChannel?.evolutionWebhookSecretExpiresAt ?? null;
  const secretExpired = !!secretExpiresAt && new Date(secretExpiresAt).getTime() < Date.now();
  const secretStatusLabel = !evolutionChannel?.evolutionWebhookSecretSet
    ? "nenhum secret configurado"
    : !secretExpiresAt
      ? "sem expiração"
      : secretExpired
        ? `expirado em ${new Date(secretExpiresAt).toLocaleDateString("pt-BR")}`
        : `expira em ${new Date(secretExpiresAt).toLocaleDateString("pt-BR")}`;
  const metaWebhookUrl = `${API_BASE_URL}/webhooks/meta/${metaChannel?.webhookPathToken ?? ""}`;

  return (
    <div className="thin-scrollbar h-full overflow-y-auto bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Configurações de Canais WhatsApp ({organization.name})
            </h2>
            <p className="text-xs text-slate-500">
              Conecte instâncias reais da Evolution API (QR Code) e da API Oficial da Meta com travas anti-bloqueio.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("evolution")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 transition",
                activeTab === "evolution" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600",
              )}
            >
              <QrCode className="h-4 w-4" />
              Evolution API (QR)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("meta")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 transition",
                activeTab === "meta" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600",
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              API Oficial da Meta
            </button>
          </div>
        </div>

        {/* ABA 1: EVOLUTION API */}
        {activeTab === "evolution" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {evolutionChannels.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedEvolutionId(ch.id)}
                    className={cn(
                      "rounded-xl border px-3 py-1.5 text-xs font-semibold",
                      evolutionChannel?.id === ch.id
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-700",
                    )}
                  >
                    {ch.displayName}
                  </button>
                ))}
              </div>
              {evolutionChannels.length === 0 && canEditEvolutionConfig && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const created = await apiClient.createChannel({
                        provider: "evolution",
                        displayName: "WhatsApp QR (Evolution API)",
                      });
                      setSelectedEvolutionId(created.id);
                      await onRefreshState();
                    } catch (err) {
                      onNotify(
                        err instanceof Error ? err.message : "Erro ao criar a instância Evolution.",
                      );
                    }
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  + Instância Evolution
                </button>
              )}
            </div>

            {evolutionChannel && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <form
                  onSubmit={handleSaveAndTestEvolution}
                  className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Conexão Evolution API (Baileys v2)</h3>
                      <p className="text-xs text-slate-500">
                        {evolutionChannel.displayName}{" "}
                        {evolutionChannel.phoneNumber ? `· ${evolutionChannel.phoneNumber}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-bold",
                          evolutionChannel.status === "connected"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800",
                        )}
                      >
                        {evolutionChannel.status === "connected" ? "Conectado" : "Desconectado / QR"}
                      </span>
                      {canDeleteChannel && evolutionChannels.length > 0 && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await apiClient.deleteChannel(evolutionChannel.id);
                              setSelectedEvolutionId("");
                              await onRefreshState();
                              onNotify("Canal removido.");
                            } catch (err) {
                              onNotify(err instanceof Error ? err.message : "Erro ao remover canal.");
                            }
                          }}
                          title="Remover canal"
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-700">URL da Evolution API *</label>
                      <input
                        type="url"
                        required
                        disabled={!canEditEvolutionConfig}
                        value={evolutionBaseUrl}
                        onChange={(e) => setEvolutionBaseUrl(e.target.value)}
                        placeholder="https://evolution.seudominio.com"
                        className={cn(
                          "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono",
                          !canEditEvolutionConfig && "cursor-not-allowed bg-slate-50 text-slate-500",
                        )}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700">Nome da Instância *</label>
                      <input
                        type="text"
                        required
                        disabled={!canEditEvolutionConfig}
                        value={evolutionInstanceName}
                        onChange={(e) => setEvolutionInstanceName(e.target.value)}
                        placeholder="crm-orbit"
                        className={cn(
                          "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono",
                          !canEditEvolutionConfig && "cursor-not-allowed bg-slate-50 text-slate-500",
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-700">Evolution API Key (apikey)</label>
                      <input
                        type="password"
                        disabled={!canEditEvolutionConfig}
                        placeholder={canEditEvolutionConfig ? undefined : "•••••• (oculto)"}
                        value={canEditEvolutionConfig ? evolutionApiKey : ""}
                        onChange={(e) => setEvolutionApiKey(e.target.value)}
                        className={cn(
                          "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm",
                          !canEditEvolutionConfig && "cursor-not-allowed bg-slate-50 text-slate-500",
                        )}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700">Webhook Secret (x-webhook-secret)</label>
                      <input
                        type="password"
                        disabled={!canEditEvolutionConfig}
                        placeholder={canEditEvolutionConfig ? undefined : "•••••• (oculto)"}
                        value={canEditEvolutionConfig ? evolutionWebhookSecret : ""}
                        onChange={(e) => setEvolutionWebhookSecret(e.target.value)}
                        className={cn(
                          "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm",
                          !canEditEvolutionConfig && "cursor-not-allowed bg-slate-50 text-slate-500",
                        )}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs">
                        <span className="font-semibold text-slate-700">Validade do webhook secret:</span>{" "}
                        <span className={cn("font-medium", secretExpired ? "text-red-600" : "text-slate-600")}>
                          {secretStatusLabel}
                        </span>
                      </div>
                      {canEditEvolutionConfig && (
                        <div className="flex items-center gap-2">
                          <select
                            value={secretTtl}
                            onChange={(e) => setSecretTtl(e.target.value as EvolutionSecretTtl)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                          >
                            <option value="1w">1 semana</option>
                            <option value="1m">1 mês</option>
                            <option value="1y">1 ano</option>
                            <option value="never">Sem expiração</option>
                          </select>
                          <button
                            type="button"
                            onClick={handleGenerateSecret}
                            disabled={generatingSecret}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            <RefreshCw className={cn("h-3.5 w-3.5", generatingSecret && "animate-spin")} />
                            {evolutionChannel.evolutionWebhookSecretSet ? "Regenerar secret" : "Gerar secret"}
                          </button>
                        </div>
                      )}
                    </div>
                    {canEditEvolutionConfig && lastGeneratedSecret && (
                      <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                          Novo secret (copie agora — não será exibido de novo)
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <code className="flex-1 truncate rounded-md border border-emerald-200 bg-white px-2 py-1.5 font-mono text-xs text-slate-800">
                            {lastGeneratedSecret}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyText(lastGeneratedSecret)}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-xs font-semibold hover:bg-emerald-50"
                          >
                            <Copy className="h-3.5 w-3.5" /> Copiar
                          </button>
                        </div>
                      </div>
                    )}
                    {canEditEvolutionConfig && (
                      <p className="mt-2 text-[11px] text-slate-400">
                        Ao gerar/regenerar, o secret é salvo na hora. Copie-o e atualize o header{" "}
                        <code className="font-mono">x-webhook-secret</code> na Evolution — o valor anterior
                        deixa de valer.
                      </p>
                    )}
                  </div>

                  {canEditEvolutionConfig && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Webhook Evolution API (Configure em Events → messages.upsert)
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="flex-1 truncate rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800">
                          {evolutionWebhookUrl}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyText(evolutionWebhookUrl)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100"
                        >
                          <Copy className="h-3.5 w-3.5" /> Copiar
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-emerald-900">
                        Travas de Segurança Anti-Bloqueio (Evolution API)
                      </h4>
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                        Enviadas hoje: {antiBan.sentToday} / {antiBan.dailyCap}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                      <div>
                        <label className="font-semibold text-slate-700">Intervalo mín. (ms)</label>
                        <input
                          type="number"
                          disabled={!canEditChannels}
                          value={antiBan.throttleMinMs}
                          onChange={(e) => setAntiBan((a) => ({ ...a, throttleMinMs: Number(e.target.value) }))}
                          className={cn(
                            "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5",
                            !canEditChannels && "cursor-not-allowed bg-slate-50 text-slate-500",
                          )}
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700">Intervalo máx. (ms)</label>
                        <input
                          type="number"
                          disabled={!canEditChannels}
                          value={antiBan.throttleMaxMs}
                          onChange={(e) => setAntiBan((a) => ({ ...a, throttleMaxMs: Number(e.target.value) }))}
                          className={cn(
                            "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5",
                            !canEditChannels && "cursor-not-allowed bg-slate-50 text-slate-500",
                          )}
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700">Teto diário (msgs)</label>
                        <input
                          type="number"
                          disabled={!canEditChannels}
                          value={antiBan.dailyCap}
                          onChange={(e) => setAntiBan((a) => ({ ...a, dailyCap: Number(e.target.value) }))}
                          className={cn(
                            "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5",
                            !canEditChannels && "cursor-not-allowed bg-slate-50 text-slate-500",
                          )}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-700">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
                        <input
                          type="checkbox"
                          disabled={!canEditChannels}
                          checked={antiBan.warmupEnabled}
                          onChange={(e) => setAntiBan((a) => ({ ...a, warmupEnabled: e.target.checked }))}
                          className="accent-emerald-600"
                        />
                        Warm-up progressivo
                      </label>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
                        <input
                          type="checkbox"
                          disabled={!canEditChannels}
                          checked={antiBan.businessHoursOnly}
                          onChange={(e) => setAntiBan((a) => ({ ...a, businessHoursOnly: e.target.checked }))}
                          className="accent-emerald-600"
                        />
                        Apenas horário comercial
                      </label>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
                        <input
                          type="checkbox"
                          disabled={!canEditChannels}
                          checked={antiBan.stopOptOutEnabled}
                          onChange={(e) => setAntiBan((a) => ({ ...a, stopOptOutEnabled: e.target.checked }))}
                          className="accent-emerald-600"
                        />
                        Opt-Out automático (STOP/SAIR)
                      </label>
                    </div>
                  </div>

                  {evolutionFeedback && (
                    <div
                      className={cn(
                        "rounded-xl border px-3.5 py-2.5 text-xs font-medium",
                        evolutionFeedback.ok
                          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                          : "border-amber-200 bg-amber-50 text-amber-900",
                      )}
                    >
                      {evolutionFeedback.msg}
                    </div>
                  )}

                  {canEditEvolutionConfig ? (
                    <button
                      type="submit"
                      disabled={testingEvolution}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#16A34A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Wifi className="h-4 w-4" />
                      {testingEvolution ? "Salvando e testando Evolution API..." : "Salvar e Testar Evolution API"}
                    </button>
                  ) : canEditChannels ? (
                    <button
                      type="button"
                      onClick={handleSaveLocks}
                      disabled={testingEvolution}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#16A34A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {testingEvolution ? "Salvando travas..." : "Salvar Travas Anti-Bloqueio"}
                    </button>
                  ) : null}
                </form>

                {/* QR Code Real da Evolution API */}
                <div className="flex flex-col items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">QR Code ao Vivo (Evolution API)</h4>
                    <p className="mt-1 text-xs text-slate-500">
                      Busca o QR Code de pareamento direto do endpoint /instance/connect da sua Evolution API.
                    </p>
                  </div>

                  <div className="my-4 flex h-48 w-48 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-3">
                    {loadingQr ? (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                        <div className="h-28 w-28 animate-pulse rounded-xl bg-slate-200" />
                        <div className="h-2.5 w-24 animate-pulse rounded bg-slate-200" />
                      </div>
                    ) : evolutionQrImg ? (
                      <img src={evolutionQrImg} alt="QR Code Evolution API" className="h-44 w-44 rounded-lg object-contain" />
                    ) : evolutionQrError ? (
                      <p className="text-[11px] font-medium text-red-600">{evolutionQrError}</p>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Salve URL + Instância e clique abaixo para buscar o QR Code na Evolution API.
                      </p>
                    )}
                  </div>

                  {canEditChannels && (
                    <button
                      type="button"
                      onClick={handleFetchEvolutionQr}
                      disabled={loadingQr}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", loadingQr && "animate-spin")} />
                      {loadingQr ? "Consultando Evolution API..." : "Buscar QR Code da Evolution API"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA 2: API OFICIAL DA META */}
        {activeTab === "meta" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {metaChannels.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedMetaId(ch.id)}
                    className={cn(
                      "rounded-xl border px-3 py-1.5 text-xs font-semibold",
                      metaChannel?.id === ch.id
                        ? "border-blue-500 bg-blue-50 text-blue-800"
                        : "border-slate-200 bg-white text-slate-700",
                    )}
                  >
                    {ch.displayName}
                  </button>
                ))}
              </div>
              {canCreateMetaChannel && (
                <button
                  type="button"
                  onClick={async () => {
                    const created = await apiClient.createChannel({
                      provider: "meta_cloud",
                      displayName: `Meta Cloud #${metaChannels.length + 1}`,
                    });
                    setSelectedMetaId(created.id);
                    await onRefreshState();
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  + Novo Canal Meta
                </button>
              )}
            </div>

            {metaChannel && (
              <>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <form
                    onSubmit={handleConnectMeta}
                    className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Credenciais WhatsApp Cloud API (Meta)</h3>
                        <p className="text-xs text-slate-500">Validação real na Meta Graph API v21.0.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-bold",
                            metaChannel.status === "connected"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {metaChannel.status === "connected" ? "Conectado" : "Desconectado"}
                        </span>
                        {canDeleteChannel && metaChannels.length > 0 && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await apiClient.deleteChannel(metaChannel.id);
                                setSelectedMetaId("");
                                await onRefreshState();
                                onNotify("Canal removido.");
                              } catch (err) {
                                onNotify(err instanceof Error ? err.message : "Erro ao remover canal.");
                              }
                            }}
                            title="Remover canal"
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700">Phone Number ID *</label>
                      <input
                        type="text"
                        required
                        disabled={!canEditChannels}
                        value={metaPhoneId}
                        onChange={(e) => setMetaPhoneId(e.target.value)}
                        className={cn(
                          "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono",
                          !canEditChannels && "cursor-not-allowed bg-slate-50 text-slate-500",
                        )}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700">WABA ID *</label>
                      <input
                        type="text"
                        required
                        disabled={!canEditChannels}
                        value={metaWabaId}
                        onChange={(e) => setMetaWabaId(e.target.value)}
                        className={cn(
                          "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono",
                          !canEditChannels && "cursor-not-allowed bg-slate-50 text-slate-500",
                        )}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700">Token de Acesso Permanente *</label>
                      <input
                        type="password"
                        required
                        disabled={!canEditChannels}
                        value={canViewSecrets || canEditChannels ? metaToken : ""}
                        onChange={(e) => setMetaToken(e.target.value)}
                        placeholder={canViewSecrets || canEditChannels ? "EAAG..." : "•••••• (oculto)"}
                        className={cn(
                          "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm",
                          !canEditChannels && "cursor-not-allowed bg-slate-50 text-slate-500",
                        )}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700">Meta App Secret</label>
                      <input
                        type="password"
                        disabled={!canEditChannels}
                        value={canViewSecrets || canEditChannels ? metaAppSecret : ""}
                        onChange={(e) => setMetaAppSecret(e.target.value)}
                        placeholder={canViewSecrets || canEditChannels ? undefined : "•••••• (oculto)"}
                        className={cn(
                          "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm",
                          !canEditChannels && "cursor-not-allowed bg-slate-50 text-slate-500",
                        )}
                      />
                    </div>

                    {metaFeedback && (
                      <div
                        className={cn(
                          "rounded-xl border px-3.5 py-2.5 text-xs font-medium",
                          metaFeedback.ok
                            ? "border-blue-200 bg-blue-50 text-blue-900"
                            : "border-red-200 bg-red-50 text-red-800",
                        )}
                      >
                        {metaFeedback.msg}
                      </div>
                    )}

                    {canEditChannels && (
                      <button
                        type="submit"
                        disabled={testingMeta}
                        className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {testingMeta ? "Validando com a Meta Graph API..." : "Validar com a Meta e Conectar"}
                      </button>
                    )}
                  </form>

                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-900">Webhook no Painel Meta for Developers</h3>
                    <p className="text-xs text-slate-500">
                      Configure em <strong>WhatsApp → Configuração</strong> para receber mensagens reais:
                    </p>

                    <div>
                      <label className="text-[11px] font-bold uppercase text-slate-400">Callback URL</label>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="flex-1 truncate rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                          {metaWebhookUrl}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyText(metaWebhookUrl)}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                        >
                          Copiar
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase text-slate-400">Verify Token</label>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="text"
                          disabled={!canEditChannels}
                          value={metaVerifyToken}
                          onChange={(e) => setMetaVerifyToken(e.target.value)}
                          className={cn(
                            "flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs",
                            !canEditChannels && "cursor-not-allowed text-slate-500",
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => copyText(metaVerifyToken)}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                        >
                          Copiar
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold uppercase text-slate-400">Campos a Assinar</span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700">
                          messages
                        </span>
                        <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700">
                          message_template_status_update
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Regras Oficiais de Conversa da Meta */}
                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-blue-950">
                      Regras Oficiais de Conversa da Meta (Cloud API)
                    </h3>
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-blue-700 ring-1 ring-blue-200">
                      Janela CSW: 24h
                    </span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-1 gap-3 text-xs text-blue-900 md:grid-cols-3">
                    <div className="rounded-xl bg-white/80 p-3 ring-1 ring-blue-100">
                      <div className="font-bold">1. Início Ativo & Reabertura</div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                        Novas conversas iniciadas pela empresa ou após expirar 24h só permitem envio de{" "}
                        <strong>Template APPROVED</strong>.
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3 ring-1 ring-blue-100">
                      <div className="font-bold">2. Janela de 24h (Inbound)</div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                        Quando o cliente envia ou responde uma mensagem, a janela de <strong>24 horas</strong> abre automaticamente para texto livre.
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3 ring-1 ring-blue-100">
                      <div className="font-bold">3. Qualidade & Opt-Out</div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                        Contatos que enviarem <code className="rounded bg-slate-100 px-1">SAIR</code> ou{" "}
                        <code className="rounded bg-slate-100 px-1">STOP</code> são bloqueados automaticamente para preservar o Quality Rating.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Templates da Meta */}
                {canViewTemplates && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Modelos de mensagem ({metaTemplates.length})</h3>
                        <p className="text-xs text-slate-500">
                          Os modelos são importados diretamente da sua conta oficial e só aparecem com a conexão ativa.
                        </p>
                      </div>
                      {canSyncTemplates && (
                        <button
                          type="button"
                          onClick={handleSyncMetaTemplates}
                          disabled={syncingMeta || metaChannel.status !== "connected"}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                          title={metaChannel.status !== "connected" ? "Conecte a conta oficial para importar os modelos." : undefined}
                        >
                          <RefreshCw className={cn("h-3.5 w-3.5", syncingMeta && "animate-spin")} />
                          {syncingMeta ? "Importando..." : "Importar da conta oficial"}
                        </button>
                      )}
                    </div>

                    {metaChannel.status !== "connected" ? (
                      <p className="py-6 text-center text-xs text-slate-400">
                        Conecte a conta oficial para importar seus modelos de mensagem.
                      </p>
                    ) : metaTemplates.length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-400">
                        Nenhum modelo importado ainda. Use “Importar da conta oficial”.
                      </p>
                    ) : (
                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                        {metaTemplates.map((tpl) => (
                          <div key={tpl.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <code className="text-xs font-bold text-slate-900">{tpl.name}</code>
                                <div className="flex items-center gap-1.5">
                                  {canEditTemplate ? (
                                    <select
                                      aria-label={`Status do template ${tpl.name}`}
                                      value={tpl.status}
                                      onChange={async (e) => {
                                        await apiClient.updateMetaTemplate(tpl.id, {
                                          status: e.target.value as TemplateStatus,
                                        });
                                        await onRefreshState();
                                        onNotify(`Status de ${tpl.name} atualizado para ${e.target.value}.`);
                                      }}
                                      className={cn(
                                        "rounded-full px-2 py-0.5 text-[10px] font-bold focus:outline-none",
                                        tpl.status === "APPROVED"
                                          ? "bg-emerald-100 text-emerald-800"
                                          : tpl.status === "PENDING"
                                            ? "bg-amber-100 text-amber-800"
                                            : "bg-red-100 text-red-700",
                                      )}
                                    >
                                      <option value="APPROVED">APPROVED</option>
                                      <option value="PENDING">PENDING</option>
                                      <option value="REJECTED">REJECTED</option>
                                    </select>
                                  ) : (
                                    <span
                                      className={cn(
                                        "rounded-full px-2 py-0.5 text-[10px] font-bold",
                                        tpl.status === "APPROVED"
                                          ? "bg-emerald-100 text-emerald-800"
                                          : tpl.status === "PENDING"
                                            ? "bg-amber-100 text-amber-800"
                                            : "bg-red-100 text-red-700",
                                      )}
                                    >
                                      {tpl.status}
                                    </span>
                                  )}
                                  {canDeleteTemplate && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await apiClient.deleteMetaTemplate(tpl.id);
                                        await onRefreshState();
                                      }}
                                      className="text-slate-300 hover:text-red-600"
                                      title="Excluir template"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="mt-1 text-[10px] font-semibold text-slate-400">
                                {tpl.category} · {tpl.language} · {tpl.variablesCount} var(s)
                              </div>
                              {tpl.headerText && (
                                <div className="mt-2 text-xs font-bold text-slate-900">{tpl.headerText}</div>
                              )}
                              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{tpl.bodyText}</p>
                              {tpl.footerText && (
                                <div className="mt-1.5 text-[11px] text-slate-400">{tpl.footerText}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {canCreateTemplate && (
                      <form onSubmit={handleCreateTemplate} className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 lg:grid-cols-3">
                        <div className="space-y-3 lg:col-span-2">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <input
                              type="text"
                              required
                              value={tplName}
                              onChange={(e) => setTplName(e.target.value)}
                              placeholder="nome_do_template"
                              className="rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs"
                            />
                            <select
                              value={tplCategory}
                              onChange={(e) => setTplCategory(e.target.value as TemplateCategory)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
                            >
                              <option value="UTILITY">UTILITY</option>
                              <option value="MARKETING">MARKETING</option>
                              <option value="AUTHENTICATION">AUTHENTICATION</option>
                            </select>
                            <select
                              value={tplLanguage}
                              onChange={(e) => setTplLanguage(e.target.value)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
                            >
                              <option value="pt_BR">pt_BR</option>
                              <option value="en_US">en_US</option>
                              <option value="es">es</option>
                            </select>
                          </div>

                          <input
                            type="text"
                            value={tplHeader}
                            onChange={(e) => setTplHeader(e.target.value)}
                            placeholder="Header opcional (ex.: CRM Orbit · Atualização)"
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                          />

                          <textarea
                            rows={3}
                            required
                            value={tplBody}
                            onChange={(e) => setTplBody(e.target.value)}
                            placeholder="Corpo do template com variáveis {{1}}, {{2}}..."
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                          />

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <input
                              type="text"
                              value={tplFooter}
                              onChange={(e) => setTplFooter(e.target.value)}
                              placeholder="Footer opcional (ex.: Digite SAIR para cancelar)"
                              className="min-w-[220px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs"
                            />
                            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
                              <input
                                type="checkbox"
                                checked={tplSubmitToMeta}
                                onChange={(e) => setTplSubmitToMeta(e.target.checked)}
                                className="accent-blue-600"
                              />
                              Submeter na Graph API (se conectada)
                            </label>
                            <button
                              type="submit"
                              disabled={tplCreating}
                              className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              {tplCreating ? "Criando..." : "Criar Template Meta"}
                            </button>
                          </div>
                        </div>

                        {/* Preview estilo WhatsApp */}
                        <div className="rounded-xl border border-slate-200 bg-[#EFEAE2] p-3">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Preview do Template
                          </div>
                          <div className="mt-2 rounded-xl rounded-tl-sm bg-white p-3 text-xs shadow-sm">
                            {tplHeader && <div className="font-bold text-slate-900">{tplHeader}</div>}
                            <p className="mt-1 whitespace-pre-wrap text-slate-800">
                              {tplBody || "O texto do seu template com {{1}} aparecerá aqui..."}
                            </p>
                            {tplFooter && <div className="mt-1.5 text-[10px] text-slate-400">{tplFooter}</div>}
                            <div className="mt-1 text-right text-[9px] text-slate-400">Agora</div>
                          </div>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
