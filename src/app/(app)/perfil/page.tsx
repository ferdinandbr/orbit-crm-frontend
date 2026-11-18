"use client";

import { ProfileView } from "@/components/ProfileView";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";

export default function PerfilPage() {
  const { state, currentUser, isDeveloper, loadState, notify } = useWorkspace();
  const roleSlug = state.roles.find((r) => r.id === currentUser.roleId)?.slug ?? currentUser.role;
  const canEditEmail = isDeveloper || roleSlug === "admin";
  return (
    <ProfileView
      currentUser={currentUser}
      organization={state.activeOrganization}
      canEditEmail={canEditEmail}
      onRefreshState={loadState}
      onNotify={notify}
    />
  );
}
