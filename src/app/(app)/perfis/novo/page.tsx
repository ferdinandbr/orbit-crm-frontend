"use client";

import { useRouter } from "next/navigation";
import { RoleEditor } from "@/components/RoleEditor";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";

export default function NovoPerfilPage() {
  const { state, can, isDeveloper, loadState, notify } = useWorkspace();
  const router = useRouter();
  return (
    <RoleEditor
      role={null}
      permissionCatalog={state.permissionCatalog}
      canManage={can("roles:manage")}
      isDeveloper={isDeveloper}
      onRefreshState={loadState}
      onNotify={notify}
      onClose={() => router.push("/perfis")}
    />
  );
}
