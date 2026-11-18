"use client";

import { createContext, useContext } from "react";
import type { TeamMember, TenantStateResponse } from "@/lib/types";
import type { NavKey } from "@/lib/nav";

export interface WorkspaceContextValue {
  state: TenantStateResponse;
  currentUser: TeamMember;
  can: (perm: string) => boolean;
  isDeveloper: boolean;
  unreadTotal: number;
  loadState: () => Promise<void>;
  notify: (msg: string) => void;
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;
  /** Define a conversa e navega para o Inbox. */
  openConversation: (convId: string) => void;
  /** Navega para uma rota do app pela chave de nav. */
  navigateTo: (nav: NavKey) => void;
  /** Encerra a sessão. */
  logout: () => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace() precisa ser usado dentro de <WorkspaceShell>.");
  }
  return ctx;
}
