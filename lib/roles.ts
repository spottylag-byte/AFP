export type UserRole =
  | "platform_admin"
  | "organizer"
  | "team_manager"
  | "match_operator"
  | "player"
  | "scout";

// Platform Admin is bootstrapped/promoted manually, never self-service.
// Match Operator WAS excluded here too in Phase 1 ("assigned by an
// Organizer per fixture, not chosen at signup") -- reversed in Phase 6:
// an organizer still assigns an operator to a specific fixture, but the
// operator needs an account to be assigned in the first place, and
// building a full invite/promotion system just for that would be
// disproportionate for a lightweight volunteer role.
export const SELF_REGISTERABLE_ROLES: { value: UserRole; label: string }[] = [
  { value: "organizer", label: "Organizer" },
  { value: "team_manager", label: "Team Manager" },
  { value: "player", label: "Player" },
  { value: "scout", label: "Scout" },
  { value: "match_operator", label: "Match Operator" },
];

export const DASHBOARD_PATH_BY_ROLE: Record<UserRole, string> = {
  platform_admin: "/dashboard/admin",
  organizer: "/dashboard/organizer",
  team_manager: "/dashboard/team-manager",
  match_operator: "/dashboard/match-operator",
  player: "/dashboard/player",
  scout: "/dashboard/scout",
};
