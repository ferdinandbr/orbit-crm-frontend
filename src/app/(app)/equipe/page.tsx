"use client";

import { TeamView } from "@/components/TeamView";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";

export default function EquipePage() {
  const { state, currentUser, can, loadState, notify } = useWorkspace();
  return (
    <TeamView
      organization={state.activeOrganization}
      currentUser={currentUser}
      members={state.members}
      roles={state.roles}
      canManage={can("team:invite") || can("team:edit") || can("team:update") || can("team:remove")}
      canInvite={can("team:invite")}
      canEdit={can("team:edit")}
      canUpdateUser={can("team:update")}
      canRemove={can("team:remove")}
      canConfigureRouting={can("org:settings")}
      onRefreshState={loadState}
      onNotify={notify}
    />
  );
}
