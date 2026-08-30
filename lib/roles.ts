export type UserRole =
  | "platform_admin"
  | "organizer"
  | "team_manager"
  | "match_operator"
  | "player"
  | "scout";

// Platform Admin is bootstrapped/promoted manually, never self-service.
// Match Operator is assigned by an Organizer per fixture (Phase 6), not
// chosen at signup. These are the only two roles a person can pick when
// registering themselves.
export const SELF_REGISTERABLE_ROLES: { value: UserRole; label: string }[] = [
  { value: "organizer", label: "Organizer" },
  { value: "team_manager", label: "Team Manager" },
  { value: "player", label: "Player" },
  { value: "scout", label: "Scout" },
];

export const DASHBOARD_PATH_BY_ROLE: Record<UserRole, string> = {
  platform_admin: "/dashboard/admin",
  organizer: "/dashboard/organizer",
  team_manager: "/dashboard/team-manager",
  match_operator: "/dashboard/match-operator",
  player: "/dashboard/player",
  scout: "/dashboard/scout",
};
