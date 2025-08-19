"use client";

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

// UIコンポーネント
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// アイコン
import {
  AlertTriangle,
  MessageSquare,
  CheckCircle,
  Clock,
  Home,
  HelpCircle,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
  Edit,
} from "lucide-react";

// モックデータ
import {
  mockEmployees,
  mockRecords,
  mockRecordItems,
  mockBranches,
} from "@/data";

import { TODAY_STR } from "@/data/mockDate";

/* --------------------------------
 * ユーティリティ関数
 * -------------------------------- */
const isHighTemperature = (temp: number | null) =>
  temp !== null && temp > 37.5;

const formatDate = (date: Date) => {
  const days = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日","土曜日"];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${
    days[date.getDay()]
  }`;
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
  | {
      role: "branch_manager" | "employee";
      userId: string;
      displayName: string;
      branchCode: string;
    };

type SessionPayload = {
  isLoggedIn: true;
  loginDate: string; // "YYYY-MM-DD"
  user: SessionUser;
  managementUntil?: number; // 管理画面の昇格有効期限（ms）
};

const loadSession = (): SessionPayload | null => {
  try {
    return JSON.parse(localStorage.getItem("session") ?? "null");
  } catch {
    return null;
  }
};
const saveSession = (s: SessionPayload) =>
  localStorage.setItem("session", JSON.stringify(s));

/* --------------------------------
 * 昇格（管理画面入室）設定
 * -------------------------------- */
const STEPUP_MINUTES = 20;
const MAX_ATTEMPTS = 5;
const COOLDOWN_MINUTES = 5;

/* --------------------------------
 * メインコンポーネント
 * -------------------------------- */
export default function HygieneDashboard() {
  const navigate = useNavigate();
  const today = new Date(TODAY_STR);

  // セッション
  const [session, setSession] = useState<SessionPayload | null>(() => loadSession());
  const isHQ = session?.user.role === "hq_admin";
  const branchCodeFromSession =
    session?.user.role === "branch_manager" || session?.user.role === "employee"
      ? session.user.branchCode
      : null;

  // branchCode は session 優先、なければレガシーfallback
  const branchCode =
    branchCodeFromSession ?? localStorage.getItem("branchCode") ?? "";

  // 営業所表示名
  const branchName =
    useMemo(
      () => mockBranches.find((b) => b.code === branchCode)?.name ?? "営業所未設定",
      [branchCode]
    );

  // 管理者タブの昇格状態
  const now = Date.now();
  const managementValid = (session?.managementUntil ?? 0) > now;

  // UI state
  const [activeTab, setActiveTab] = useState<"home" | "health" | "help" | "admin">("home");
  const [password, setPassword] = useState("");
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isAbnormalOpen, setIsAbnormalOpen] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  // 当日・営業所のスタッフデータを算出
  const { staffRecords, abnormalRecords, recordsWithComments } = useMemo(() => {
    const todayStr = TODAY_STR;

    const staff: StaffRecord[] = mockEmployees
      .filter((emp) => emp.branchCode === branchCode)
      .map((emp) => {
        const rec = mockRecords.find(
          (r) => r.employeeCode === emp.code && r.date === todayStr
        );

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

    const abnormal = staff.filter(
      (record) => isHighTemperature(record.temperature) || record.symptoms
    );

    const withComments = staff.filter(
      (record) => record.comment && record.comment.trim() !== ""
    );

    return {
      staffRecords: staff,
      abnormalRecords: abnormal,
      recordsWithComments: withComments,
    };
  }, [branchCode]);

  // ステータスアイコン/テキストは memo の外でOK
  const getStatusIcon = (record: StaffRecord) => {
    if (record.arrivalRegistered && record.departureRegistered) {
      return <CheckCircle className="w-3 h-3 text-green-600" />;
    } else if (record.arrivalRegistered) {
      return <Clock className="w-3 h-3 text-yellow-600" />;
    }
    return null;
  };
  const getStatusText = (record: StaffRecord) => {
    if (record.arrivalRegistered && record.departureRegistered) return "退勤入力済";
    if (record.arrivalRegistered) return "出勤入力済";
    return "-";
  };

  // タブクリック
  const handleTabClick = (tab: "home" | "health" | "help" | "admin") => {
  // ★ admin は背面を切り替えない（モーダル or 直接遷移だけ）
  if (tab === "admin") {
    if (isHQ || managementValid) {
      navigate("/management");
    } else {
      setIsPasswordModalOpen(true);
    }
    return; // ← ここで終了（setActiveTabしない）
  }

  // それ以外のタブは通常通り
  setActiveTab(tab);
  switch (tab) {
    case "home":
      navigate("/dashboard");
      break;
    case "health":
      navigate("/form");
      break;
    case "help":
      alert("ヘルプ画面は準備中です");
      break;
  }
};


  // 昇格用PIN認証
  const handlePasswordSubmit = () => {
    // ロック中
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

    const expectedPin = branch.managementPin ?? branch.password; // managementPin優先、無ければpassword
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

    // 成功：昇格（期限つき）をsessionに保存
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

  // ログアウト
  const handleLogout = () => {
    // 新セッション方式＆レガシーキーをクリア
    localStorage.removeItem("session");
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("loginDate");
    localStorage.removeItem("role");
    localStorage.removeItem("branchCode");
    navigate("/login");
  };

  // コンテンツ
  const renderContent = () => {
    if (activeTab === "home") {
      return (
        <div className="p-3 h-full overflow-y-auto">
          <div className="text-center py-2 mb-1">
            <p className="text-3xl font-extrabold tracking-wide">{branchName}</p>
            <p className="text-gray-700 text-xl font-medium">{formatDate(today)}</p>
          </div>

          {abnormalRecords.length > 0 && (
            <div className="mb-3">
              <Collapsible open={isAbnormalOpen} onOpenChange={setIsAbnormalOpen}>
                <CollapsibleTrigger asChild>
                  <Card className="border-red-200 cursor-pointer hover:bg-red-50 transition-colors">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-red-700">
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          <span className="text-sm font-medium">
                            異常ありの記録 ({abnormalRecords.length}件)
                          </span>
                        </div>
                        {isAbnormalOpen ? (
                          <ChevronDown className="w-4 h-4 text-red-700" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-red-700" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="space-y-2">
                    {abnormalRecords.map((record) => (
                      <Alert key={record.id} className="border-red-200 bg-red-50 p-3">
                        <AlertDescription>
                          <p className="text-xs font-medium text-red-800">{record.name}</p>
                          {isHighTemperature(record.temperature) && (
                            <p>体温: {record.temperature}°C (高温)</p>
                          )}
                          {record.symptoms && <p>症状: あり</p>}
                          {record.comment && <p className="truncate">コメント: {record.comment}</p>}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          <div className="space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">記録済みスタッフ状況</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {staffRecords.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                    >
                      <p className="truncate">{record.name}</p>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(record)}
                        <span
                          className={`text-xs ${
                            record.arrivalRegistered && record.departureRegistered
                              ? "text-green-600"
                              : record.arrivalRegistered
                              ? "text-yellow-600"
                              : "text-gray-500"
                          }`}
                        >
                          {getStatusText(record)}
                        </span>
                        {record.arrivalRegistered && !record.departureRegistered && (
                          <button
                            onClick={() =>
                              navigate(`/form?employeeCode=${record.id}&step=2`)
                            }
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

            {recordsWithComments.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    コメント付き提出
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {recordsWithComments.map((record) => (
                      <div
                        key={record.id}
                        className="p-2 bg-blue-50 rounded border-l-4 border-blue-200"
                      >
                        <p className="text-sm font-medium text-blue-900 mb-1">
                          {record.name}
                        </p>
                        <p className="text-xs text-blue-700 line-clamp-2">
                          {record.comment}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      );
    }

    if (activeTab === "health") return <div className="p-3">健康管理機能</div>;
    if (activeTab === "help") return <div className="p-3">ヘルプ機能</div>;
    if (activeTab === "admin") return <div className="p-3">管理者機能</div>;
    return null;
  };

  return (
    <div className="h-screen bg-gray-50 flex">
      {/* サイドバー */}
      <div className="flex flex-col h-full w-28 bg-white shadow-sm border-r p-2 gap-2">
        <button
          onClick={() => handleTabClick("home")}
          className={`w-full text-xs p-2 h-20 rounded flex flex-col items-center justify-center gap-1 ${
            activeTab === "home" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
          }`}
        >
          <Home className="w-5 h-5" />
          ホーム
        </button>
        <button
          onClick={() => handleTabClick("health")}
          className={`w-full text-xs p-2 h-20 rounded flex flex-col items-center justify-center gap-1 ${
            activeTab === "health" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
          }`}
        >
          <Edit className="w-5 h-5" />
          健康管理
        </button>
        <button
          onClick={() => handleTabClick("help")}
          className={`w-full text-xs p-2 h-20 rounded flex flex-col items-center justify-center gap-1 ${
            activeTab === "help" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
          }`}
        >
          <HelpCircle className="w-5 h-5" />
          ヘルプ
        </button>
        {/* ボタンの className 判定に isPasswordModalOpen を追加 */}
        <button
          onClick={() => handleTabClick("admin")}
          className={`w-full text-xs p-2 h-20 rounded flex flex-col items-center justify-center gap-1 ${
            /* 選択中の見た目を isPasswordModalOpen でも有効に */
            isPasswordModalOpen ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
          }`}
        >
          <Settings className="w-5 h-5" />
          管理画面
        </button>


        <div className="mt-auto">
          <button
            onClick={handleLogout}
            className="w-full text-xs p-2 h-20 rounded flex flex-col items-center justify-center gap-1 hover:bg-red-100 text-red-700"
          >
            <LogOut className="w-5 h-5" />
            ログアウト
          </button>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-hidden">{renderContent()}</div>

      {/* 管理者パスワード入力（営業所ごとのPIN） */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent className="bg-white rounded-2xl" aria-labelledby="mgmt-title" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle id="mgmt-title">管理者認証</DialogTitle>
            <DialogDescription id="mgmt-desc">
              {/* 営業所の管理用パスワード（数字4桁）を入力してください。認証は {STEPUP_MINUTES} 分間有効です。 */}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
              >
                認証
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              認証は {STEPUP_MINUTES} 分間有効です。時間経過後は再入力が必要です。
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
