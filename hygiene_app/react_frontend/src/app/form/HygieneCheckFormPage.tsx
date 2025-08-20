"use client";

import { useEffect, useMemo, useState, useLayoutEffect, Fragment, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

// UI
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
// Icons
import {
  Calendar, Save, AlertTriangle, Heart, Wind, Hand, Shirt,
  ClipboardCheck, CheckCircle, ChevronLeft, Home,
} from "lucide-react";

// Headless UI
import { Listbox, Transition, Portal } from "@headlessui/react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";

// Data
import { mockEmployees, mockRecords, mockRecordItems } from "@/data";
import { TODAY_STR } from "@/data/mockDate";

/* ---------------- Types / Const ---------------- */
interface CheckItem {
  id: string;
  label: string;
  checked: boolean;
  requiresComment: boolean;
  comment: string;
  guidance?: string;
}

/* ---------------- Reusable: Listbox（Portal版） ----------------
   親の overflow や z-index に影響されないドロップダウン。
   - Options は document.body 直下（Portal）に fixed で描画
   - Trigger の位置/幅を毎回計測して追従
---------------------------------------------------------------- */
// 置き換え：PortalListbox
function PortalListbox({
  value,
  onChange,
  options,
  placeholder = "選択してください",
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  return (
    <Listbox value={value} onChange={onChange}>
      {({ open }) => {
        // トリガーの位置を監視
        useLayoutEffect(() => {
          if (!open) return;
          const update = () => btnRef.current && setRect(btnRef.current.getBoundingClientRect());
          update();
          window.addEventListener("resize", update);
          window.addEventListener("scroll", update, true);
          return () => {
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
          };
        }, [open]);

        // 位置計算（fixed基準：スクロール量は加えない）
        const MAX_H = 280;
        const PAD = 8;
        const style: React.CSSProperties = {};
        if (rect) {
          const width = Math.min(rect.width, window.innerWidth - PAD * 2);
          const left = Math.min(Math.max(rect.left, PAD), window.innerWidth - width - PAD);
          const spaceBelow = window.innerHeight - rect.bottom;
          const openUp = spaceBelow < MAX_H + 8;
          const rawTop = openUp ? rect.top - MAX_H - 8 : rect.bottom + 4;
          const top = Math.min(Math.max(rawTop, PAD), window.innerHeight - PAD - MAX_H);
          Object.assign(style, {
            position: "fixed",
            left,
            top,
            width,
            maxHeight: MAX_H,
          });
        }

        // メニュー本体（単一要素 <ul>）
        const Menu = (
          <Transition
            appear
            show={open}
            as={Fragment} // OK：子が <ul> なので props を渡せる
            enter="transition ease-out duration-100"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <ul
              className="z-[50] overflow-auto rounded-xl bg-white py-1 text-sm shadow-lg ring-1 ring-black/10 focus:outline-none"
              style={style}
            >
              {options.map((opt) => (
                <Listbox.Option
                  as="li"                   // ← DOM要素を明示（Fragment回避）
                  key={opt.value}
                  value={opt.value}
                  onClick={() => onChange(opt.value)}   // ← 明示的に選択させる
                  onKeyDown={(e) => {                   // ← Enter/Spaceでも選択
                    if (e.key === "Enter" || e.key === " ") onChange(opt.value);
                  }}
                  className={({ active }) =>
                    `relative cursor-pointer py-2 pl-10 pr-4 ${
                      active ? "bg-blue-100 text-blue-700" : "text-gray-900"
                    }`
                  }
                >
                  {({ selected }) => (
                    <>
                      <span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
                        {opt.label}
                      </span>
                      {selected && (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                          <CheckIcon className="h-4 w-4" aria-hidden="true" />
                        </span>
                      )}
                    </>
                  )}
                </Listbox.Option>

              ))}
            </ul>
          </Transition>
        );

        return (
          <div className="relative">
            <Listbox.Button
              ref={btnRef}
              className={`relative w-full cursor-default rounded-xl border px-3 py-2 text-left text-sm focus:outline-none ${
                value ? "border-gray-300 bg-white" : "border-amber-300 bg-amber-50"
              }`}
            >
              <span className="block truncate">
                {options.find((o) => o.value === value)?.label ?? placeholder}
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronUpDownIcon className="h-4 w-4 text-gray-400" />
              </span>
            </Listbox.Button>

            {/* ← Portal は Transition の“外側”ではなく、“周り”に置く */}
            {open ? createPortal(Menu, document.body) : null}
          </div>
        );
      }}
    </Listbox>
  );
}


/* ---------------- Component ---------------- */
export default function DailyHygieneCheckForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const employeeCode = searchParams.get("employeeCode") ?? "";
  const stepParam = parseInt(searchParams.get("step") ?? "1", 10);
  const [currentStep, setCurrentStep] = useState<1 | 2>(stepParam === 2 ? 2 : 1);
  const todayStr = TODAY_STR;

  const [step1Completed, setStep1Completed] = useState(false);

  // 出勤済みかチェックし、step1Completed を設定。未出勤で step2 をブロック
  useEffect(() => {
    if (!employeeCode) return;
    const todayRecord = mockRecords.find(
      (r) => r.employeeCode === employeeCode && r.date === todayStr && r.work_start_time !== null
    );
    if (todayRecord) setStep1Completed(true);
    if (currentStep === 2 && !todayRecord) {
      alert("出勤登録がされていません。先に出勤チェックを完了してください。");
      navigate("/dashboard");
    }
  }, [employeeCode, currentStep, todayStr, navigate]);

  // 対象従業員を URL から事前選択
  useEffect(() => {
    if (!employeeCode) return;
    const emp = mockEmployees.find((e) => e.code === employeeCode);
    if (emp) setBasicInfo((prev) => ({ ...prev, employee: emp.code }));
  }, [employeeCode]);

  // ログイン中の営業所
  // const branchCode = (localStorage.getItem("branchCode") ?? "").trim();
  // --- セッション優先で営業所コードを取得（HQはブランチ無し） ---
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
};

const loadSession = (): SessionPayload | null => {
  try {
    return JSON.parse(localStorage.getItem("session") ?? "null");
  } catch {
    return null;
  }
};

const session = loadSession();

const branchCodeFromSession =
  session?.user && session.user.role !== "hq_admin"
    ? (session.user.branchCode ?? "")
    : "";

// セッション > 旧localStorageキー の優先で使用
const branchCode = (branchCodeFromSession || localStorage.getItem("branchCode") || "").trim();


  // 営業所の従業員
// ログイン営業所の従業員だけ抽出（useMemo 推奨）
const employeesInOffice = useMemo(() => {
  return mockEmployees.filter((emp) => emp.branchCode === branchCode);
}, [branchCode]);

// ★ データが無い/営業所未設定のときの早期リターン（ログイン促し）
if (!branchCode || employeesInOffice.length === 0) {
  return (
    <div className="min-h-screen grid place-items-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow p-6 text-center space-y-4">
        <p className="text-lg font-medium">従業員データが取得できませんでした。</p>
        <p className="text-sm text-gray-600">
          営業所が未設定か、ログイン情報が無効です。もう一度ログインしてください。
        </p>
        <button
          className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700"
          onClick={() => {
            // 古いキーは掃除。sessionは必要なら残してOK
            localStorage.removeItem("isLoggedIn");
            localStorage.removeItem("loginDate");
            localStorage.removeItem("branchCode");
            // 必要なら session も削除
            // localStorage.removeItem("session");
            window.location.href = "/login";
          }}
        >
          ログインへ戻る
        </button>
      </div>
    </div>
  );
}
  const employeeOptions = useMemo(
    () => employeesInOffice.map((e) => ({ value: e.code, label: e.name })),
    [employeesInOffice]
  );

  
  /* ---------- 基本情報 ---------- */
  const [basicInfo, setBasicInfo] = useState({
    date: new Date(TODAY_STR).toISOString().split("T")[0],
    employee: "",
    supervisor: "",
    temperature: "36.0",
  });

  /* ---------- チェック項目 ---------- */
  const [healthChecks, setHealthChecks] = useState<CheckItem[]>([
    {
      id: "no_health_issues",
      label: "本人に体調異常はないか（下痢・嘔吐・腹痛・発熱・倦怠感等）",
      checked: true,
      requiresComment: false,
      comment: "",
      guidance: "異常がある場合は直ちに責任者に報告し、作業を中止してください",
    },
    {
      id: "family_no_symptoms",
      label: "同居者に下痢・嘔吐・発熱の症状はないか",
      checked: true,
      requiresComment: false,
      comment: "",
      guidance: "症状がある場合は家族の健康状態を継続観察し、本人の健康管理を強化してください",
    },
  ]);

  const [respiratoryChecks, setRespiratoryChecks] = useState<CheckItem[]>([
    {
      id: "no_respiratory_symptoms",
      label: "咳や喉の腫れはない",
      checked: true,
      requiresComment: false,
      comment: "",
      guidance: "症状がある場合はマスク着用を徹底し、必要に応じて医療機関を受診してください",
    },
  ]);

  const [handHygieneChecks, setHandHygieneChecks] = useState<CheckItem[]>([
    {
      id: "no_severe_hand_damage",
      label: "重度の手荒れはないか",
      checked: true,
      requiresComment: false,
      comment: "",
      guidance: "重度の手荒れがある場合は適切な保護手袋を着用し、治療を受けてください",
    },
    {
      id: "no_mild_hand_damage",
      label: "軽度の手荒れないか",
      checked: true,
      requiresComment: false,
      comment: "",
      guidance: "軽度の手荒れがある場合は保護クリーム使用し、手洗い後の保湿を心がけてください",
    },
  ]);

  const [uniformHygieneChecks, setUniformHygieneChecks] = useState<CheckItem[]>([
    {
      id: "nails_groomed",
      label: "爪・ひげは整っている",
      checked: true,
      requiresComment: false,
      comment: "",
      guidance: "整っていない場合は作業前に必ず爪を短く切り、ひげを剃って清潔にしてください",
    },
    {
      id: "proper_uniform",
      label: "服装が正しい",
      checked: true,
      requiresComment: false,
      comment: "",
      guidance: "服装が不適切な場合は規定の作業服・帽子・履物に着替えてから作業を開始してください",
    },
  ]);

  const [postWorkChecks, setPostWorkChecks] = useState<CheckItem[]>([
    {
      id: "no_work_illness",
      label: "作業中に体調不良・怪我等の発生はなかったか",
      checked: true,
      requiresComment: false,
      comment: "",
      guidance: "発生した場合は直ちに作業を中止し、責任者に報告してください",
    },
    {
      id: "proper_handwashing",
      label: "手洗いは規定通りに実施した",
      checked: true,
      requiresComment: false,
      comment: "",
      guidance: "未実施の場合は直ちに規定の手洗い手順（石鹸で30秒以上）を実施してください",
    },
  ]);

  /* ---------- その他入力 ---------- */
  const [finalConfirmation, setFinalConfirmation] = useState({ directorSignature: "" });

  /* ---------- ヘルパ ---------- */
  const updateCheckItem = (
    items: CheckItem[],
    setItems: React.Dispatch<React.SetStateAction<CheckItem[]>>,
    id: string,
    checked: boolean,
    comment?: string
  ) => {
    setItems(
      items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, checked, requiresComment: !checked };
        if (comment !== undefined) next.comment = comment;
        else if (checked) next.comment = "";
        return next;
      })
    );
  };

  /* ---------- 保存/送信 ---------- */
  const handleStep1Save = () => {
    const requireComment = [...healthChecks, ...respiratoryChecks, ...handHygieneChecks, ...uniformHygieneChecks]
      .some((i) => !i.checked && i.comment.trim() === "");
    if (requireComment) {
      alert("異常が報告されている項目について、詳細コメントが必要です。");
      return;
    }
    if (!basicInfo.employee || !basicInfo.supervisor) {
      alert("従業員名と確認者名を入力してください。");
      return;
    }
    setStep1Completed(true);
    alert("出勤時チェックを保存しました");
    navigate("/dashboard");
  };

  const handleFinalSubmit = () => {
    const requireComment = postWorkChecks.some((i) => !i.checked && i.comment.trim() === "");
    if (requireComment) {
      alert("異常が報告されている項目について、詳細コメントが必要です。");
      return;
    }
    alert("退勤チェックが完了しました");
    navigate("/dashboard");
  };

  /* ---------- 既存レコード（未使用でも一応保持） ---------- */
  const record = mockRecords.find((r) => r.employeeCode === employeeCode && r.date === todayStr);
  const recordItems = record ? mockRecordItems.filter((it) => it.recordId === record.id) : [];

  /* ---------------- Render ---------------- */
  return (
    // 先頭付近
  <div className="hygiene-form min-h-screen bg-gray-50 py-4 relative">


      <div className="max-w-7xl mx-auto px-4">
        {/* 右上：ホーム */}
        <button
          onClick={() => navigate("/dashboard")}
          className="absolute top-4 right-4 p-2 rounded-xl hover:bg-gray-100 transition"
          aria-label="ホームへ"
        >
          <Home className="w-8 h-8 text-gray-600" />
        </button>

        {/* ヘッダー */}
        <div className="mb-6">
          <h1 className="text-2xl font-medium text-gray-900 mb-4">健康管理チェックフォーム</h1>

          {/* ステップ切替 */}
          <div className="flex items-center justify-center mb-4 space-x-4">
            <Button
              variant={currentStep === 1 ? "default" : "outline"}
              className={`text-sm rounded-xl px-6 py-2 ${
                currentStep === 1 ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => setCurrentStep(1)}
            >
              出勤時チェック
            </Button>
            <Button
              variant={currentStep === 2 ? "default" : "outline"}
              className={`text-sm rounded-xl px-6 py-2 ${
                currentStep === 2 ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => setCurrentStep(2)}
            >
              退勤時チェック
            </Button>
          </div>

          <p className="text-gray-600 text-sm text-center">
            {currentStep === 1 ? "出勤時の衛生管理項目を確認し、記録してください" : "作業後の確認項目をチェックしてください"}
          </p>
        </div>

        {currentStep === 1 ? (
          <>
            {/* 基本情報 */}
            <div className="mb-8">
              <Card className={`border-gray-200 ${!basicInfo.employee || !basicInfo.supervisor ? "ring-2 ring-amber-200" : ""}`}>
                <CardHeader>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-5 h-5 text-gray-500" />
                      <CardTitle className="text-gray-700 text-lg">基本情報</CardTitle>
                    </div>
                    {basicInfo.employee && (
                      <div className="flex items-center justify-center flex-1">
                        <p className="text-3xl text-gray-700 font-semibold text-center">
                          👤 {mockEmployees.find((e) => e.code === basicInfo.employee)?.name || basicInfo.employee}
                        </p>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-4 pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 日付 */}
                    <div className="space-y-1">
                      <span className="text-gray-900 text-sm">日付</span>
                      <Input
                        id="date"
                        type="date"
                        value={basicInfo.date}
                        onChange={(e) => setBasicInfo({ ...basicInfo, date: e.target.value })}
                        className="border-gray-300 rounded-xl text-sm"
                      />
                    </div>

                    {/* 従業員 */}
                    <div className="space-y-1">
                      <span className="text-gray-900 text-sm">従業員名</span>

                      <Select
                        value={basicInfo.employee}
                        onValueChange={(code) =>
                          setBasicInfo({ ...basicInfo, employee: code })
                        }
                      >
                        <SelectTrigger
                          className={`text-sm rounded-xl px-3 py-2 ${
                            !basicInfo.employee
                              ? "border-amber-300 bg-amber-50"
                              : "border-gray-300 bg-white"
                          }`}
                        >
                          <SelectValue placeholder="従業員を選択" />
                        </SelectTrigger>

                        {/* ポータル表示＋z-index強めで絶対隠れない */}
                        <SelectContent
                          position="popper"
                          sideOffset={6}
                          className="z-[100] w-[200px] max-h-72 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg"
                        >
                          {employeesInOffice.map((e) => (
                            <SelectItem key={e.code} value={e.code} className="
                              cursor-pointer pr-10                 /* ✓アイコンのための右余白 */
                              data-[highlighted]:bg-blue-50       /* ← ホバー背景 */
                              data-[highlighted]:text-blue-700    /* ← ホバー文字色 */
                              data-[state=checked]:font-medium    /* 選択中は太字 */
                            ">
                              {e.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>


                    {/* 確認者 */}
                    <div className="space-y-1">
                      <span className="text-gray-900 text-sm">確認者名</span>

                      <Select
                        value={basicInfo.supervisor}
                        onValueChange={(code) =>
                          setBasicInfo({ ...basicInfo, supervisor: code })
                        }
                      >
                        <SelectTrigger
                          className={`text-sm rounded-xl px-3 py-2 ${
                            !basicInfo.supervisor
                              ? "border-amber-300 bg-amber-50"
                              : "border-gray-300 bg-white"
                          }`}
                        >
                          <SelectValue placeholder="確認者を選択" />
                        </SelectTrigger>

                        <SelectContent
                          position="popper"
                          sideOffset={6}
                          className="z-[100] w-[200px] max-h-72 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg"
                        >
                          {employeesInOffice.map((e) => (
                            <SelectItem key={e.code} value={e.code} className="
                              cursor-pointer pr-10                 /* ✓アイコンのための右余白 */
                              data-[highlighted]:bg-blue-50       /* ← ホバー背景 */
                              data-[highlighted]:text-blue-700    /* ← ホバー文字色 */
                              data-[state=checked]:font-medium    /* 選択中は太字 */
                            ">
                              {e.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 左列 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 体温・体調 */}
              <Card className={`border-gray-200 ${healthChecks.some((i) => !i.checked) ? "ring-2 ring-amber-200" : ""}`}>
                <CardHeader className="pb-3 bg-emerald-50 border-emerald-200">
                  <CardTitle className="text-emerald-800 flex items-center gap-2 text-sm">
                    <Heart className="w-4 h-4 text-emerald-600" />
                    体温・体調チェック
                    {!healthChecks.some((i) => !i.checked && i.comment.trim() === "") && (
                      <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />
                    )}
                    {healthChecks.some((i) => !i.checked) &&
                      healthChecks.some((i) => !i.checked && i.comment.trim() === "") && (
                        <AlertTriangle className="w-4 h-4 text-amber-600 ml-auto" />
                      )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4 pb-4">
                  <div className="space-y-1">
                    <span className="text-gray-900 text-sm">体温（℃）</span>
                    <div className="flex items-center gap-3">
                      <Input
                        id="temperature"
                        type="number"
                        step="0.1"
                        min="35.0"
                        max="42.0"
                        value={basicInfo.temperature}
                        onChange={(e) => setBasicInfo({ ...basicInfo, temperature: e.target.value })}
                        className={`w-24 text-sm rounded-xl ${
                          parseFloat(basicInfo.temperature) >= 37.5 ? "border-red-300 bg-red-50" : "border-gray-300"
                        }`}
                      />
                      {parseFloat(basicInfo.temperature) >= 37.5 && (
                        <Alert className="border-red-200 bg-red-50 flex-1 py-2 px-3">
                          <AlertTriangle className="h-3 w-3 text-red-600" />
                          <AlertDescription className="text-red-800 text-xs">
                            発熱確認。責任者に報告し、作業中止してください。
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>

                  <Separator className="bg-gray-200" />

                  <div className="space-y-3">
                    {healthChecks.map((item) => (
                      <div key={item.id} className="space-y-2">
                        <div className="flex items-start space-x-2">
                          <Checkbox
                            id={item.id}
                            checked={item.checked}
                            onCheckedChange={(checked) =>
                              updateCheckItem(healthChecks, setHealthChecks, item.id, checked as boolean)
                            }
                            className={`border-gray-300 mt-0.5 ${
                              item.checked ? "data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600" : ""
                            }`}
                          />
                          <div className="flex-1">
                            <span
                              className={`leading-relaxed text-sm ${
                                item.checked ? "text-gray-900" : "text-red-700 font-medium"
                              }`}
                            >
                              {item.label}
                            </span>
                            {!item.checked && item.guidance && (
                              <div className="mt-2">
                                <Alert className="border-amber-200 bg-amber-50 py-2 px-3">
                                  <AlertDescription className="text-amber-800 text-xs leading-tight">
                                    {item.guidance}
                                  </AlertDescription>
                                </Alert>
                              </div>
                            )}
                          </div>
                        </div>

                        {item.requiresComment && (
                          <div className="ml-5 space-y-1">
                            <span className="text-red-600 text-xs">詳細をご記入ください（必須）</span>
                            <Textarea
                              id={`${item.id}-comment`}
                              placeholder="症状や状況の詳細を記入してください"
                              value={item.comment}
                              onChange={(e) =>
                                updateCheckItem(healthChecks, setHealthChecks, item.id, item.checked, e.target.value)
                              }
                              className="border-red-200 focus:border-red-400 bg-red-50 text-sm"
                              rows={2}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 呼吸器症状 */}
              <CompactCheckboxSection
                title="呼吸器症状"
                items={respiratoryChecks}
                setItems={setRespiratoryChecks}
                headerColor="blue"
                icon={Wind}
              />
            </div>

            {/* 右列 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <CompactCheckboxSection
                title="手指・爪の状態"
                items={handHygieneChecks}
                setItems={setHandHygieneChecks}
                headerColor="orange"
                icon={Hand}
              />
              <CompactCheckboxSection
                title="服装チェック"
                items={uniformHygieneChecks}
                setItems={setUniformHygieneChecks}
                headerColor="purple"
                icon={Shirt}
              />
            </div>

            {/* Step1 保存 */}
            <div className="flex justify-center mt-8 pb-8">
              <Button onClick={handleStep1Save} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-base gap-2 shadow-lg">
                <Save className="w-5 h-5" />
                出勤時チェックを保存
              </Button>
            </div>
          </>
        ) : (
          // Step 2
          <div className="max-w-4xl mx-auto">
            <div className="text-center text-3xl font-semibold mb-4">
              👤 {mockEmployees.find((emp) => emp.code === basicInfo.employee)?.name || "従業員名未設定"}
            </div>

            <div className="mb-8">
              <CompactCheckboxSection
                title="作業後のチェック"
                items={postWorkChecks}
                setItems={setPostWorkChecks}
                headerColor="teal"
                icon={ClipboardCheck}
              />
            </div>

            <div className="flex justify-center gap-4 pb-8">
              <Button
                onClick={() => setCurrentStep(1)}
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-3 text-base gap-2"
              >
                <ChevronLeft className="w-5 h-5" />
                出勤時チェックへ
              </Button>
              <Button onClick={handleFinalSubmit} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 text-base gap-2 shadow-lg">
                <Save className="w-5 h-5" />
                登録
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  /* ---------------- Sub: Section ---------------- */
  function CompactCheckboxSection({
    title,
    items,
    setItems,
    headerColor = "blue",
    icon: Icon,
    className = "",
  }: {
    title: string;
    items: CheckItem[];
    setItems: React.Dispatch<React.SetStateAction<CheckItem[]>>;
    headerColor?: "blue" | "green" | "orange" | "purple" | "teal";
    icon?: React.ComponentType<any>;
    className?: string;
  }) {
    const getHeaderColors = (color: string) => {
      switch (color) {
        case "green":
          return "bg-emerald-50 border-emerald-200 text-emerald-800";
        case "orange":
          return "bg-orange-50 border-orange-200 text-orange-800";
        case "purple":
          return "bg-purple-50 border-purple-200 text-purple-800";
        case "teal":
          return "bg-teal-50 border-teal-200 text-teal-800";
        default:
          return "bg-blue-50 border-blue-200 text-blue-800";
      }
    };
    const getIconColors = (color: string) => {
      switch (color) {
        case "green":
          return "text-emerald-600";
        case "orange":
          return "text-orange-600";
        case "purple":
          return "text-purple-600";
        case "teal":
          return "text-teal-600";
        default:
          return "text-blue-600";
      }
    };
    const hasIssues = items.some((i) => !i.checked);
    const isComplete = !items.some((i) => !i.checked && i.comment.trim() === "");

    return (
      <Card className={`border-gray-200 ${className} ${hasIssues ? "ring-2 ring-amber-200" : ""}`}>
        <CardHeader className={`pb-3 ${getHeaderColors(headerColor)} relative`}>
          <CardTitle className="flex items-center gap-2 text-sm">
            {Icon && <Icon className={`w-4 h-4 ${getIconColors(headerColor)}`} />}
            {title}
            {isComplete && <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />}
            {hasIssues && !isComplete && <AlertTriangle className="w-4 h-4 text-amber-600 ml-auto" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4 pb-4">
          {items.map((item) => (
            <div key={item.id} className="space-y-2">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id={item.id}
                  checked={item.checked}
                  onCheckedChange={(checked) => updateCheckItem(items, setItems, item.id, checked as boolean)}
                  className={`border-gray-300 mt-0.5 ${
                    item.checked ? "data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600" : ""
                  }`}
                />
                <div className="flex-1">
                  <span className={`leading-relaxed text-sm ${item.checked ? "text-gray-900" : "text-red-700 font-medium"}`}>
                    {item.label}
                  </span>
                  {!item.checked && item.guidance && (
                    <div className="mt-2">
                      <Alert className="border-amber-200 bg-amber-50 py-2 px-3">
                        <AlertDescription className="text-amber-800 text-xs leading-tight">
                          {item.guidance}
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </div>
              </div>

              {item.requiresComment && (
                <div className="ml-5 space-y-1">
                  <span className="text-red-600 text-xs">詳細をご記入ください（必須）</span>
                  <Textarea
                    id={`${item.id}-comment`}
                    placeholder="症状や状況の詳細を記入してください"
                    value={item.comment}
                    onChange={(e) => updateCheckItem(items, setItems, item.id, item.checked, e.target.value)}
                    className="border-red-200 focus:border-red-400 bg-red-50 text-sm"
                    rows={2}
                  />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }
}
