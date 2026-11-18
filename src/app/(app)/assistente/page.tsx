"use client";

import { AiAgentView } from "@/components/AiAgentView";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";

export default function AssistentePage() {
  const { state, can, loadState, notify, isDeveloper } = useWorkspace();
  return (
    <AiAgentView
      agent={state.aiAgent}
      knowledgeSources={state.knowledgeSources}
      isDeveloper={isDeveloper}
      canConfigure={can("ai:configure")}
      canManageKnowledge={can("knowledge:manage")}
      canTest={can("inbox:send")}
      onRefreshState={loadState}
      onNotify={notify}
    />
  );
}
