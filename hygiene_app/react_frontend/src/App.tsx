// src/App.tsx
'use client'

import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'

// ページ/コンポーネント
import LoginForm from '@/app/login/LoginPage'
import HygieneDashboard from '@/app/dashboard/DashboardPage'
import DailyHygieneCheckForm from '@/app/form/HygieneCheckFormPage'
import HygieneManagement from '@/app/management/ManagementPage'
import PrivateRoute from '@/components/PrivateRoute'
import { EmployeeList } from '@/components/EmployeeList'

export default function App() {
  return (
    <Router>
      <Routes>
        {/* ルート直叩き → ログインへ */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* ログイン（非保護） */}
        <Route path="/login" element={<LoginForm />} />

        {/* ダッシュボード（保護） */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <HygieneDashboard />
            </PrivateRoute>
          }
        />

        {/* 日次記録入力（保護） */}
        <Route
          path="/form"
          element={
            <PrivateRoute>
              <DailyHygieneCheckForm />
            </PrivateRoute>
          }
        />

        {/* 管理者画面（保護・ラッパー経由で必要なコールバック注入） */}
        <Route
          path="/management"
          element={
            <PrivateRoute>
              <HygieneManagementWrapper />
            </PrivateRoute>
          }
        />

        {/* 従業員一覧（保護） */}
        <Route
          path="/employees"
          element={
            <PrivateRoute>
              <EmployeeList onBack={() => history.back()} />
            </PrivateRoute>
          }
        />

        {/* 不明パス → ログインへ */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  )
}

/** 管理画面のイベントをルーティングに接続するラッパー */
function HygieneManagementWrapper() {
  const navigate = useNavigate()

  return (
    <HygieneManagement
      onEmployeeListClick={() => {
        // 管理画面から従業員一覧へ
        navigate('/employees')
      }}
      onBackToDashboard={() => {
        // 管理画面からダッシュボードへ戻る
        navigate('/dashboard')
      }}
    />
  )
}
