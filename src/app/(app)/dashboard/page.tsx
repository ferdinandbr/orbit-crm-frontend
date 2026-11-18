"use client";

import { DashboardView } from "@/components/DashboardView";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";

export default function DashboardPage() {
  const { state, currentUser, can, navigateTo, openConversation } = useWorkspace();
  return (
    <DashboardView
      organization={state.activeOrganization}
      userName={currentUser.name}
      roleName={currentUser.roleName}
      canViewInbox={can("inbox:view")}
      canCreateConversation={can("inbox:view") && can("conversations:create")}
      canViewKanban={can("leads:view")}
      canCreateLead={can("leads:view") && can("leads:create")}
      canSendBroadcast={can("broadcasts:view") && can("broadcasts:send")}
      canEditChannels={can("channels:view") && can("channels:edit")}
      onNavigate={navigateTo}
      onOpenConversation={openConversation}
    />
  );
}
