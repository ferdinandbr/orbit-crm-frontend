"use client";

import { SettingsView } from "@/components/SettingsView";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";

export default function ConfiguracoesPage() {
  const { state, can, loadState, notify } = useWorkspace();
  return (
    <SettingsView
      organization={state.activeOrganization}
      channels={state.channels}
      metaTemplates={state.metaTemplates}
      onRefreshState={loadState}
      onNotify={notify}
      canEditEvolutionConfig={can("channels:evolution:create")}
      canCreateMetaChannel={can("channels:meta:create")}
      canEditChannels={can("channels:edit")}
      canDisconnectChannel={can("channels:disconnect")}
      canDeleteChannel={can("channels:delete")}
      canViewSecrets={can("channels:secrets:view")}
      canViewTemplates={can("templates:view")}
      canCreateTemplate={can("templates:create")}
      canSyncTemplates={can("templates:sync")}
      canEditTemplate={can("templates:edit")}
      canDeleteTemplate={can("templates:delete")}
    />
  );
}
