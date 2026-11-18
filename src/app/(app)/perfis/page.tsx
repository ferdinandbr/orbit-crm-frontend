"use client";

import { RolesPermissionsView } from "@/components/RolesPermissionsView";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";

export default function PerfisPage() {
  const { state, can, isDeveloper, loadState, notify } = useWorkspace();
  return (
    <RolesPermissionsView
      roles={state.roles}
      canManage={can("roles:manage")}
      isDeveloper={isDeveloper}
      onRefreshState={loadState}
      onNotify={notify}
    />
  );
}
