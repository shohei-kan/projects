// src/app/dashboard/DashboardPage.tsx
"use client";

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

// UI
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Icons
import { CheckCircle, Clock, Home, HelpCircle, Settings, LogOut, Edit } from "lucide-react";

// Data
import { mockEmployees, mockRecords, mockRecordItems, mockBranches } from "@/data";
import { TODAY_STR } from "@/data/mockDate";

/* ---------- utils ---------- */
const formatDate = (date: Date) => {
  const days = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${days[date.getDay()]}`;
};

type StaffRecord = {
  id: string;
  name: string;
  arrivalRegistered: boolean;
  departureRegistered: boolean;
  temperature: number | null;
  symptoms: boolean;
  comment: string;
};

type SessionUser =
  | { role: "hq_admin"; userId: string; displayName: string; branchCode: null }
  | { role: "branch_manager" | "employee"; userId: string; displayName: string; branchCode: string };

type SessionPayload = {
  isLoggedIn: true;
  loginDate: string; // "YYYY-MM-DD"
  user: SessionUser;
  managementUntil?: number; // step-up 有効期限 ms
};

const loadSession = (): SessionPayload | null => {
  try {
    return JSON.parse(localStorage.getItem("session") ?? "null");
  } catch {
    return null;
  }
};
const saveSession = (s: SessionPayload) => localStorage.setItem("session", JSON.stringify(s));

/* ---------- step-up settings ---------- */
const STEPUP_MINUTES = 20;
const MAX_ATTEMPTS = 5;
const COOLDOWN_MINUTES = 5;

/* ---------- component ---------- */
export default function HygieneDashboard() {
  const navigate = useNavigate();
  const today = new Date(TODAY_STR);

  // session
  const [session, setSession] = useState<SessionPayload | null>(() => loadSession());
  const isHQ = session?.user.role === "hq_admin";
  const branchCodeFromSession =
    session?.user.role === "branch_manager" || session?.user.role === "employee"
      ? session.user.branchCode
      : null;

  const branchCode = branchCodeFromSession ?? localStorage.getItem("branchCode") ?? "";
  const branchName = useMemo(
    () => mockBranches.find((b) => b.code === branchCode)?.name ?? "営業所未設定",
    [branchCode]
  );

  const now = Date.now();
  const managementValid = (session?.managementUntil ?? 0) > now;

  // UI state
  const [activeTab, setActiveTab] = useState<"home" | "help">("home"); // ← ヘルプ用だけ管理
  const [password, setPassword] = useState("");
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  // 当日・営業所のスタッフ一覧
  const staffRecords: StaffRecord[] = useMemo(() => {
    const todayStr = TODAY_STR;
    return mockEmployees
      .filter((emp) => emp.branchCode === branchCode)
      .map((emp) => {
        const rec = mockRecords.find((r) => r.employeeCode === emp.code && r.date === todayStr);
        const items = rec ? mockRecordItems.filter((i) => i.recordId === rec.id) : [];

        const temperatureItem = items.find((i) => i.category === "temperature");
        const temperature = temperatureItem?.value ? parseFloat(temperatureItem.value) : null;

        const symptoms = items.some(
          (i) =>
            i.is_normal === false &&
            ["health_check", "no_health_issues", "family_no_symptoms", "no_respiratory_symptoms"].includes(
              i.category
            )
        );

        const commentItem = items.find((i) => i.value && i.is_normal === false);
        const comment = commentItem?.value || "";

        return {
          id: emp.code,
          name: emp.name,
          arrivalRegistered: !!rec?.work_start_time,
          departureRegistered: !!rec?.work_end_time,
          temperature,
          symptoms,
          comment,
        };
      });
  }, [branchCode]);

  const getStatusIcon = (r: StaffRecord) => {
    if (r.arrivalRegistered && r.departureRegistered) return <CheckCircle className="w-3 h-3 text-green-600" />;
    if (r.arrivalRegistered) return <Clock className="w-3 h-3 text-yellow-600" />;
    return null;
  };
  const getStatusText = (r: StaffRecord) => {
    if (r.arrivalRegistered && r.departureRegistered) return "退勤入力済";
    if (r.arrivalRegistered) return "出勤入力済";
    return "-";
  };

  /* ------ actions ------ */
  const goHome = () => {
    setActiveTab("home");
    navigate("/dashboard");
  };
  const goForm = () => {
    navigate("/form");
  };
  const openHelp = () => {
    setActiveTab("help");
  };
  const openAdmin = () => {
    if (isHQ || managementValid) navigate("/management");
    else setIsPasswordModalOpen(true);
  };

  const handlePasswordSubmit = () => {
    if (lockedUntil && lockedUntil > Date.now()) {
      const rest = Math.ceil((lockedUntil - Date.now()) / 60000);
      alert(`試行回数が多すぎます。${rest}分後に再試行してください。`);
      return;
    }
    const branch = mockBranches.find((b) => b.code === branchCode);
    if (!branch) {
      alert("営業所情報を取得できません。");
      return;
    }
    const expectedPin = branch.managementPin ?? branch.password;
    if (!/^\d{4}$/.test(password)) {
      alert("数字4桁で入力してください。");
      return;
    }
    if (password !== expectedPin) {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + COOLDOWN_MINUTES * 60 * 1000);
        setAttempts(0);
        alert(`パスワードが間違っています。${COOLDOWN_MINUTES}分後に再試行してください。`);
      } else {
        alert(`パスワードが間違っています。（残り ${MAX_ATTEMPTS - next} 回）`);
      }
      return;
    }
    const updated: SessionPayload = {
      ...(session as SessionPayload),
      managementUntil: Date.now() + STEPUP_MINUTES * 60 * 1000,
    };
    saveSession(updated);
    setSession(updated);

    setIsPasswordModalOpen(false);
    setPassword("");
    setAttempts(0);
    setLockedUntil(null);
    navigate("/management");
  };

  const handleLogout = () => {
    localStorage.removeItem("session");
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("loginDate");
    localStorage.removeItem("role");
    localStorage.removeItem("branchCode");
    navigate("/login");
  };

  return (
    <div className="h-screen bg-gray-50 flex">
      {/* サイドバー */}
      <div className="flex flex-col h-full w-28 bg-white shadow-sm border-r p-2 gap-2">
        <button
          onClick={goHome}
          className={`w-full text-xs p-2 h-20 rounded flex flex-col items-center justify-center gap-1 ${
            activeTab === "home" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
          }`}
        >
          <Home className="w-5 h-5" />
          ホーム
        </button>
        <button
          onClick={goForm}
          className="w-full text-xs p-2 h-20 rounded flex flex-col items-center justify-center gap-1 hover:bg-gray-100"
        >
          <Edit className="w-5 h-5" />
          入力
        </button>
        <button
          onClick={openHelp}
          className={`w-full text-xs p-2 h-20 rounded flex flex-col items-center justify-center gap-1 ${
            activeTab === "help" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
          }`}
        >
          <HelpCircle className="w-5 h-5" />
          ヘルプ
        </button>
        <button
          onClick={openAdmin}
          className={`w-full text-xs p-2 h-20 rounded flex flex-col items-center justify-center gap-1 ${
            isPasswordModalOpen ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
          }`}
        >
          <Settings className="w-5 h-5" />
          管理画面
        </button>

        <div className="mt-auto">
          <button
            onClick={handleLogout}
            className="w-full text-xs p-2 h-20 rounded flex flex-col items-center gap-1 hover:bg-red-100 text-red-700"
          >
            <LogOut className="w-5 h-5" />
            ログアウト
          </button>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === "help" ? (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold mb-2">ヘルプ（準備中）</h2>
            <p className="text-sm text-gray-600">
              今後ここに、操作手順やよくある質問を掲載します。ご要望があればメモしてください。
            </p>
          </div>
        ) : (
          <>
            <div className="text-center py-2 mb-1">
              <p className="text-3xl font-extrabold tracking-wide">{branchName}</p>
              <p className="text-gray-700 text-xl font-medium">{formatDate(today)}</p>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">記録状況</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {staffRecords.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                      <p className="truncate">{r.name}</p>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(r)}
                        <span
                          className={`text-xs ${
                            r.arrivalRegistered && r.departureRegistered
                              ? "text-green-600"
                              : r.arrivalRegistered
                              ? "text-yellow-600"
                              : "text-gray-500"
                          }`}
                        >
                          {getStatusText(r)}
                        </span>
                        {r.arrivalRegistered && !r.departureRegistered && (
                          <button
                            onClick={() => navigate(`/form?employeeCode=${r.id}&step=2`)}
                            className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 ring-1 ring-inset ring-blue-300 hover:bg-blue-200 hover:ring-blue-400 transition"
                          >
                            退勤チェック
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* 管理者パス（営業所PIN） */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent
          className="bg-white rounded-2xl"
        >
          <DialogHeader>
            <DialogTitle id="mgmt-title">管理者認証</DialogTitle>
            <DialogDescription id="mgmt-desc" className="whitespace-pre-line">
              {`営業所の管理用パスワード（数字4桁）を入力してください。\n認証は ${STEPUP_MINUTES} 分間有効です。`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
              placeholder="管理用パスワード（数字4桁）"
              inputMode="numeric"
            />
            <div className="flex gap-2 justify-end">
              <Button
                className="h-9 rounded-lg border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                variant="outline"
                onClick={() => {
                  setIsPasswordModalOpen(false);
                  setPassword("");
                }}
              >
                キャンセル
              </Button>
              <Button
                className="h-9 rounded-lg bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handlePasswordSubmit}
                disabled={!/^\d{4}$/.test(password)}
              >
                認証
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
