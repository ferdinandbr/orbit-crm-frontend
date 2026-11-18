// =============================================================================
// Configuração central de navegação (rotas do app).
// Usada pela sidebar, pelo guard de permissão e pelos skeletons por rota.
// =============================================================================

export type NavKey =
  | "dashboard"
  | "inbox"
  | "kanban"
  | "broadcast"
  | "ai"
  | "team"
  | "roles"
  | "settings";

export interface NavItem {
  key: NavKey;
  path: string;
  label: string;
  /** Permissão necessária para ver a rota. */
  perm: string;
  section: "operacao" | "administracao";
}

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", path: "/dashboard", label: "Dashboard", perm: "dashboard:view", section: "operacao" },
  { key: "inbox", path: "/inbox", label: "Inbox", perm: "inbox:view", section: "operacao" },
  { key: "kanban", path: "/funil", label: "Funil Kanban", perm: "leads:view", section: "operacao" },
  { key: "broadcast", path: "/disparos", label: "Disparo em Massa", perm: "broadcasts:view", section: "operacao" },
  { key: "ai", path: "/assistente", label: "Assistente", perm: "ai:view", section: "operacao" },
  { key: "team", path: "/equipe", label: "Equipe", perm: "team:view", section: "operacao" },
  { key: "roles", path: "/perfis", label: "Perfis & Permissões", perm: "roles:view", section: "administracao" },
  { key: "settings", path: "/configuracoes", label: "Configurações", perm: "channels:view", section: "administracao" },
];

const BY_KEY = new Map<NavKey, NavItem>(NAV_ITEMS.map((i) => [i.key, i]));

export function navPath(key: NavKey): string {
  return BY_KEY.get(key)?.path ?? "/dashboard";
}

/** Item de nav correspondente a um pathname (considera subrotas). */
export function navForPath(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((i) => pathname === i.path || pathname.startsWith(`${i.path}/`));
}
