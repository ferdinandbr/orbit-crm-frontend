"use client";

import React, { useMemo, useState } from "react";
import { ArrowLeft, Save, Shield } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { PermissionDef, RoleDef } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEVELOPER_SLUG = "developer";
const LOCKED_PERMS_SLUGS = new Set(["admin", DEVELOPER_SLUG]);

interface RoleEditorProps {
  /** null = criar novo perfil. */
  role: RoleDef | null;
  permissionCatalog: PermissionDef[];
  canManage: boolean;
  isDeveloper: boolean;
  onRefreshState: () => Promise<void>;
  onNotify: (msg: string) => void;
  /** Volta para a lista. */
  onClose: () => void;
}

export function RoleEditor({
  role,
  permissionCatalog,
  canManage,
  isDeveloper,
  onRefreshState,
  onNotify,
  onClose,
}: RoleEditorProps) {
  const isNew = role === null;
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(role ? role.permissions : ["dashboard:view", "inbox:view"]),
  );
  const [saving, setSaving] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, PermissionDef[]>();
    for (const perm of permissionCatalog) {
      const list = map.get(perm.group) ?? [];
      list.push(perm);
      map.set(perm.group, list);
    }
    return Array.from(map.entries());
  }, [permissionCatalog]);

  const permsLocked = role ? LOCKED_PERMS_SLUGS.has(role.slug) : false;
  const canEditThisRole = isNew
    ? canManage
    : role?.slug === DEVELOPER_SLUG
      ? isDeveloper
      : canManage;

  const togglePerm = (key: string) => {
    if (permsLocked || !canEditThisRole) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroup = (perms: PermissionDef[], checked: boolean) => {
    if (permsLocked || !canEditThisRole) return;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of perms) {
        if (checked) next.add(p.key);
        else next.delete(p.key);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      onNotify("Informe um nome para o perfil.");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await apiClient.createRole({
          name: name.trim(),
          description: description.trim(),
          permissions: Array.from(selected),
        });
        onNotify(`Perfil "${name.trim()}" criado.`);
      } else {
        await apiClient.updateRole(role!.id, {
          name: name.trim(),
          description: description.trim(),
          permissions: permsLocked ? undefined : Array.from(selected),
        });
        onNotify(`Perfil "${name.trim()}" atualizado.`);
      }
      await onRefreshState();
      onClose();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Erro ao salvar o perfil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="thin-scrollbar h-full overflow-y-auto bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para Perfis
        </button>

        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-slate-900">
            {isNew ? "Novo perfil de acesso" : `Editando: ${role?.name}`}
          </h2>
        </div>

        {permsLocked && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {role?.slug === DEVELOPER_SLUG ? (
              <>
                O perfil <strong>Desenvolvedor</strong> tem acesso irrestrito e só pode ser gerenciado
                por desenvolvedores.
              </>
            ) : (
              <>
                O perfil <strong>Administrador</strong> tem acesso total e não pode ter permissões
                removidas.
              </>
            )}
          </div>
        )}
        {role?.slug === DEVELOPER_SLUG && !isDeveloper && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Somente desenvolvedores podem alterar este perfil. Visualização apenas.
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              Nome do perfil
              <input
                type="text"
                value={name}
                disabled={!canEditThisRole}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Supervisor de Vendas"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900 disabled:bg-slate-50"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Descrição (opcional)
              <input
                type="text"
                value={description}
                disabled={!canEditThisRole}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="O que esse perfil representa"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900 disabled:bg-slate-50"
              />
            </label>
          </div>

          <div className="mt-5 space-y-4">
            {groups.map(([group, perms]) => {
              const allChecked = perms.every((p) => selected.has(p.key));
              return (
                <div key={group} className="rounded-xl border border-slate-100 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{group}</span>
                    {canEditThisRole && !permsLocked && (
                      <button
                        type="button"
                        onClick={() => toggleGroup(perms, !allChecked)}
                        className="text-[11px] font-semibold text-emerald-700 hover:underline"
                      >
                        {allChecked ? "Desmarcar grupo" : "Marcar grupo"}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {perms.map((perm) => {
                      const checked = permsLocked || selected.has(perm.key);
                      return (
                        <label
                          key={perm.key}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
                            checked
                              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                              : "border-slate-200 bg-white text-slate-600",
                            (!canEditThisRole || permsLocked) && "cursor-default opacity-90",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!canEditThisRole || permsLocked}
                            onChange={() => togglePerm(perm.key)}
                            className="h-3.5 w-3.5 accent-emerald-600"
                          />
                          <span className="flex-1">{perm.label}</span>
                          <code className="text-[10px] text-slate-400">{perm.key}</code>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {canEditThisRole ? "Cancelar" : "Voltar"}
            </button>
            {canEditThisRole && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#16A34A] px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "Salvando..." : isNew ? "Criar perfil" : "Salvar alterações"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
