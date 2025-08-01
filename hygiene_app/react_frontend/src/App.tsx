import { useEffect, useState } from "react"
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom"
import LoginForm from "@/app/login/LoginPage"
import HygieneDashboard from "@/app/dashboard/DashboardPage"
import DailyHygieneCheckForm from "@/app/form/HygieneCheckFormPage"
import HygieneManagement from "@/app/management/ManagementPage"
import PrivateRoute from "@/components/PrivateRoute"



function App() {
  return (
    <Router>
      <Routes>
        {/* ログインページ */}
        <Route path="/login" element={<LoginForm />} />

        {/* ダッシュボード */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <HygieneDashboard />
            </PrivateRoute>
          }
        />

        {/* 日次記録入力 */}
        <Route
          path="/form"
          element={
            <PrivateRoute>
              <DailyHygieneCheckForm />
            </PrivateRoute>
          }
        />

        {/* 管理者画面 */}
        <Route
          path="/management"
          element={
            <PrivateRoute>
              <HygieneManagementWrapper />
            </PrivateRoute>
          }
        />

        {/* どこにもマッチしない場合はログインへ */}
        <Route path="*" element={<LoginForm />} />
      </Routes>
    </Router>
  )
}

export default App

// 🔽 必要な props を補完して管理画面に渡すラッパー
function HygieneManagementWrapper() {
  const navigate = useNavigate()

  return (
    <HygieneManagement
      onEmployeeListClick={() => {
        console.log("従業員一覧クリック")
        // ここで別ページに遷移するなら navigate("/something")
      }}
      onBackToDashboard={() => {
        navigate("/dashboard")
      }}
    />
  )
}
