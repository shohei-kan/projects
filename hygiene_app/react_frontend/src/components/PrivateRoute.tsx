"use client";

import { Navigate } from "react-router-dom";
import { TODAY_STR } from "@/data/mockDate";

// ロール型（ここで完結させています。共通化したい場合は別ファイルへ）
type UserRole = "hq_admin" | "branch_manager" | "employee";

type SessionUser =
  | { role: "hq_admin"; userId: string; displayName: string; branchCode: null }
  | { role: "branch_manager" | "employee"; userId: string; displayName: string; branchCode: string };

type SessionPayload = {
  isLoggedIn: true;
  loginDate: string; // "YYYY-MM-DD"
  user: SessionUser;
};

function loadSession(): SessionPayload | null {
  try {
    const raw = localStorage.getItem("session");
    return raw ? (JSON.parse(raw) as SessionPayload) : null;
  } catch {
    return null;
  }
}

function legacyIsAuthenticated(): boolean {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  const loginDate = localStorage.getItem("loginDate"); // "YYYY-MM-DD"
  return isLoggedIn && loginDate === TODAY_STR;
}

function legacyRole(): UserRole | null {
  const r = localStorage.getItem("role");
  return r === "hq_admin" || r === "branch_manager" || r === "employee" ? r : null;
}

export default function PrivateRoute({
  children,
  allow,
}: {
  children: React.ReactNode;
  /** 許可するロール。未指定なら「ログイン済み」だけを確認 */
  allow?: UserRole[];
}) {
  const s = loadSession();
  const isAuthenticated =
    (s?.isLoggedIn === true && s.loginDate === TODAY_STR) || legacyIsAuthenticated();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // ロールチェック（allow が指定されている場合のみ）
  if (allow && allow.length > 0) {
    const role: UserRole | null = s?.user.role ?? legacyRole();
    if (!role || !allow.includes(role)) {
      return <Navigate to="/forbidden" replace />;
    }
  }

  return <>{children}</>;
}
