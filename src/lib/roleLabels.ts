/**
 * Maps internal DB role values to user-friendly display labels.
 * DB values are never changed — only display text.
 */
export function getRoleLabel(role: string): string {
  switch (role) {
    case "coordinator":
      return "Care Organizer";
    case "supporter":
    case "member":
      return "Support Team";
    case "supported_person":
      return "Supported Person";
    default:
      return role;
  }
}
