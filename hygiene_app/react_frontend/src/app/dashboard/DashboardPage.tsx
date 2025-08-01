import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
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
import { branchCodeMap } from "@/components/branchCodeMap";

const staffRecords = [
  { id: 1, name: "森 真樹", arrivalRegistered: true, departureRegistered: true, temperature: 36.2, symptoms: false, comment: "特に問題ありません" },
  { id: 2, name: "菅野 祥平", arrivalRegistered: true, departureRegistered: false, temperature: 36.5, symptoms: false, comment: "" },
  { id: 3, name: "池田 菜乃", arrivalRegistered: true, departureRegistered: true, temperature: 37.8, symptoms: true, comment: "軽い頭痛があります" },
];

const abnormalRecords = staffRecords.filter(
  (record) => record.temperature > 37.5 || record.symptoms
);

const recordsWithComments = staffRecords.filter(
  (record) => record.comment && record.comment.trim() !== ""
);

const getStatusIcon = (record: (typeof staffRecords)[0]) => {
  if (record.arrivalRegistered && record.departureRegistered) {
    return <CheckCircle className="w-3 h-3 text-green-600" />;
  } else if (record.arrivalRegistered) {
    return <Clock className="w-3 h-3 text-yellow-600" />;
  }
  return null;
};

const getStatusText = (record: (typeof staffRecords)[0]) => {
  if (record.arrivalRegistered && record.departureRegistered) {
    return "退勤入力済";
  } else if (record.arrivalRegistered) {
    return "出勤入力済";
  }
  return "-";
};

const formatDate = (date: Date) => {
  const days = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = days[date.getDay()];

  return `${year}年${month}月${day}日 ${dayOfWeek}`;
};

export default function HygieneDashboard() {
  const today = new Date();
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
      // まだ画面がないなら dashboard に残しておく
      alert("ヘルプ画面は準備中です");
      break;
    case "admin":
      if (!isAdminAuthenticated) {
        setIsPasswordModalOpen(true);
      } else {
        navigate("/management");
      }
      break;
    default:
      break;
  }
};



  const handlePasswordSubmit = () => {
  if (password === "0225") {
    setIsAdminAuthenticated(true);
    setIsPasswordModalOpen(false);
    setPassword("");

    // 👇 管理者画面へ自動遷移
    navigate("/management");
  } else {
    alert("パスワードが間違っています。");
  }
};
//営業所名の取得
const branchCode = localStorage.getItem("branchCode");
const branchName = branchCodeMap[branchCode ?? ""] ?? "営業所未設定";

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    navigate("/login");
  };

  const renderContent = () => {
    switch (activeTab) {
      case "home":
        return (
          <div className="p-3 h-full overflow-y-auto">
            <div className="text-center py-2 mb-1">
  <p className="text-3xl font-extrabold text-black-800 tracking-wide">{branchName}</p>
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
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-red-800">{record.name}</p>
                              <div className="text-xs text-red-700">
                                {record.temperature > 37.5 && (
                                  <p>体温: {record.temperature}°C (高温)</p>
                                )}
                                {record.symptoms && (
                                  <p>症状: あり</p>
                                )}
                                {record.comment && (
                                  <p className="truncate">コメント: {record.comment}</p>
                                )}
                              </div>
                            </div>
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
            <div className="space-y-3">
              <Card className="h-fit">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">記録済みスタッフ状況</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {staffRecords.map((record) => (
                      <div key={record.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                        <div className="flex-1 min-w-0">
                          <p className="truncate">{record.name}</p>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          {getStatusIcon(record)}
                          <span className={`text-xs ${record.arrivalRegistered && record.departureRegistered ? 'text-green-600' : 'text-yellow-600'}`}>{getStatusText(record)}</span>
                        {record.arrivalRegistered && !record.departureRegistered && (
                          <button
                            onClick={() => navigate(`/form?id=${record.id}`)}
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
                <Card className="h-fit">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      コメント付き提出
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {recordsWithComments.map((record) => (
                        <div key={record.id} className="p-2 bg-blue-50 rounded border-l-4 border-blue-200">
                          <p className="text-sm font-medium text-blue-900 mb-1">{record.name}</p>
                          <p className="text-xs text-blue-700 line-clamp-2">{record.comment}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        );
      case "health":
        return <div className="p-3">健康管理機能</div>;
      case "help":
        return <div className="p-3">ヘルプ機能</div>;
      case "admin":
        return <div className="p-3">管理者機能</div>;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex">
      <div className="flex flex-col h-full w-28 bg-white shadow-sm border-r p-2 gap-2">
        <button
  onClick={() => handleTabClick("home")}
  className={`w-full text-xs p-2 h-20 rounded transition-colors flex flex-col items-center justify-center gap-1 ${
    activeTab === "home" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
  }`}
>
  <Home className="w-5 h-5 pointer-events-none" />
  <span className="pointer-events-none">ホーム</span>
</button>

<button
  onClick={() => handleTabClick("health")}
  className={`w-full text-xs p-2 h-20 rounded transition-colors flex flex-col items-center justify-center gap-1 ${
    activeTab === "health" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
  }`}
>
  <Edit className="w-5 h-5 pointer-events-none" />
  <span className="pointer-events-none">健康管理</span>
</button>

<button
  onClick={() => handleTabClick("help")}
  className={`w-full text-xs p-2 h-20 rounded transition-colors flex flex-col items-center justify-center gap-1 ${
    activeTab === "help" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
  }`}
>
  <HelpCircle className="w-5 h-5 pointer-events-none" />
  <span className="pointer-events-none">ヘルプ</span>
</button>

<button
  onClick={() => handleTabClick("admin")}
  className={`w-full text-xs p-2 h-20 rounded transition-colors flex flex-col items-center justify-center gap-1 ${
    activeTab === "admin" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
  }`}
>
  <Settings className="w-5 h-5 pointer-events-none" />
  <span className="pointer-events-none">管理者<br />ページ</span>
</button>

        <div className="mt-auto">
          <button
            onClick={handleLogout}
            className="w-full text-xs p-2 h-20 rounded transition-colors flex flex-col items-center gap-1 hover:bg-red-100 text-red-700"
          >
            <LogOut className="w-5 h-5" />
            <span>ログアウト</span>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">{renderContent()}</div>
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-md shadow-xl border border-gray-200">
          <DialogHeader>
            <DialogTitle>管理者認証</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <span>パスワードを入力してください</span>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handlePasswordSubmit()}
                placeholder="パスワード"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setIsPasswordModalOpen(false);
                  setPassword("");
                }}
              >
                キャンセル
              </Button>
              <Button onClick={handlePasswordSubmit}>認証</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
