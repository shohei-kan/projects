// src/components/PrivateRoute.tsx

import { Navigate } from "react-router-dom";

interface PrivateRouteProps {
  children: React.ReactNode;
}

export default function PrivateRoute({ children }: PrivateRouteProps) {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  const loginDate = localStorage.getItem("loginDate");
  const today = new Date().toDateString();

  const isSameDay = loginDate === today;
  const isAuthenticated = isLoggedIn && isSameDay;

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}
