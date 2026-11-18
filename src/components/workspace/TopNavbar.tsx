"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  Kanban,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Search,
  UserCircle2,
} from "lucide-react";
import { NAV_ITEMS, type NavKey } from "@/lib/nav";
import { cn, getInitials } from "@/lib/utils";
import { useWorkspace } from "./WorkspaceContext";

interface Result {
  key: string;
  kind: "page" | "conv" | "lead";
  label: string;
  sublabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
}

export function TopNavbar() {
  const router = useRouter();
  const {
    state,
    currentUser,
    can,
    unreadTotal,
    navigateTo,
    openConversation,
    logout,
  } = useWorkspace();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Atalho global Ctrl/Cmd + K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (paletteOpen) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [paletteOpen]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const out: Result[] = [];

    const pages = NAV_ITEMS.filter((i) => can(i.perm));
    const pageIcon: Partial<Record<NavKey, React.ComponentType<{ className?: string }>>> = {
      dashboard: LayoutDashboard,
      inbox: MessageSquare,
      kanban: Kanban,
    };
    for (const p of pages) {
      if (q && !p.label.toLowerCase().includes(q)) continue;
      out.push({
        key: `page-${p.key}`,
        kind: "page",
        label: p.label,
        sublabel: "Ir para a página",
        icon: pageIcon[p.key] ?? LayoutDashboard,
        onSelect: () => {
          navigateTo(p.key);
          setPaletteOpen(false);
        },
      });
    }
    if (!q || "meu perfil".includes(q) || "minha conta".includes(q) || "senha".includes(q)) {
      out.push({
        key: "page-perfil",
        kind: "page",
        label: "Meu perfil",
        sublabel: "Foto, conta e senha",
        icon: UserCircle2,
        onSelect: () => {
          router.push("/perfil");
          setPaletteOpen(false);
        },
      });
    }

    if (q && can("inbox:view")) {
      for (const c of state.conversations) {
        if (
          c.contactName.toLowerCase().includes(q) ||
          c.contactCompany.toLowerCase().includes(q) ||
          c.lastMessagePreview.toLowerCase().includes(q)
        ) {
          out.push({
            key: `conv-${c.id}`,
            kind: "conv",
            label: c.contactName,
            sublabel: c.lastMessagePreview || c.contactPhone,
            icon: MessageSquare,
            onSelect: () => {
              openConversation(c.id);
              setPaletteOpen(false);
            },
          });
        }
        if (out.filter((r) => r.kind === "conv").length >= 6) break;
      }
    }

    if (q && can("leads:view")) {
      for (const l of state.leads) {
        if (
          l.contactName.toLowerCase().includes(q) ||
          l.company.toLowerCase().includes(q) ||
          l.title.toLowerCase().includes(q)
        ) {
          out.push({
            key: `lead-${l.id}`,
            kind: "lead",
            label: l.title || l.contactName,
            sublabel: l.company || l.contactName,
            icon: Kanban,
            onSelect: () => {
              navigateTo("kanban");
              setPaletteOpen(false);
            },
          });
        }
        if (out.filter((r) => r.kind === "lead").length >= 6) break;
      }
    }

    return out;
  }, [query, state, can, navigateTo, openConversation, router]);

  useEffect(() => setActiveIdx(0), [query]);

  const onPaletteKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[activeIdx]?.onSelect();
    }
  };

  const unreadConvs = useMemo(
    () => state.conversations.filter((c) => c.unreadCount > 0).slice(0, 8),
    [state.conversations],
  );

  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
      {/* Busca (abre o command palette) */}
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="flex h-9 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400 hover:bg-slate-100 sm:max-w-md"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Pesquisar conversas, negócios, páginas…</span>
        <kbd className="hidden items-center gap-0.5 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 sm:inline-flex">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Notificações */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotifOpen((v) => !v);
              setUserOpen(false);
            }}
            className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            title="Notificações"
          >
            <Bell className="h-5 w-5" />
            {unreadTotal > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#16A34A] px-1 text-[10px] font-bold text-white">
                {unreadTotal > 99 ? "99+" : unreadTotal}
              </span>
            )}
          </button>
          {notifOpen && (
            <>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setNotifOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700">
                  Notificações {unreadTotal > 0 && `(${unreadTotal} não lidas)`}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {unreadConvs.length === 0 && (
                    <p className="px-4 py-6 text-center text-xs text-slate-400">Tudo em dia por aqui 🎉</p>
                  )}
                  {unreadConvs.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        openConversation(c.id);
                        setNotifOpen(false);
                      }}
                      className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50"
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ backgroundColor: c.avatarBg }}
                      >
                        {getInitials(c.contactName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-bold text-slate-900">{c.contactName}</span>
                          <span className="shrink-0 rounded-full bg-[#16A34A] px-1.5 text-[10px] font-bold text-white">
                            {c.unreadCount}
                          </span>
                        </div>
                        <p className="truncate text-[11px] text-slate-500">{c.lastMessagePreview}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Usuário logado */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setUserOpen((v) => !v);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 hover:bg-slate-100"
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
            <div className="hidden text-left leading-tight sm:block">
              <div className="text-xs font-bold text-slate-900">{currentUser.name}</div>
              <div className="text-[10px] font-medium capitalize text-slate-400">{currentUser.roleName}</div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
          {userOpen && (
            <>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setUserOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.name}
                      className="h-7 w-7 shrink-0 rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <UserCircle2 className="h-5 w-5 shrink-0 text-slate-400" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-slate-900">{currentUser.name}</div>
                    <div className="truncate text-[11px] text-slate-500">{currentUser.email}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    router.push("/perfil");
                    setUserOpen(false);
                  }}
                  className="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <UserCircle2 className="h-4 w-4 text-emerald-600" /> Meu perfil
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" /> Sair da conta
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Command palette */}
      {paletteOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/40 px-4 pt-24">
          <button
            type="button"
            aria-label="Fechar busca"
            onClick={() => setPaletteOpen(false)}
            className="absolute inset-0 cursor-default"
          />
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onPaletteKey}
                placeholder="Buscar conversas, negócios, páginas…"
                className="w-full bg-transparent py-3.5 text-sm outline-none"
              />
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                Esc
              </kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {results.length === 0 && (
                <p className="px-3 py-6 text-center text-xs text-slate-400">
                  {query ? "Nada encontrado." : "Digite para buscar."}
                </p>
              )}
              {results.map((r, idx) => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={r.onSelect}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left",
                      idx === activeIdx ? "bg-slate-100" : "hover:bg-slate-50",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-800">{r.label}</div>
                      {r.sublabel && <div className="truncate text-[11px] text-slate-400">{r.sublabel}</div>}
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-500">
                      {r.kind === "page" ? "página" : r.kind === "conv" ? "conversa" : "negócio"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
