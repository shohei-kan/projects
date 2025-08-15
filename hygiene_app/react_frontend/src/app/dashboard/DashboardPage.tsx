import { useState } from "react";
import { useNavigate } from "react-router-dom";

// UIコンポーネント
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
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
  mockBranches
} from "@/data";

import { TODAY_STR } from "@/data/mockDate"; 


// -----------------------------
// ユーティリティ関数
// -----------------------------

// 高温判定
const isHighTemperature = (temp: number | null) =>
  temp !== null && temp > 37.5;

// 日付フォーマット
const formatDate = (date: Date) => {
  const days = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${
    days[date.getDay()]
  }`;
};

// ステータスアイコン
const getStatusIcon = (record: StaffRecord) => {
  if (record.arrivalRegistered && record.departureRegistered) {
    return <CheckCircle className="w-3 h-3 text-green-600" />;
  } else if (record.arrivalRegistered) {
    return <Clock className="w-3 h-3 text-yellow-600" />;
  }
  return null;
};

// ステータステキスト
const getStatusText = (record: StaffRecord) => {
  if (record.arrivalRegistered && record.departureRegistered) {
    return "退勤入力済";
  } else if (record.arrivalRegistered) {
    return "出勤入力済";
  }
  return "-";
};

// -----------------------------
// 型定義
// -----------------------------
type StaffRecord = {
  id: string;
  name: string;
  arrivalRegistered: boolean;
  departureRegistered: boolean;
  temperature: number | null;
  symptoms: boolean;
  comment: string;
};

// -----------------------------
// データ生成
// -----------------------------
const branchCode = localStorage.getItem("branchCode") ?? "";
const branchName =
  mockBranches.find((b) => b.code === branchCode)?.name ?? "営業所未設定";

// モックの日付（テスト用）
const todayStr = TODAY_STR;

// 当日・営業所のスタッフデータ生成
const staffRecords: StaffRecord[] = mockEmployees
  .filter((emp) => emp.branchCode === branchCode)
  .map((emp) => {
    const rec = mockRecords.find(
      (r) => r.employeeCode === emp.code && r.date === todayStr
    );

    const items = rec
      ? mockRecordItems.filter((item) => item.recordId === rec.id)
      : [];

    const temperatureItem = items.find((i) => i.category === "temperature");
    const temperature = temperatureItem?.value
      ? parseFloat(temperatureItem.value)
      : null;

    const symptoms = items.some(
      (i) =>
        i.is_normal === false &&
        [
          "health_check",
          "no_health_issues",
          "family_no_symptoms",
          "no_respiratory_symptoms",
        ].includes(i.category)
    );

    const commentItem = items.find(
      (i) => i.value && i.is_normal === false
    );
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

const abnormalRecords = staffRecords.filter(
  (record) => isHighTemperature(record.temperature) || record.symptoms
);

const recordsWithComments = staffRecords.filter(
  (record) => record.comment && record.comment.trim() !== ""
);

// -----------------------------
// メインコンポーネント
// -----------------------------
export default function HygieneDashboard() {
  const today = new Date(TODAY_STR);
  const [activeTab, setActiveTab] = useState("home");
  const [password, setPassword] = useState("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isAbnormalOpen, setIsAbnormalOpen] = useState(false);
  const navigate = useNavigate();

  const handleTabClick = (tab: string) => {
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
      case "admin":
        if (!isAdminAuthenticated) {
          setIsPasswordModalOpen(true);
        } else {
          navigate("/management");
        }
        break;
    }
  };

  const handlePasswordSubmit = () => {
    if (password === "0225") {
      setIsAdminAuthenticated(true);
      setIsPasswordModalOpen(false);
      setPassword("");
      navigate("/management");
    } else {
      alert("パスワードが間違っています。");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    navigate("/login");
  };

  const renderContent = () => {
    if (activeTab === "home") {
      return (
        <div className="p-3 h-full overflow-y-auto">
          <div className="text-center py-2 mb-1">
            <p className="text-3xl font-extrabold tracking-wide">{branchName}</p>
            <p className="text-gray-700 text-xl font-medium">
              {formatDate(today)}
            </p>
          </div>

          {abnormalRecords.length > 0 && (
            <div className="mb-3">
              <Collapsible
                open={isAbnormalOpen}
                onOpenChange={setIsAbnormalOpen}
              >
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
                      <Alert
                        key={record.id}
                        className="border-red-200 bg-red-50 p-3"
                      >
                        <AlertDescription>
                          <p className="text-xs font-medium text-red-800">
                            {record.name}
                          </p>
                          {isHighTemperature(record.temperature) && (
                            <p>体温: {record.temperature}°C (高温)</p>
                          )}
                          {record.symptoms && <p>症状: あり</p>}
                          {record.comment && (
                            <p className="truncate">コメント: {record.comment}</p>
                          )}
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
                              : "text-yellow-600"
                          }`}
                        >
                          {getStatusText(record)}
                        </span>
                        {record.arrivalRegistered &&
                          !record.departureRegistered && (
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
            activeTab === "home"
              ? "bg-blue-100 text-blue-700"
              : "hover:bg-gray-100"
          }`}
        >
          <Home className="w-5 h-5" />
          ホーム
        </button>
        <button
          onClick={() => handleTabClick("health")}
          className={`w-full text-xs p-2 h-20 rounded flex flex-col items-center justify-center gap-1 ${
            activeTab === "health"
              ? "bg-blue-100 text-blue-700"
              : "hover:bg-gray-100"
          }`}
        >
          <Edit className="w-5 h-5" />
          健康管理
        </button>
        <button
          onClick={() => handleTabClick("help")}
          className={`w-full text-xs p-2 h-20 rounded flex flex-col items-center justify-center gap-1 ${
            activeTab === "help"
              ? "bg-blue-100 text-blue-700"
              : "hover:bg-gray-100"
          }`}
        >
          <HelpCircle className="w-5 h-5" />
          ヘルプ
        </button>
        <button
          onClick={() => handleTabClick("admin")}
          className={`w-full text-xs p-2 h-20 rounded flex flex-col items-center justify-center gap-1 ${
            activeTab === "admin"
              ? "bg-blue-100 text-blue-700"
              : "hover:bg-gray-100"
          }`}
        >
          <Settings className="w-5 h-5" />
          管理者
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
      <div className="flex-1 overflow-hidden">{renderContent()}</div>

      {/* 管理者パスワード入力 */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent className="bg-gray-100 rounded-2xl" >
          <DialogHeader>
            <DialogTitle>管理者認証</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handlePasswordSubmit()}
              placeholder="パスワード"
            />
            <div className="flex gap-2 justify-end ">
              <Button className="h-9 rounded-lg border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                variant="outline"
                onClick={() => {
                  setIsPasswordModalOpen(false);
                  setPassword("");
                }}
              >
                キャンセル
              </Button>
              <Button className="h-9 rounded-lg bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed" onClick={handlePasswordSubmit}>認証</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
