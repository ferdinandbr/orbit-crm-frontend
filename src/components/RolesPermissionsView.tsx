"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Lock, Plus, Search, Shield, Trash2, Users } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { RoleDef } from "@/lib/types";

interface RolesPermissionsViewProps {
  roles: RoleDef[];
  canManage: boolean;
  isDeveloper: boolean;
  onRefreshState: () => Promise<void>;
  onNotify: (msg: string) => void;
}

const DEVELOPER_SLUG = "developer";
const LOCKED_PERMS_SLUGS = new Set(["admin", DEVELOPER_SLUG]);
const PAGE_SIZE = 6;

export function RolesPermissionsView({
  roles,
  canManage,
  isDeveloper,
  onRefreshState,
  onNotify,
}: RolesPermissionsViewProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<RoleDef | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canEditRole = (role: RoleDef): boolean =>
    role.slug === DEVELOPER_SLUG ? isDeveloper : canManage;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
    );
  }, [roles, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRoles = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => setPage(0), [query]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.deleteRole(deleteTarget.id);
      onNotify(`Perfil "${deleteTarget.name}" excluído.`);
      setDeleteTarget(null);
      await onRefreshState();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Erro ao excluir o perfil.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="thin-scrollbar h-full overflow-y-auto bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Shield className="h-5 w-5 text-emerald-600" /> Perfis & Permissões
            </h2>
            <p className="text-xs text-slate-500">
              Crie perfis de acesso e marque exatamente o que cada um pode fazer. As permissões são
              aplicadas no servidor em cada requisição.
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => router.push("/perfis/novo")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#16A34A] px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" /> Novo perfil
            </button>
          )}
        </div>

        {!canManage && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
            Você não tem a permissão <code>roles:manage</code>. A visualização é somente leitura.
          </div>
        )}

        {/* Busca por nome */}
        <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 sm:max-w-sm">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar perfil pelo nome…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>

        {/* Lista de perfis */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {pageRoles.map((role) => (
            <div key={role.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-slate-900">{role.name}</span>
                    {role.isSystem && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        Sistema
                      </span>
                    )}
                    {role.slug === "admin" && <Lock className="h-3 w-3 text-slate-400" />}
                  </div>
                  {role.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{role.description}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Check className="h-3.5 w-3.5 text-emerald-600" /> {role.permissions.length} permissões
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-sky-600" /> {role.membersCount} membros
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => router.push(`/perfis/${role.id}`)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {LOCKED_PERMS_SLUGS.has(role.slug) || !canEditRole(role) ? "Ver" : "Editar"}
                  </button>
                  {canManage && !role.isSystem && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(role)}
                      title="Excluir perfil"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
            Nenhum perfil encontrado{query ? ` para "${query}"` : ""}.
          </p>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {filtered.length} perfis · página {safePage + 1} de {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Próxima <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: confirmar exclusão */}
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
              <h3 className="text-sm font-bold text-slate-900">Excluir perfil</h3>
            </div>
            <p className="mt-3 text-xs text-slate-600">
              Excluir o perfil <span className="font-semibold text-slate-900">“{deleteTarget.name}”</span>?
              Esta ação não pode ser desfeita.
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
