// src/App.tsx
"use client";

import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";

// ページ/コンポーネント
import LoginForm from "@/app/login/LoginPage";
import HygieneDashboard from "@/app/dashboard/DashboardPage";
import DailyHygieneCheckForm from "@/app/form/HygieneCheckFormPage";
import HygieneManagement from "@/app/management/ManagementPage";
import PrivateRoute from "@/components/PrivateRoute";
import { EmployeeList } from "@/components/EmployeeList";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* ルート直叩き → ログインへ */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* ログイン（非保護） */}
        <Route path="/login" element={<LoginForm />} />

        {/* ダッシュボード（営業所ユーザーのみ） */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute allow={["branch_manager", "employee"]}>
              <HygieneDashboard />
            </PrivateRoute>
          }
        />

        {/* 日次記録入力（営業所ユーザーのみ） */}
        <Route
          path="/form"
          element={
            <PrivateRoute allow={["branch_manager", "employee"]}>
              <DailyHygieneCheckForm />
            </PrivateRoute>
          }
        />

        {/* 本部管理画面（本部のみ） */}
        <Route
          path="/admin"
          element={
            <PrivateRoute allow={["hq_admin"]}>
              <HygieneManagementWrapper />
            </PrivateRoute>
          }
        />
        {/* 互換：既存の /management も同じ扱いにしておく */}
        <Route
          path="/management"
          element={
            <PrivateRoute allow={["hq_admin", "branch_manager"]}>
              <HygieneManagementWrapper />
            </PrivateRoute>
          }
        />

        {/* 従業員一覧（本部 or 営業所管理者） */}
        <Route
          path="/employees"
          element={
            <PrivateRoute allow={["hq_admin", "branch_manager"]}>
              <EmployeeList onBack={() => history.back()} />
            </PrivateRoute>
          }
        />

        {/* 不明パス → ログインへ */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

/** 管理画面のイベントをルーティングに接続するラッパー */
function HygieneManagementWrapper() {
  const navigate = useNavigate();

  return (
    <HygieneManagement
      onEmployeeListClick={() => {
        // 管理画面から従業員一覧へ
        navigate("/employees");
      }}
      onBackToDashboard={() => {
        // 管理画面からダッシュボードへ戻る
        navigate("/dashboard");
      }}
    />
  );
}
