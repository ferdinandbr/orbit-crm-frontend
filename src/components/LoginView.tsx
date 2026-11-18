"use client";

import React, { useEffect, useState } from "react";
import { Eye, EyeOff, MessageSquare, TrendingUp } from "lucide-react";
import { apiClient, type AuthSession } from "@/lib/api-client";

interface LoginViewProps {
  onAuthenticated: (session: AuthSession) => void;
}

const REMEMBER_EMAIL_KEY = "crm_orbit_remembered_email";

export function LoginView({ onAuthenticated }: LoginViewProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (saved) setEmail(saved);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (typeof window !== "undefined") {
        if (rememberMe) {
          window.localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
        } else {
          window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
      }
      const session = await apiClient.login(email, password);
      onAuthenticated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao autenticar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen w-full grid-cols-1 bg-white lg:grid-cols-2">
      {/* Lado Esquerdo — Formulário de Acesso Full Screen */}
      <div className="flex min-h-screen flex-col justify-between px-6 py-8 sm:px-12 lg:px-16">
        {/* Topo: Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#16A34A] text-white shadow-sm">
            <MessageSquare className="h-5 w-5" />
          </div>
          <span className="text-base font-extrabold tracking-tight text-slate-900">CRM Orbit</span>
        </div>

        {/* Centro: Formulário */}
        <div className="mx-auto w-full max-w-[390px] py-10">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Bem-vindo de volta
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Digite seu e-mail e senha para acessar sua conta.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">E-mail</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@empresa.com"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#16A34A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/15"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Senha</label>
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={4}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-3.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#16A34A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5 text-xs">
              <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 accent-[#16A34A]"
                />
                Lembrar de mim
              </label>
              <span className="font-medium text-slate-400">Acesso corporativo</span>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-[#16A34A] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#15803D] disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Copyright © 2026 CRM Orbit.</span>
          <span>Acesso restrito a equipes autorizadas</span>
        </div>
      </div>

      {/* Lado Direito — Painel Visual Verde do Sistema (Estilo Dashboard Showcase) */}
      <div className="hidden p-4 lg:flex">
        <div className="relative flex w-full flex-col justify-between overflow-hidden rounded-[28px] bg-gradient-to-br from-[#16A34A] via-[#15803D] to-[#14532D] p-10 text-white shadow-2xl">
          {/* Grid geométrico sutil no fundo */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-15"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.22) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />

          <div className="relative z-10 max-w-md pt-4">
            <h2 className="text-[32px] font-bold leading-[1.18] tracking-tight">
              Gerencie sua equipe e operação comercial sem esforço.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-emerald-50/90">
              Entre para acessar sua central WhatsApp multi-atendente, funil Kanban e disparos em massa.
            </p>
          </div>

          {/* Composição de Cards do Dashboard */}
          <div className="relative z-10 mt-8 pb-2">
            <div className="mr-10 rounded-2xl bg-white p-4 text-slate-900 shadow-2xl">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-[#16A34A] p-3 text-white">
                  <div className="text-[10px] font-medium text-emerald-100">Negócios no Funil</div>
                  <div className="mt-1.5 text-lg font-extrabold">R$ 189.374</div>
                  <span className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-semibold">
                    <TrendingUp className="h-2.5 w-2.5" /> +12% este mês
                  </span>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <div className="text-[10px] font-semibold text-slate-500">Performance de Chat</div>
                  <div className="mt-1.5 text-lg font-extrabold text-slate-900">00:01:30</div>
                  <svg viewBox="0 0 100 24" className="mt-1 h-5 w-full">
                    <path
                      d="M0 18 Q 20 8, 40 15 T 75 9 T 100 6"
                      fill="none"
                      stroke="#16A34A"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <div className="text-[10px] font-semibold text-slate-500">Disparos Semanais</div>
                  <div className="mt-2 flex h-10 items-end gap-1.5">
                    <span className="w-2 rounded-t bg-emerald-200" style={{ height: "45%" }} />
                    <span className="w-2 rounded-t bg-emerald-300" style={{ height: "65%" }} />
                    <span className="w-2 rounded-t bg-[#16A34A]" style={{ height: "95%" }} />
                    <span className="w-2 rounded-t bg-emerald-300" style={{ height: "58%" }} />
                    <span className="w-2 rounded-t bg-emerald-200" style={{ height: "72%" }} />
                    <span className="w-2 rounded-t bg-[#16A34A]" style={{ height: "84%" }} />
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                  <span>Atendimentos & Oportunidades Recentes</span>
                  <span className="text-[10px] font-semibold text-slate-400">Tempo real</span>
                </div>
                <div className="mt-2 space-y-1.5 text-[10px]">
                  <div className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 shadow-sm">
                    <span className="font-semibold text-slate-800">Clínica Horizonte · WhatsApp Oficial</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">
                      Ganho
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 shadow-sm">
                    <span className="font-semibold text-slate-800">Grupo Vanguarda · Evolution Anti-Ban</span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-700">
                      Proposta
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 shadow-sm">
                    <span className="font-semibold text-slate-800">Studio Apex · Handoff IA</span>
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 font-bold text-sky-700">
                      Em Negociação
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card Flutuante Lateral (Semi-Gauge estilo Imagem 1) */}
            <div className="absolute -right-2 top-16 w-48 rounded-2xl border border-slate-100 bg-white p-3.5 text-slate-900 shadow-2xl">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-700">
                <span>Canais Ativos</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">Mensal</span>
              </div>
              <div className="mt-2 flex flex-col items-center">
                <svg viewBox="0 0 120 68" className="h-20 w-full">
                  <path
                    d="M 12 60 A 48 48 0 0 1 108 60"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 12 60 A 48 48 0 0 1 92 22"
                    fill="none"
                    stroke="#0EA5E9"
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 12 60 A 48 48 0 0 1 56 12"
                    fill="none"
                    stroke="#16A34A"
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="-mt-7 text-center">
                  <div className="text-[9px] text-slate-400">Mensagens</div>
                  <div className="text-sm font-extrabold text-slate-900">6.248</div>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-[10px] text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#16A34A]" /> Evolution
                  </span>
                  <span className="font-bold text-slate-800">3.920</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#0EA5E9]" /> Meta Cloud
                  </span>
                  <span className="font-bold text-slate-800">2.328</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
