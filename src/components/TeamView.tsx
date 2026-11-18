"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MessageSquare,
  MoreVertical,
  Pencil,
  Save,
  Search,
  Shield,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from "lucide-react";
import { optimizeAvatarImage } from "@/components/ProfileView";
import { apiClient } from "@/lib/api-client";
import type { Organization, PresenceStatus, RoleDef, RoutingMode, TeamMember } from "@/lib/types";
import { cn, getInitials } from "@/lib/utils";

interface TeamViewProps {
  organization: Organization;
  currentUser: TeamMember;
  members: TeamMember[];
  roles: RoleDef[];
  canManage: boolean;
  canInvite?: boolean;
  canEdit?: boolean;
  canUpdateUser?: boolean;
  canRemove?: boolean;
  canConfigureRouting?: boolean;
  onRefreshState: () => Promise<void>;
  onNotify: (msg: string) => void;
}

interface ActionMenuState {
  member: TeamMember;
  top?: number;
  bottom?: number;
  right: number;
}

const DEVELOPER_SLUG = "developer";
const PAGE_SIZE = 8;
const MAX_RAW_AVATAR_BYTES = 15 * 1024 * 1024;

export function TeamView({
  organization,
  currentUser,
  members,
  roles,
  canManage,
  canInvite,
  canEdit,
  canUpdateUser,
  canRemove,
  canConfigureRouting,
  onRefreshState,
  onNotify,
}: TeamViewProps) {
  const allowInvite = canInvite ?? canManage;
  const allowEdit = canEdit ?? canManage;
  const allowUpdateUser = canUpdateUser ?? canManage;
  const allowRemove = canRemove ?? canManage;
  const allowRouting = canConfigureRouting ?? canManage;
  const allowActions = allowUpdateUser || allowEdit || allowRemove;

  // O perfil Desenvolvedor nunca aparece nos selects nem na listagem da equipe.
  const selectableRoles = useMemo(
    () => roles.filter((r) => r.slug !== DEVELOPER_SLUG),
    [roles],
  );
  const defaultRoleId =
    selectableRoles.find((r) => r.slug === "agent")?.id ?? selectableRoles[0]?.id ?? "";

  const roleSlugById = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of roles) map.set(r.id, r.slug);
    return (id: string | null): string | undefined => (id ? map.get(id) : undefined);
  }, [roles]);

  // Garante no frontend também que nenhum usuário Desenvolvedor seja exibido na lista.
  const visibleMembers = useMemo(
    () =>
      members.filter(
        (m) => m.role !== DEVELOPER_SLUG && roleSlugById(m.roleId) !== DEVELOPER_SLUG,
      ),
    [members, roleSlugById],
  );

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState<string>(defaultRoleId);
  const [submitting, setSubmitting] = useState(false);

  const [actionMenu, setActionMenu] = useState<ActionMenuState | null>(null);

  const [editTarget, setEditTarget] = useState<TeamMember | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editShowPassword, setEditShowPassword] = useState(false);
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [editPhotoSizeKb, setEditPhotoSizeKb] = useState<number | null>(null);
  const [optimizingEditPhoto, setOptimizingEditPhoto] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const [toggleTarget, setToggleTarget] = useState<TeamMember | null>(null);
  const [toggling, setToggling] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visibleMembers;
    return visibleMembers.filter((m) => m.name.toLowerCase().includes(q));
  }, [visibleMembers, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageMembers = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [query]);

  useEffect(() => {
    if (!actionMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActionMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actionMenu]);

  const activeMembers = useMemo(() => visibleMembers.filter((m) => m.isActive), [visibleMembers]);
  const avgSla = activeMembers.length
    ? Math.round(activeMembers.reduce((acc, m) => acc + m.avgResponseMinutes, 0) / activeMembers.length)
    : 0;
  const onlineCount = activeMembers.filter((m) => m.presence === "online").length;

  const openActionDropdown = (member: TeamMember, buttonEl: HTMLButtonElement) => {
    if (actionMenu?.member.id === member.id) {
      setActionMenu(null);
      return;
    }
    const rect = buttonEl.getBoundingClientRect();
    const openUpward = window.innerHeight - rect.bottom < 165;
    setActionMenu({
      member,
      right: Math.max(12, window.innerWidth - rect.right),
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  };

  const openEditModal = (member: TeamMember) => {
    setActionMenu(null);
    setEditTarget(member);
    setEditName(member.name);
    setEditEmail(member.email);
    setEditPassword("");
    setEditShowPassword(false);
    setEditAvatarUrl(member.avatarUrl ?? null);
    setEditPhotoSizeKb(null);
  };

  const handleEditFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
      onNotify("Formato não suportado. Envie PNG, JPEG ou WebP.");
      return;
    }
    if (file.size > MAX_RAW_AVATAR_BYTES) {
      onNotify("A imagem excede o limite de 15 MB.");
      return;
    }

    setOptimizingEditPhoto(true);
    try {
      const { dataUrl, sizeKb } = await optimizeAvatarImage(file);
      setEditAvatarUrl(dataUrl);
      setEditPhotoSizeKb(sizeKb);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Erro ao processar a foto.");
    } finally {
      setOptimizingEditPhoto(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    if (editName.trim().length < 2) {
      onNotify("Informe um nome com pelo menos 2 caracteres.");
      return;
    }
    if (!editEmail.trim()) {
      onNotify("Informe um e-mail válido.");
      return;
    }
    if (editPassword.length > 0 && editPassword.length < 6) {
      onNotify("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    const patch: Parameters<typeof apiClient.updateTeamMember>[1] = {};
    if (editName.trim() !== editTarget.name) patch.name = editName.trim();
    if (editEmail.trim().toLowerCase() !== editTarget.email.toLowerCase()) {
      patch.email = editEmail.trim();
    }
    if (editPassword.length >= 6) patch.password = editPassword;
    if ((editAvatarUrl ?? null) !== (editTarget.avatarUrl ?? null)) {
      patch.avatarUrl = editAvatarUrl;
    }

    if (Object.keys(patch).length === 0) {
      setEditTarget(null);
      return;
    }

    setSavingEdit(true);
    try {
      await apiClient.updateTeamMember(editTarget.id, patch);
      setEditTarget(null);
      await onRefreshState();
      onNotify("Dados do usuário atualizados.");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Erro ao atualizar usuário.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim() || invitePassword.length < 6) return;
    setSubmitting(true);
    try {
      await apiClient.addTeamMember({
        name: inviteName,
        email: inviteEmail,
        password: invitePassword,
        roleId: (inviteRoleId || defaultRoleId) || undefined,
      });
      setInviteName("");
      setInviteEmail("");
      setInvitePassword("");
      setInviteOpen(false);
      await onRefreshState();
      onNotify("Atendente adicionado ao tenant.");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Erro ao adicionar atendente.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmToggleActive = async () => {
    if (!toggleTarget) return;
    const nextActive = !toggleTarget.isActive;
    setToggling(true);
    try {
      await apiClient.updateTeamMember(toggleTarget.id, { isActive: nextActive });
      onNotify(
        nextActive
          ? `${toggleTarget.name} foi reativado(a).`
          : `${toggleTarget.name} foi desativado(a) e seus atendimentos foram redistribuídos.`,
      );
      setToggleTarget(null);
      await onRefreshState();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Erro ao atualizar status do usuário.");
    } finally {
      setToggling(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.deleteTeamMember(deleteTarget.id);
      onNotify(`${deleteTarget.name} excluído(a) e removido(a) da listagem.`);
      setDeleteTarget(null);
      await onRefreshState();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Erro ao excluir usuário.");
    } finally {
      setDeleting(false);
    }
  };

  const rangeStart = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(filtered.length, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 p-6">
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-5">
        {/* Cabeçalho */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Users className="h-5 w-5 text-emerald-600" /> Equipe ({organization.name})
            </h2>
            <p className="text-xs text-slate-500">
              Gerencie atendentes, status no sistema, status operacional e perfis de acesso.
            </p>
          </div>
          {allowInvite && (
            <button
              type="button"
              onClick={() => {
                setInviteRoleId((prev) => prev || defaultRoleId);
                setInviteOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#16A34A] px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <UserPlus className="h-4 w-4" /> Novo membro
            </button>
          )}
        </div>

        {/* KPIs & Roteamento */}
        <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Users className="h-4 w-4 text-emerald-600" /> Atendentes Online
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {onlineCount}{" "}
              <span className="text-sm font-normal text-slate-400">/ {activeMembers.length} ativos</span>
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Clock className="h-4 w-4 text-sky-600" /> SLA Médio da Equipe
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{avgSla} min</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <MessageSquare className="h-4 w-4 text-violet-600" /> Modo de Distribuição
            </div>
            <select
              aria-label="Modo de distribuição"
              value={organization.routingMode}
              disabled={!allowRouting}
              onChange={async (e) => {
                try {
                  await apiClient.updateOrganization(organization.id, {
                    routingMode: e.target.value as RoutingMode,
                  });
                  await onRefreshState();
                  onNotify("Regra de distribuição atualizada.");
                } catch (err) {
                  onNotify(err instanceof Error ? err.message : "Erro ao atualizar distribuição.");
                }
              }}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold text-slate-900 disabled:opacity-60"
            >
              <option value="round_robin">Distribuição automática</option>
              <option value="ai_first">Assistente primeiro</option>
              <option value="manual_queue">Fila manual</option>
            </select>
          </div>
        </div>

        {/* Tabela com Busca e Paginação (esticada até o fim da tela) */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-emerald-500 focus-within:bg-white sm:max-w-sm">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar membro pelo nome…"
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  title="Limpar busca"
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {filtered.length} {filtered.length === 1 ? "membro" : "membros"}
            </span>
          </div>

          <div className="thin-scrollbar min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Membro</th>
                  <th className="px-4 py-3">Perfil de acesso</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Status operacional</th>
                  <th className="px-4 py-3 text-right">Chats ativos</th>
                  <th className="px-4 py-3 text-right">SLA médio</th>
                  {allowActions && <th className="px-5 py-3 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {pageMembers.map((m) => {
                  const canChangePresence = m.isActive && (allowEdit || m.id === currentUser.id);
                  const operationalValue: PresenceStatus = m.isActive ? m.presence : "offline";
                  const hasRowActions =
                    allowUpdateUser || (m.id !== currentUser.id && (allowEdit || allowRemove));

                  return (
                    <tr
                      key={m.id}
                      className={cn(
                        "transition-colors hover:bg-slate-50/70",
                        !m.isActive && "bg-slate-50/40",
                      )}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {m.avatarUrl ? (
                            <img
                              src={m.avatarUrl}
                              alt={m.name}
                              className={cn(
                                "h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover",
                                !m.isActive && "opacity-50 grayscale",
                              )}
                            />
                          ) : (
                            <div
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                                !m.isActive && "opacity-50 grayscale",
                              )}
                              style={{ backgroundColor: m.avatarBg }}
                            >
                              {getInitials(m.name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "truncate text-sm font-bold",
                                  m.isActive ? "text-slate-900" : "text-slate-500",
                                )}
                              >
                                {m.name}
                              </span>
                              {m.id === currentUser.id && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                  Você
                                </span>
                              )}
                            </div>
                            <div className="truncate text-xs text-slate-500">{m.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1">
                          <Shield className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <select
                            aria-label={`Perfil de ${m.name}`}
                            value={m.roleId ?? ""}
                            disabled={!allowEdit || !m.isActive}
                            onChange={async (e) => {
                              try {
                                await apiClient.updateTeamMember(m.id, { roleId: e.target.value });
                                await onRefreshState();
                                onNotify(`Perfil de ${m.name} atualizado.`);
                              } catch (err) {
                                onNotify(err instanceof Error ? err.message : "Erro ao alterar o perfil.");
                              }
                            }}
                            className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            {m.roleId === null && <option value="">— sem perfil —</option>}
                            {selectableRoles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
                            m.isActive
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                              : "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              m.isActive ? "bg-emerald-500" : "bg-slate-400",
                            )}
                          />
                          {m.isActive ? "Ativo" : "Inativo"}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <select
                          aria-label={`Status operacional de ${m.name}`}
                          value={operationalValue}
                          disabled={!canChangePresence}
                          title={
                            !m.isActive
                              ? "Usuários inativos permanecem Offline e não podem ter o status operacional alterado."
                              : undefined
                          }
                          onChange={async (e) => {
                            try {
                              await apiClient.updateTeamMember(m.id, {
                                presence: e.target.value as PresenceStatus,
                              });
                              await onRefreshState();
                            } catch (err) {
                              onNotify(
                                err instanceof Error ? err.message : "Erro ao atualizar status operacional.",
                              );
                            }
                          }}
                          className={cn(
                            "rounded-lg border px-2.5 py-1 text-xs font-semibold focus:outline-none disabled:cursor-not-allowed disabled:opacity-70",
                            operationalValue === "online"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : operationalValue === "busy"
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : "border-slate-200 bg-slate-100 text-slate-600",
                          )}
                        >
                          <option value="online">Online</option>
                          <option value="busy">Ausente</option>
                          <option value="offline">Offline</option>
                        </select>
                      </td>

                      <td className="px-4 py-3.5 text-right font-semibold text-slate-700">
                        {m.activeChatsCount}
                      </td>

                      <td className="px-4 py-3.5 text-right font-semibold text-slate-700">
                        {m.avgResponseMinutes} min
                      </td>

                      {allowActions && (
                        <td className="px-5 py-3.5 text-right">
                          {hasRowActions ? (
                            <button
                              type="button"
                              aria-label={`Ações para ${m.name}`}
                              onClick={(e) => openActionDropdown(m, e.currentTarget)}
                              className={cn(
                                "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition",
                                actionMenu?.member.id === m.id
                                  ? "border-slate-300 bg-slate-100 text-slate-900"
                                  : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900",
                              )}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-300">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}

                {pageMembers.length === 0 && (
                  <tr>
                    <td
                      colSpan={allowActions ? 7 : 6}
                      className="px-5 py-12 text-center text-xs text-slate-400"
                    >
                      {query
                        ? `Nenhum membro encontrado para "${query}".`
                        : "Nenhum atendente cadastrado nesta organização ainda."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Rodapé de Paginação */}
          <div className="mt-auto flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
            <span className="text-xs text-slate-500">
              {filtered.length > 0 ? (
                <>
                  Mostrando <strong className="text-slate-700">{rangeStart}–{rangeEnd}</strong> de{" "}
                  <strong className="text-slate-700">{filtered.length}</strong>{" "}
                  {filtered.length === 1 ? "membro" : "membros"} · página {safePage + 1} de {totalPages}
                </>
              ) : (
                "0 membros · página 1 de 1"
              )}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0 || filtered.length === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1 || filtered.length === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Próxima <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dropdown flutuante de Ações (3 pontos) */}
      {actionMenu && (
        <>
          <button
            type="button"
            aria-label="Fechar menu de ações"
            onClick={() => setActionMenu(null)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            style={{
              position: "fixed",
              right: actionMenu.right,
              ...(actionMenu.top !== undefined ? { top: actionMenu.top } : {}),
              ...(actionMenu.bottom !== undefined ? { bottom: actionMenu.bottom } : {}),
            }}
            className="z-50 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl"
          >
            {allowUpdateUser && (
              <button
                type="button"
                onClick={() => openEditModal(actionMenu.member)}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5 text-slate-500" /> Editar
              </button>
            )}
            {allowEdit && actionMenu.member.id !== currentUser.id && (
              <button
                type="button"
                onClick={() => {
                  const target = actionMenu.member;
                  setActionMenu(null);
                  setToggleTarget(target);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-semibold hover:bg-slate-50",
                  actionMenu.member.isActive ? "text-amber-700" : "text-emerald-700",
                )}
              >
                {actionMenu.member.isActive ? (
                  <>
                    <UserX className="h-3.5 w-3.5" /> Inativar
                  </>
                ) : (
                  <>
                    <UserCheck className="h-3.5 w-3.5" /> Reativar
                  </>
                )}
              </button>
            )}
            {allowRemove && actionMenu.member.id !== currentUser.id && (
              <button
                type="button"
                onClick={() => {
                  const target = actionMenu.member;
                  setActionMenu(null);
                  setDeleteTarget(target);
                }}
                className="flex w-full items-center gap-2 border-t border-slate-100 px-3.5 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </button>
            )}
          </div>
        </>
      )}

      {/* Modal: Cadastrar Novo Membro */}
      {inviteOpen && allowInvite && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => !submitting && setInviteOpen(false)}
            className="absolute inset-0 cursor-default"
          />
          <form
            onSubmit={handleInvite}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <UserPlus className="h-4 w-4 text-emerald-600" /> Cadastrar Novo Atendente
              </div>
              <button
                type="button"
                onClick={() => !submitting && setInviteOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Nome completo *</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Ex.: Ana Paula"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">E-mail *</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="ana@empresa.com"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Senha inicial * (mín. 6)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  placeholder="••••••"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Perfil de acesso</label>
                <select
                  value={inviteRoleId || defaultRoleId}
                  onChange={(e) => setInviteRoleId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {selectableRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                disabled={submitting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <UserPlus className="h-3.5 w-3.5" /> {submitting ? "Salvando..." : "Adicionar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Editar Usuário (nome, e-mail, senha e foto) */}
      {editTarget && allowUpdateUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => !savingEdit && !optimizingEditPhoto && setEditTarget(null)}
            className="absolute inset-0 cursor-default"
          />
          <form
            onSubmit={handleSaveEdit}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Pencil className="h-4 w-4 text-emerald-600" /> Editar usuário
              </div>
              <button
                type="button"
                onClick={() => !savingEdit && setEditTarget(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Foto */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <div className="flex items-center gap-3">
                  {editAvatarUrl ? (
                    <img
                      src={editAvatarUrl}
                      alt={editName || editTarget.name}
                      className="h-12 w-12 shrink-0 rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: editTarget.avatarBg }}
                    >
                      {getInitials(editName || editTarget.name)}
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-bold text-slate-800">Foto do usuário</div>
                    <div className="text-[11px] text-slate-500">
                      Otimizada 256×256 WebP
                      {editPhotoSizeKb !== null ? ` (${editPhotoSizeKb} KB)` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleEditFileChange}
                  />
                  <button
                    type="button"
                    disabled={optimizingEditPhoto}
                    onClick={() => editFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Upload className="h-3 w-3" />
                    {optimizingEditPhoto ? "Otimizando..." : "Alterar"}
                  </button>
                  {editAvatarUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditAvatarUrl(null);
                        setEditPhotoSizeKb(null);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                      title="Remover foto"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Nome completo *</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">E-mail *</label>
                <div className="relative mt-1">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Nova senha <span className="font-normal text-slate-400">(opcional · mín. 6 caracteres)</span>
                </label>
                <div className="relative mt-1">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={editShowPassword ? "text" : "password"}
                    minLength={6}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Deixe em branco para manter a senha atual"
                    className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-9 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setEditShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {editShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                disabled={savingEdit}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingEdit || optimizingEditPhoto}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" /> {savingEdit ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: confirmar desativação / reativação */}
      {toggleTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => !toggling && setToggleTarget(null)}
            className="absolute inset-0 cursor-default"
          />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full",
                  toggleTarget.isActive
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700",
                )}
              >
                {toggleTarget.isActive ? (
                  <UserX className="h-4 w-4" />
                ) : (
                  <UserCheck className="h-4 w-4" />
                )}
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                {toggleTarget.isActive ? "Desativar usuário" : "Reativar usuário"}
              </h3>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              {toggleTarget.isActive ? (
                <>
                  Desativar <span className="font-semibold text-slate-900">“{toggleTarget.name}”</span>? Ele
                  permanecerá na listagem como <strong>Inativo (Offline)</strong>, terá a sessão encerrada sem
                  poder fazer login e seus atendimentos em aberto serão transferidos para outro atendente
                  disponível (ou ficarão sem responsável caso não haja ninguém disponível).
                </>
              ) : (
                <>
                  Reativar o acesso de{" "}
                  <span className="font-semibold text-slate-900">“{toggleTarget.name}”</span>? O status voltará
                  para <strong>Ativo</strong> (inicialmente Offline) e o usuário poderá fazer login novamente.
                </>
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setToggleTarget(null)}
                disabled={toggling}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmToggleActive}
                disabled={toggling}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50",
                  toggleTarget.isActive
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-[#16A34A] hover:bg-emerald-700",
                )}
              >
                {toggleTarget.isActive ? (
                  <>
                    <UserX className="h-3.5 w-3.5" />
                    {toggling ? "Desativando..." : "Desativar"}
                  </>
                ) : (
                  <>
                    <UserCheck className="h-3.5 w-3.5" />
                    {toggling ? "Reativando..." : "Reativar"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: confirmar exclusão (soft delete) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => !deleting && setDeleteTarget(null)}
            className="absolute inset-0 cursor-default"
          />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Excluir usuário</h3>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              Excluir <span className="font-semibold text-slate-900">“{deleteTarget.name}”</span>? O usuário não
              será mais exibido na listagem, terá a sessão encerrada sem poder fazer login e eventuais
              atendimentos em aberto serão transferidos para outro atendente disponível (ou liberados sem
              responsável).
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> {deleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
