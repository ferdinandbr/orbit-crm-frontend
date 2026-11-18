"use client";

import { KanbanView } from "@/components/KanbanView";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";

export default function FunilPage() {
  const { state, currentUser, can, loadState, notify, openConversation } = useWorkspace();
  return (
    <KanbanView
      organization={state.activeOrganization}
      pipelines={state.pipelines}
      stages={state.stages}
      leads={state.leads}
      members={state.members}
      aiAgent={state.aiAgent ?? undefined}
      currentUser={currentUser}
      canCreateLeads={can("leads:create")}
      canMoveLeads={can("leads:move")}
      canDeleteLeads={can("leads:delete")}
      canManagePipelines={can("pipelines:manage")}
      canViewInbox={can("inbox:view")}
      onRefreshState={loadState}
      onOpenConversation={openConversation}
      onNotify={notify}
    />
  );
}
