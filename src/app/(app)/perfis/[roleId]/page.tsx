"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RoleEditor } from "@/components/RoleEditor";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";

export default function EditarPerfilPage() {
  const { state, can, isDeveloper, loadState, notify } = useWorkspace();
  const router = useRouter();
  const { roleId } = useParams<{ roleId: string }>();
  const role = state.roles.find((r) => r.id === roleId) ?? null;

  if (!role) {
    return (
      <div className="thin-scrollbar h-full overflow-y-auto bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <button
            type="button"
            onClick={() => router.push("/perfis")}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para Perfis
          </button>
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
            Perfil não encontrado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <RoleEditor
      key={role.id}
      role={role}
      permissionCatalog={state.permissionCatalog}
      canManage={can("roles:manage")}
      isDeveloper={isDeveloper}
      onRefreshState={loadState}
      onNotify={notify}
      onClose={() => router.push("/perfis")}
    />
  );
}
