export type UserRole = "hq_admin" | "branch_manager" | "employee";

export type SessionUser =
  | { role: "hq_admin"; userId: string; displayName: string; branchCode: null }
  | { role: "branch_manager"; userId: string; displayName: string; branchCode: string }
  | { role: "employee"; userId: string; displayName: string; branchCode: string };

export interface SessionPayload {
  isLoggedIn: true;
  loginDate: string; // YYYY-MM-DD
  user: SessionUser;
}

export const loadSession = (): SessionPayload | null => {
  try { return JSON.parse(localStorage.getItem("session") ?? "null"); }
  catch { return null; }
};
export const saveSession = (s: SessionPayload) =>
  localStorage.setItem("session", JSON.stringify(s));
export const clearSession = () => localStorage.removeItem("session");
