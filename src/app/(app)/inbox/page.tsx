"use client";

import { InboxView } from "@/components/InboxView";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";

export default function InboxPage() {
  const {
    state,
    currentUser,
    can,
    selectedConversationId,
    setSelectedConversationId,
    loadState,
    notify,
    navigateTo,
  } = useWorkspace();

  return (
    <InboxView
      vocabularyLead={state.activeOrganization.vocabulary.lead}
      currentUser={currentUser}
      members={state.members}
      channels={state.channels}
      metaTemplates={state.metaTemplates}
      conversations={state.conversations}
      messages={state.messages}
      assignmentEvents={state.assignmentEvents}
      leads={state.leads}
      stages={state.stages}
      aiAgent={state.aiAgent ?? undefined}
      quickReplies={state.quickReplies}
      selectedConversationId={selectedConversationId}
      canCreateConversation={can("conversations:create")}
      canDeleteConversation={can("conversations:delete")}
      canSend={can("inbox:send")}
      canClaim={can("inbox:claim")}
      canTransfer={can("inbox:transfer")}
      canManageQuickReplies={can("quickreplies:manage")}
      canViewLeads={can("leads:view")}
      canEditLeads={can("leads:edit")}
      canMoveLeads={can("leads:move")}
      onSelectConversation={setSelectedConversationId}
      onOpenKanban={() => navigateTo("kanban")}
      onRefreshState={loadState}
      onNotify={notify}
    />
  );
}
