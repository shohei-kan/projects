import { Navigate } from "react-router-dom"
import { TODAY_STR } from "@/data/mockDate";

const todayStr = () => new Date().toISOString().slice(0, 10) // 例: "2025-08-12"

export default function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true"
  const loginDate = localStorage.getItem("loginDate") // "YYYY-MM-DD" で入れる
  const isAuthenticated = isLoggedIn && loginDate === TODAY_STR;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}
