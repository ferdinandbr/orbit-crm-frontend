"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  Building2,
  Kanban,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { LoginView } from "@/components/LoginView";
import {
  apiClient,
  getStoredToken,
  UnauthorizedError,
  type AuthSession,
} from "@/lib/api-client";
import type { PresenceStatus, TenantStateResponse } from "@/lib/types";
import { NAV_ITEMS, navForPath, navPath, type NavKey } from "@/lib/nav";
import { cn, getInitials } from "@/lib/utils";
import { WorkspaceContext, type WorkspaceContextValue } from "./WorkspaceContext";
import { skeletonVariantForPath, WorkspaceSkeleton } from "./WorkspaceSkeleton";
import { TopNavbar } from "./TopNavbar";

const NAV_ICONS: Record<NavKey, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  inbox: MessageSquare,
  kanban: Kanban,
  broadcast: Megaphone,
  ai: Bot,
  team: Users,
  roles: Shield,
  settings: Settings,
};

// Estilo da aba ativa por item (settings = escuro, ai = violeta, demais = verde).
const ACTIVE_CLASS: Partial<Record<NavKey, string>> = {
  settings: "bg-slate-900 text-white shadow-sm",
  ai: "bg-violet-100 text-violet-800 shadow-sm",
};
const DEFAULT_ACTIVE = "bg-[#DCFCE7] text-[#15803D] shadow-sm";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [authenticated, setAuthenticated] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [state, setState] = useState<TenantStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const notify = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((curr) => (curr === msg ? null : curr)), 3500);
  }, []);

  const loadState = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setAuthenticated(false);
      setState(null);
      setLoading(false);
      return;
    }
    try {
      setErrorMsg(null);
      const [me, data] = await Promise.all([apiClient.getMe(), apiClient.getState()]);
      // Se o usuário deslogou enquanto a requisição estava em voo, descarta o
      // resultado para não re-autenticar por cima do logout (corrida do polling).
      if (!getStoredToken()) return;
      setAuthUserId(me.user.id);
      setState(data);
      setAuthenticated(true);
      setSelectedConversationId((prev) => {
        if (prev && data.conversations.some((c) => c.id === prev)) return prev;
        return data.conversations[0]?.id ?? null;
      });
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        setAuthenticated(false);
        setState(null);
      } else {
        setErrorMsg(
          err instanceof Error
            ? `Não foi possível conectar ao servidor (${err.message}).`
            : "Erro de conexão com o servidor.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const handleAuthenticated = async (session: AuthSession) => {
    setAuthUserId(session.user.id);
    setAuthenticated(true);
    setLoading(true);
    await loadState();
    notify(`Bem-vindo(a), ${session.user.name}!`);
  };

  const handleLogout = () => {
    apiClient.logout();
    setAuthenticated(false);
    setState(null);
    setAuthUserId(null);
    setSelectedConversationId(null);
  };

  const currentUser = useMemo(() => {
    if (!state) return null;
    return state.currentUser ?? state.members.find((m) => m.id === authUserId) ?? state.members[0] ?? null;
  }, [state, authUserId]);

  const unreadTotal = useMemo(
    () => state?.conversations.reduce((acc, c) => acc + c.unreadCount, 0) ?? 0,
    [state],
  );

  const can = useCallback(
    (perm: string) => state?.currentUserPermissions.includes(perm) ?? false,
    [state],
  );

  const isDeveloper = useMemo(() => {
    if (!state || !currentUser) return false;
    const slug = state.roles.find((r) => r.id === currentUser.roleId)?.slug ?? currentUser.role;
    return slug === "developer";
  }, [state, currentUser]);

  const navigateTo = useCallback((nav: NavKey) => router.push(navPath(nav)), [router]);
  const openConversation = useCallback(
    (convId: string) => {
      setSelectedConversationId(convId);
      router.push(navPath("inbox"));
    },
    [router],
  );

  // Guard: se a rota atual não é permitida (ou é desconhecida), cai na primeira permitida.
  // /perfil é acessível a qualquer usuário autenticado.
  const routeItem = navForPath(pathname);
  const isProfileRoute = pathname === "/perfil" || pathname.startsWith("/perfil/");
  const routeAllowed = isProfileRoute || (routeItem ? can(routeItem.perm) : false);
  useEffect(() => {
    if (!state) return;
    if (routeAllowed) return;
    const firstAllowed = NAV_ITEMS.find((i) => can(i.perm));
    if (firstAllowed && firstAllowed.path !== pathname) {
      router.replace(firstAllowed.path);
    }
  }, [state, pathname, routeAllowed, can, router]);

  // Auto-refresh: mantém os dados em dia sem recarregar a página (polling leve
  // + ao voltar o foco para a aba). Não dispara skeleton (o estado já existe).
  useEffect(() => {
    if (!authenticated || !state) return;
    const POLL_MS = 8000;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        loadState();
      }
    }, POLL_MS);
    const onFocus = () => loadState();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, state === null, loadState]);

  if (loading && !state) {
    return <WorkspaceSkeleton variant={skeletonVariantForPath(pathname)} />;
  }

  if (errorMsg && !state) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-base font-bold text-red-700">Erro de conexão</h1>
          <p className="mt-2 text-xs text-slate-600">{errorMsg}</p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={loadState}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Ir para Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!authenticated || !state || !currentUser) {
    return <LoginView onAuthenticated={handleAuthenticated} />;
  }

  const ctxValue: WorkspaceContextValue = {
    state,
    currentUser,
    can,
    isDeveloper,
    unreadTotal,
    loadState,
    notify,
    selectedConversationId,
    setSelectedConversationId,
    openConversation,
    navigateTo,
    logout: handleLogout,
  };

  const visibleItems = NAV_ITEMS.filter((i) => can(i.perm));
  const opItems = visibleItems.filter((i) => i.section === "operacao");
  const adminItems = visibleItems.filter((i) => i.section === "administracao");

  const renderNavLink = (item: (typeof NAV_ITEMS)[number]) => {
    const Icon = NAV_ICONS[item.key];
    const active = routeItem?.key === item.key;
    return (
      <Link
        key={item.key}
        href={item.path}
        title={item.label}
        className={cn(
          "flex w-full items-center justify-between rounded-xl px-3 py-2.5 transition",
          active
            ? ACTIVE_CLASS[item.key] ?? DEFAULT_ACTIVE
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          sidebarCollapsed && "justify-center px-0",
        )}
      >
        <span className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 shrink-0" />
          {!sidebarCollapsed &&
            (item.key === "settings" ? (
              <span className="text-left leading-tight">
                <span className="block">{item.label}</span>
                <span
                  className={cn(
                    "block text-[10px] font-normal",
                    active ? "text-slate-300" : "text-slate-400",
                  )}
                >
                  Conexões WhatsApp
                </span>
              </span>
            ) : (
              <span>{item.label}</span>
            ))}
        </span>
        {!sidebarCollapsed && item.key === "inbox" && unreadTotal > 0 && (
          <span className="rounded-full bg-[#16A34A] px-2 py-0.5 text-[10px] font-bold text-white">
            {unreadTotal}
          </span>
        )}
      </Link>
    );
  };

  return (
    <WorkspaceContext.Provider value={ctxValue}>
      <div className="flex h-screen flex-row overflow-hidden bg-slate-50">
        <aside
          className={cn(
            "z-20 flex shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-200",
            sidebarCollapsed ? "w-[72px]" : "w-64",
          )}
        >
          <div
            className={cn(
              "border-b border-slate-100",
              sidebarCollapsed
                ? "flex flex-col items-center gap-2 px-2 py-3"
                : "flex items-center justify-between px-3.5 py-3.5",
            )}
          >
            <div className={cn("flex items-center gap-2.5 overflow-hidden", sidebarCollapsed && "justify-center")}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#16A34A] text-white shadow-sm">
                <MessageSquare className="h-5 w-5" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-sm font-extrabold tracking-tight text-slate-900">CRM Orbit</div>
                  <div className="truncate text-[10px] font-semibold text-emerald-700">Atendimento & Vendas</div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              title={sidebarCollapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
              className={cn(
                "rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700",
                sidebarCollapsed && "flex h-8 w-full items-center justify-center",
              )}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>

          {!sidebarCollapsed && (
            <div className="border-b border-slate-100 p-3">
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span className="truncate text-xs font-bold text-slate-900">{state.activeOrganization.name}</span>
              </div>
            </div>
          )}

          <nav className="thin-scrollbar flex-1 space-y-1 overflow-y-auto p-3 text-xs font-semibold">
            {!sidebarCollapsed && opItems.length > 0 && (
              <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Operação
              </div>
            )}
            {opItems.map(renderNavLink)}

            {adminItems.length > 0 && (
              <div className="my-2 border-t border-slate-100 pt-2">
                {!sidebarCollapsed && (
                  <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Administração
                  </div>
                )}
                {adminItems.map(renderNavLink)}
              </div>
            )}
          </nav>

          <div className="space-y-2.5 border-t border-slate-100 p-3">
            {sidebarCollapsed ? (
              <button
                type="button"
                onClick={handleLogout}
                title={`Sair (${currentUser.name})`}
                className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
              </button>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                <div className="flex items-center gap-2">
                  <Link
                    href="/perfil"
                    title="Abrir meu perfil"
                    className="shrink-0 transition hover:opacity-85"
                  >
                    {currentUser.avatarUrl ? (
                      <img
                        src={currentUser.avatarUrl}
                        alt={currentUser.name}
                        className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ backgroundColor: currentUser.avatarBg }}
                      >
                        {getInitials(currentUser.name)}
                      </div>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href="/perfil"
                      title="Abrir meu perfil"
                      className="block truncate text-xs font-bold text-slate-900 hover:text-emerald-700"
                    >
                      {currentUser.name}
                    </Link>
                    <div className="mt-0.5 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            currentUser.presence === "online"
                              ? "bg-emerald-500"
                              : currentUser.presence === "busy"
                                ? "bg-amber-500"
                                : "bg-slate-400",
                          )}
                        />
                        <select
                          aria-label="Status de presença"
                          value={currentUser.presence}
                          disabled={!currentUser.isActive}
                          onChange={async (e) => {
                            try {
                              await apiClient.updateTeamMember(currentUser.id, {
                                presence: e.target.value as PresenceStatus,
                              });
                              await loadState();
                            } catch (err) {
                              if (err instanceof UnauthorizedError) {
                                handleLogout();
                              } else {
                                notify(err instanceof Error ? err.message : "Erro ao atualizar status.");
                              }
                            }
                          }}
                          className="bg-transparent text-[11px] font-medium text-slate-600 focus:outline-none"
                        >
                          <option value="online">Online</option>
                          <option value="busy">Ausente</option>
                          <option value="offline">Offline</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleLogout}
                        title="Sair da conta"
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="h-3 w-3" /> Sair
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <TopNavbar />
          <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
            {routeAllowed ? children : null}
          </main>
        </div>

        {toastMsg && (
          <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xl">
            {toastMsg}
          </div>
        )}
      </div>
    </WorkspaceContext.Provider>
  );
}
