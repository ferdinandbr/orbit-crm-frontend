import type { ChannelCapabilities, ChannelProvider } from "./types";

/**
 * Matriz canônica de capacidades por canal (inspirada em lib/channels/capabilities.ts do DeskcommCRM).
 * Regra arquitetural: a UI e a IA não testam `if (provider === ...)` espalhados;
 * consultam `getChannelCapabilities(provider)` para saber o que o transporte permite.
 */
export const CHANNEL_CAPABILITIES: Record<ChannelProvider, ChannelCapabilities> = {
  evolution: {
    provider: "evolution",
    label: "Evolution API (QR Code / Baileys)",
    freeformOutsideWindow: true,
    requiresTemplates: false,
    canManageTemplates: false,
    banRisk: true,
    minIntervalMs: 1800,
    voiceNote: "server-convert",
    groups: "full",
    costPerMessage: false,
    canEditSentMessage: true,
  },
  meta_cloud: {
    provider: "meta_cloud",
    label: "API Oficial da Meta (Cloud API)",
    freeformOutsideWindow: false,
    requiresTemplates: true,
    canManageTemplates: true,
    banRisk: false,
    minIntervalMs: 6000,
    voiceNote: "opus-only",
    groups: "limited",
    costPerMessage: true,
    canEditSentMessage: false,
  },
};

export function getChannelCapabilities(provider: ChannelProvider): ChannelCapabilities {
  return CHANNEL_CAPABILITIES[provider];
}
