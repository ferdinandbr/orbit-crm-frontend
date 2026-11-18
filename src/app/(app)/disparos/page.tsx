"use client";

import { BroadcastView } from "@/components/BroadcastView";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";

export default function DisparosPage() {
  const { state, can, loadState, notify } = useWorkspace();
  return (
    <BroadcastView
      channels={state.channels}
      metaTemplates={state.metaTemplates}
      conversations={state.conversations}
      leads={state.leads}
      stages={state.stages}
      campaigns={state.broadcastCampaigns}
      canSend={can("broadcasts:send")}
      canDelete={can("broadcasts:delete")}
      onRefreshState={loadState}
      onNotify={notify}
    />
  );
}
