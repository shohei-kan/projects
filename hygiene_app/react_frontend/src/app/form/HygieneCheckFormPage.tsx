// src/app/form/HygieneCheckFormPage.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar"; // shadcn（react-day-picker）

// date-fns
import { format, parseISO, startOfMonth } from "date-fns";
import { ja } from "date-fns/locale";
import type { Formatters } from "react-day-picker";

// Icons
import {
  Calendar as CalendarIcon,
  Save,
  AlertTriangle,
  Heart,
  Wind,
  Hand,
  Shirt,
  ClipboardCheck,
  CheckCircle,
  Home,
} from "lucide-react";

// Adapter（API/モックの差し替えポイント）
import {
  getEmployeesByBranch,
  getTodayRecordWithItems,
  submitDailyForm,
  getCalendarStatus,
} from "@/lib/hygieneAdapter";

import { TODAY_STR } from "@/data/mockDate";

/* ---------------- Types ---------------- */
interface CheckItem {
  id: string;
  label: string;
  checked: boolean;
  requiresComment: boolean;
  comment: string;
  guidance?: string;
}
type WorkType = "work" | "off";

// 取得レコードを緩く受けるための型（ビルドエラー防止）
type TodayRecordLike = {
  work_start_time?: string | null;
  work_end_time?: string | null;
  status?: unknown;
  status_jp?: unknown;
  is_off?: unknown;
  day_off?: unknown;
  work_type?: unknown;
  [k: string]: unknown;
};

// どの形で返っても拾える「休み」判定
const isDayOffRecord = (rec: TodayRecordLike | null | undefined) => {
  if (!rec) return false;
  return (
    rec.status === "休み" ||
    rec.status_jp === "休み" ||
    rec.is_off === true ||
    rec.day_off === true ||
    /off/i.test(String(rec.work_type ?? ""))
  );
};

/* いまのローカル時刻を HH:mm:ss で返す（DRF TimeField はこのフォーマットでOK） */
const nowHHMMSS = () => format(new Date(), "HH:mm:ss");

/* ---------------- Top-level subcomponent ---------------- */
type SectionProps = {
  title: string;
  items: CheckItem[];
  setItems: React.Dispatch<React.SetStateAction<CheckItem[]>>;
  headerColor?: "blue" | "green" | "orange" | "purple" | "teal";
  icon?: React.ComponentType<any>;
  className?: string;
  updateCheckItem: (
    setItems: React.Dispatch<React.SetStateAction<CheckItem[]>>,
    id: string,
    checked: boolean,
    comment?: string
  ) => void;
};

export const CompactCheckboxSection = React.memo(function CompactCheckboxSection({
  title,
  items,
  setItems,
  headerColor = "blue",
  icon: Icon,
  className = "",
  updateCheckItem,
}: SectionProps) {
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
              <label htmlFor={item.id} className="flex items-center gap-3 cursor-pointer select-none">
                <Checkbox
                  id={item.id}
                  checked={item.checked}
                  onCheckedChange={(checked) =>
                    updateCheckItem(setItems, item.id, checked as boolean)
                  }
                  className={`h-4 w-4 shrink-0 translate-y-[1px] border-gray-300 ${
                    item.checked
                      ? "data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                      : ""
                  }`}
                />
                <span
                  className={`text-sm leading-4 ${
                    item.checked ? "text-gray-900" : "text-red-700 font-medium"
                  }`}
                >
                  {item.label}
                </span>
              </label>
            </div>

            {item.requiresComment && (
              <div className="ml-5 space-y-1">
                <span className="text-red-600 text-xs">詳細をご記入ください（必須）</span>
                <Textarea
                  id={`${item.id}-comment`}
                  placeholder="症状や状況の詳細を記入してください"
                  value={item.comment ?? ""}
                  onChange={(e) => updateCheckItem(setItems, item.id, item.checked, e.target.value)}
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
});

/* ---------------- Page Component ---------------- */
export default function DailyHygieneCheckForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const employeeCodeParam = searchParams.get("employeeCode") ?? "";
  const stepParam = parseInt(searchParams.get("step") ?? "1", 10);
  const [currentStep, setCurrentStep] = useState<1 | 2>(stepParam === 2 ? 2 : 1);

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
  const branchCode = (branchCodeFromSession || localStorage.getItem("branchCode") || "").trim();

  /* ---------- 従業員一覧をアダプターから取得 ---------- */
  const [employeesInOffice, setEmployeesInOffice] = useState<
    Array<{ code: string; name: string; branchCode: string }>
  >([]);
  const [empLoaded, setEmpLoaded] = useState(false);

  useEffect(() => {
    if (!branchCode) {
      setEmpLoaded(true);
      return;
    }
    let aborted = false;
    (async () => {
      try {
        const list = await getEmployeesByBranch(branchCode);
        if (!aborted) setEmployeesInOffice(list);
      } finally {
        if (!aborted) setEmpLoaded(true);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [branchCode]);

  /* ---------- 基本情報（フォームヘッダー） ---------- */
  const [basicInfo, setBasicInfo] = useState({
    date: TODAY_STR,
    employee: "",
    supervisor: "",
    temperature: "36.0",
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 勤務区分（出勤日／休み）
  const [workType, setWorkType] = useState<WorkType>("work");

  // 出勤・退勤・休み登録フラグ
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [alreadyCheckedOut, setAlreadyCheckedOut] = useState(false); // 退勤登録済み
  const [alreadyOff, setAlreadyOff] = useState(false);               // 休み登録済み
  const isLocked = alreadyCheckedOut || alreadyOff;                  // ロック共通
  const step1Locked = isCheckedIn || isLocked;

  // URL の employeeCode を初期選択（従業員一覧取得後に）
  useEffect(() => {
    if (!employeeCodeParam) return;
    const exists = employeesInOffice.some((e) => e.code === employeeCodeParam);
    if (exists) {
      setBasicInfo((prev) => ({ ...prev, employee: employeeCodeParam }));
    }
  }, [employeeCodeParam, employeesInOffice]);

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

  /* ---------- 既存レコードの反映（アダプター経由） ---------- */

  // RecordItem を既存 state に反映する小ユーティリティ
  const patchSection = (
    targetId: string,
    setItems: React.Dispatch<React.SetStateAction<CheckItem[]>>,
    normal: boolean | null | undefined,
    value?: string | number | null
  ) => {
    if (normal === undefined || normal === null) return;
    setItems((prev) =>
      prev.map((it) =>
        it.id === targetId
          ? {
              ...it,
              checked: !!normal,
              requiresComment: !normal,
              comment:
                !normal && value !== undefined && value !== null
                  ? String(value)
                  : normal
                  ? ""
                  : it.comment,
            }
          : it
      )
    );
  };

  // 選択された従業員と今日の入力を取得して反映
  useEffect(() => {
    const code = basicInfo.employee || employeeCodeParam;
    if (!code) return;

    let aborted = false;
    (async () => {
      const { record, items, supervisorCode } = await getTodayRecordWithItems(code, basicInfo.date);
      if (aborted) return;

      const rec = (record ?? null) as TodayRecordLike | null;

      // 状態判定
      const checkedIn = !!rec?.work_start_time;
      const checkedOut = !!rec?.work_end_time;
      const offRegistered = isDayOffRecord(rec);

      setIsCheckedIn(checkedIn);
      setAlreadyCheckedOut(checkedOut);
      setAlreadyOff(offRegistered);

      // 休みなら勤務区分を "off" に寄せる
      if (offRegistered) setWorkType("off");

      // 自動遷移
      if (!offRegistered && checkedIn && !checkedOut) {
        setCurrentStep(2);
      } else {
        setCurrentStep(1);
      }

      // 確認者コードが返ってきたら、未選択のときだけ自動セット
      if ((supervisorCode ?? "") !== "") {
        setBasicInfo((prev) => (prev.supervisor ? prev : { ...prev, supervisor: supervisorCode! }));
      }

      // 体温
      const tempVal = items.find((it) => it.category === "temperature")?.value as
        | number
        | string
        | null
        | undefined;
      if (tempVal !== undefined && tempVal !== null) {
        setBasicInfo((prev) => ({ ...prev, temperature: String(tempVal) }));
      }

      // 各カテゴリの is_normal / value を反映
      for (const it of items as Array<{ category: string; is_normal: boolean; value?: any }>) {
        switch (it.category) {
          case "no_health_issues":
          case "family_no_symptoms":
            patchSection(it.category, setHealthChecks, it.is_normal, it.value);
            break;

          case "no_respiratory_symptoms":
            patchSection(it.category, setRespiratoryChecks, it.is_normal, it.value);
            break;

          case "no_severe_hand_damage":
          case "no_mild_hand_damage":
            patchSection(it.category, setHandHygieneChecks, it.is_normal, it.value);
            break;

          case "nails_groomed":
          case "proper_uniform":
            patchSection(it.category, setUniformHygieneChecks, it.is_normal, it.value);
            break;

          case "no_work_illness":
          case "proper_handwashing":
            patchSection(it.category, setPostWorkChecks, it.is_normal, it.value);
            break;

          default:
            break;
        }
      }
    })();

    return () => {
      aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basicInfo.employee, employeeCodeParam, basicInfo.date]);

  /* ---------- ヘルパ（関数型 setState 版） ---------- */
  const updateCheckItem = (
    setItems: React.Dispatch<React.SetStateAction<CheckItem[]>>,
    id: string,
    checked: boolean,
    comment?: string
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, checked, requiresComment: !checked };
        if (comment !== undefined) next.comment = comment;
        else if (checked) next.comment = "";
        return next;
      })
    );
  };

  const findEmpName = (code: string) =>
    employeesInOffice.find((e) => e.code === code)?.name ?? code;

  /* ---------- 送信ヘルパ（items整形・コメント要約） ---------- */
  const collectStep1Items = () => {
    const toItem = (c: CheckItem) => ({
      category: c.id,
      is_normal: c.checked,
      value: !c.checked && c.comment.trim() ? c.comment.trim() : undefined,
    });
    return [
      { category: "temperature", is_normal: true, value: String(basicInfo.temperature) },
      ...healthChecks.map(toItem),
      ...(workType === "work" ? respiratoryChecks.map(toItem) : []),
      ...(workType === "work" ? handHygieneChecks.map(toItem) : []),
      ...(workType === "work" ? uniformHygieneChecks.map(toItem) : []),
    ];
  };

  const collectStep2Items = () => {
    const toItem = (c: CheckItem) => ({
      category: c.id,
      is_normal: c.checked,
      value: !c.checked && c.comment.trim() ? c.comment.trim() : undefined,
    });
    return postWorkChecks.map(toItem);
  };

  /* ---------- 保存/送信 ---------- */
  const handleStep1Save = async () => {
    if (isLocked) {
      alert(alreadyOff ? "本日は「休み」登録済みです。" : "本日の退勤チェックは登録済みです。");
      return;
    }

    // バリデーション
    const lists =
      workType === "work"
        ? [healthChecks, respiratoryChecks, handHygieneChecks, uniformHygieneChecks]
        : [healthChecks];

    const requireComment = lists.flat().some((i) => !i.checked && i.comment.trim() === "");
    if (requireComment) {
      alert("異常が報告されている項目について、詳細コメントが必要です。");
      return;
    }
    if (!basicInfo.employee) {
      alert("従業員名を選択してください。");
      return;
    }
    if (workType === "work" && !basicInfo.supervisor) {
      alert("確認者名を入力してください（出勤日のみ必須）。");
      return;
    }

    // 送信用アイテム（API仕様に合わせて comment を送る）
    const items: {
      category: string;
      is_normal: boolean;
      value?: number | string | null;
      comment?: string | null;
    }[] = [{ category: "temperature", is_normal: true, value: Number(basicInfo.temperature) }];

    const pushFrom = (arr: CheckItem[]) => {
      arr.forEach((c) =>
        items.push({
          category: c.id,
          is_normal: c.checked,
          comment: c.comment || null,
        })
      );
    };

    pushFrom(healthChecks);
    if (workType === "work") {
      pushFrom(respiratoryChecks);
      pushFrom(handHygieneChecks);
      pushFrom(uniformHygieneChecks);
    }

    // ★ 休日なら勤務区分をアイテムとして送る（サーバが休み判定できるように）
    if (workType === "off") {
      items.push({ category: "work_type", is_normal: true, value: "off" });
    }

    const payload = {
      employeeCode: basicInfo.employee,
      dateISO: basicInfo.date,
      workStartTime: workType === "work" ? nowHHMMSS() : null, // ← 現在時刻に変更
      workEndTime: null,
      items,
      supervisorCode: basicInfo.supervisor || null,
    } as const;

    try {
      setSaving(true);
      setErrorMsg(null);
      await submitDailyForm(payload);
      alert(workType === "work" ? "出勤時チェックを保存しました！" : "休日の体調チェックを保存しました！");
      navigate("/dashboard");
    } catch (err) {
      const msg = (err as Error).message;
      setErrorMsg(msg);
      alert("保存に失敗しました: " + msg);
    } finally {
      setSaving(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (isLocked) {
      alert(alreadyOff ? "本日は「休み」登録済みです。" : "本日の退勤チェックは登録済みです。");
      return;
    }

    const requireComment = postWorkChecks.some((i) => !i.checked && i.comment.trim() === "");
    if (requireComment) {
      alert("異常が報告されている項目について、詳細コメントが必要です。");
      return;
    }
    if (!basicInfo.employee) {
      alert("従業員を選択してください。");
      return;
    }
    if (workType === "off") {
      alert("休日は退勤チェックを登録できません。");
      return;
    }
    if (!isCheckedIn) {
      alert("出勤チェックが完了していません。先に出勤チェックを保存してください。");
      setCurrentStep(1);
      return;
    }

    const payload = {
      employeeCode: basicInfo.employee,
      dateISO: basicInfo.date,
      workStartTime: null,
      workEndTime: nowHHMMSS(), // ← 現在時刻に変更
      items: postWorkChecks.map((c) => ({
        category: c.id,
        is_normal: c.checked,
        comment: c.comment || null,
      })),
      supervisorCode: basicInfo.supervisor || null,
    } as const;

    try {
      setSaving(true);
      setErrorMsg(null);
      await submitDailyForm(payload);
      alert("退勤チェックを保存しました！");
      navigate("/dashboard");
    } catch (err) {
      const msg = (err as Error).message;
      setErrorMsg(msg);
      alert("保存に失敗しました: " + msg);
    } finally {
      setSaving(false);
    }
  };

  /* ---------- カレンダーマーク ---------- */
  const jpFormatters = {
    formatCaption: (month: Date) => format(month, "yyyy年 M月", { locale: ja }),
    formatWeekdayName: (day: Date) => format(day, "eee", { locale: ja }),
  };
  const formatCaption: Formatters["formatCaption"] = (month) =>
    format(month, "yyyy年M月", { locale: ja });

  const [marks, setMarks] = useState<Set<string>>(new Set());

  const loadMarks = useCallback(async (monthDate: Date, empCode: string) => {
    try {
      const ym = format(monthDate, "yyyy-MM");
      const set = await getCalendarStatus(empCode, ym);
      setMarks(set);
    } catch (e) {
      console.warn("[calendar] loadMarks failed:", e);
      setMarks(new Set());
    }
  }, []);

  const [month, setMonth] = useState<Date>(() => startOfMonth(parseISO(basicInfo.date)));

  useEffect(() => {
    const code = basicInfo.employee || employeeCodeParam;
    if (!code || !basicInfo.date) return;
    const m = startOfMonth(parseISO(basicInfo.date));
    setMonth(m);
    loadMarks(m, code);
  }, [basicInfo.employee, employeeCodeParam, basicInfo.date, loadMarks]);

  const handleOpenChange = (open: boolean) => {
    if (!open) return;
    const code = basicInfo.employee || employeeCodeParam;
    if (code) loadMarks(month, code);
  };

  /* ---------------- Render ---------------- */
  return (
    <div className="hygiene-form min-h-screen bg-gray-50 py-4 relative">
      {!branchCode ? (
        <div className="min-h-[60vh] grid place-items-center px-6">
          <div className="max-w-md w-full bg-white rounded-xl shadow p-6 text-center space-y-4">
            <p className="text-lg font-medium">従業員データが取得できませんでした。</p>
            <p className="text-sm text-gray-600">
              営業所が未設定か、ログイン情報が無効です。もう一度ログインしてください。
            </p>
            <button
              className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700"
              onClick={() => {
                localStorage.removeItem("isLoggedIn");
                localStorage.removeItem("loginDate");
                localStorage.removeItem("branchCode");
                window.location.href = "/login";
              }}
            >
              ログインへ戻る
            </button>
          </div>
        </div>
      ) : !empLoaded ? (
        <div className="min-h-[60vh] grid place-items-center">
          <div className="animate-pulse text-gray-500">読み込み中...</div>
        </div>
      ) : employeesInOffice.length === 0 ? (
        <div className="min-h-[60vh] grid place-items-center">
          <div className="text-gray-600">この営業所に従業員が見つかりませんでした。</div>
        </div>
      ) : (
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

            {/* 既存登録アラート */}
            {(alreadyCheckedOut || alreadyOff) && (
              <div className="mb-4">
                <Alert className="border-emerald-200 bg-emerald-50">
                  <AlertDescription className="text-emerald-900 text-sm">
                    {alreadyOff
                      ? "本日は「休み」が登録済みです。再登録はできません。"
                      : "本日の退勤チェックは登録済みです。再登録はできません。"}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* ステップ切替（出勤日のみ表示） */}
            {workType === "work" && (
              <div className="flex items-center justify-center mb-4 space-x-4">
                {/* 出勤時チェックタブ */}
                <Button
                  variant={currentStep === 1 ? "default" : "outline"}
                  disabled={step1Locked && currentStep !== 1}  // 出勤済み以降は戻れない
                  title={
                    step1Locked && currentStep !== 1
                      ? (alreadyOff
                          ? "休み登録済みのため戻れません"
                          : (alreadyCheckedOut
                              ? "退勤登録済みのため戻れません"
                              : "出勤登録済みのため戻れません"))
                      : undefined
                  }
                  className={`text-sm rounded-xl px-6 py-2 ${
                    currentStep === 1
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    if (step1Locked && currentStep !== 1) return;
                    setCurrentStep(1);
                  }}
                >
                  出勤時チェック
                </Button>

                {/* 退勤時チェックタブ */}
                <Button
                  variant={currentStep === 2 ? "default" : "outline"}
                  disabled={isLocked || !isCheckedIn}
                  title={
                    isLocked
                      ? (alreadyOff ? "休み登録済みのため操作できません" : "退勤登録済みのため操作できません")
                      : (!isCheckedIn ? "出勤チェックを完了すると有効になります" : undefined)
                  }
                  className={`text-sm rounded-xl px-6 py-2 ${
                    currentStep === 2
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    if (isLocked || !isCheckedIn) return;
                    setCurrentStep(2);
                  }}
                >
                  退勤時チェック
                </Button>
              </div>
            )}

            <p className="text-gray-600 text-sm text-center">
              {workType === "off"
                ? "休日の体調チェックのみを記録します（体温・体調チェック）"
                : currentStep === 1
                ? (
                  <>
                    原則として顔色等を見ながら対面チェックを行う・対面チェックが困難な場合は自己申告とする
                    <br />出勤し作業に入る前にチェックする（異常なし✅、異常あり⬜︎）  異常ありの場合は責任者に申し出て不良内容と改善措置をコメントに記入する
                    <br />※体調異常とは、下痢、嘔吐、腹痛、発熱、倦怠感、咳、くしゃみ等の呼吸器症状
                  </>
                )
                : "作業後の確認項目をチェックしてください"}
            </p>
          </div>

          {/* Step 1 */}
          {currentStep === 1 && (
            <>
              {/* 基本情報 */}
              <div className="mb-8">
                <Card
                  className={`border-gray-200 ${
                    !basicInfo.employee || (workType === "work" && !basicInfo.supervisor)
                      ? "ring-2 ring-amber-200"
                      : ""
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center space-x-2">
                        <CalendarIcon className="w-5 h-5 text-gray-500" />
                        <CardTitle className="text-gray-700 text-lg">基本情報</CardTitle>
                      </div>
                      {basicInfo.employee && (
                        <div className="flex items-center justify-center flex-1">
                          <p className="text-3xl text-gray-700 font-semibold text-center">
                            👤 {findEmpName(basicInfo.employee)}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-4 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* 日付 */}
                      <div className="space-y-1">
                        <span className="text-gray-900 text-sm">日付</span>
                        <div className="relative">
                          <Popover onOpenChange={handleOpenChange}>
                            <PopoverTrigger asChild>
                              <div
                                role="button"
                                aria-label="カレンダーを開く"
                                className="relative w-full cursor-pointer"
                              >
                                <Input
                                  id="date"
                                  type="text"
                                  readOnly
                                  value={basicInfo.date}
                                  className="border-gray-300 rounded-xl text-sm pr-10 pointer-events-none"
                                />
                                <CalendarIcon className="w-4 h-4 text-gray-600 absolute right-2 top-1/2 -translate-y-1/2" />
                              </div>
                            </PopoverTrigger>

                            <PopoverContent
                              forceMount
                              side="bottom"
                              align="start"
                              sideOffset={8}
                              collisionPadding={12}
                              className="z-[60] p-2 w-auto rounded-xl border border-gray-200 bg-white/95 backdrop-blur shadow-lg"
                            >
                              <div className="cal-scope">
                                <Calendar
                                  locale={ja}
                                  formatters={{ formatCaption }}
                                  mode="single"
                                  month={startOfMonth(parseISO(basicInfo.date))}
                                  selected={parseISO(basicInfo.date)}
                                  onSelect={(d) => {
                                    if (d) setBasicInfo((p) => ({ ...p, date: format(d, "yyyy-MM-dd") }));
                                  }}
                                  onMonthChange={(m) => {
                                    const first = startOfMonth(m);
                                    const code = basicInfo.employee || employeeCodeParam;
                                    if (code) loadMarks(first, code);
                                  }}
                                  modifiers={{
                                    hasRecord: (day) => marks.has(format(day, "yyyy-MM-dd")),
                                  }}
                                  modifiersClassNames={{
                                    hasRecord: "has-record",
                                  }}
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      {/* 従業員 */}
                      <div className="space-y-1">
                        <span className="text-gray-900 text-sm">従業員名</span>
                        <Select
                          value={basicInfo.employee}
                          onValueChange={(code) => setBasicInfo({ ...basicInfo, employee: code })}
                          disabled={step1Locked}
                        >
                          <SelectTrigger
                            className={`text-sm rounded-xl px-3 py-2 ${
                              !basicInfo.employee ? "border-amber-300 bg-amber-50" : "border-gray-300 bg-white"
                            }`}
                          >
                            <SelectValue placeholder="従業員を選択" />
                          </SelectTrigger>
                          <SelectContent
                            position="popper"
                            sideOffset={6}
                            className="z-[100] w-[240px] max-h-72 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg"
                          >
                            {employeesInOffice.map((e) => (
                              <SelectItem
                                key={e.code}
                                value={e.code}
                                className="cursor-pointer pr-10 data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-700 data-[state=checked]:font-medium"
                              >
                                {e.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 確認者（出勤日のみ表示） */}
                      {workType === "work" && (
                        <div className="space-y-1">
                          <span className="text-gray-900 text-sm">確認者名</span>
                          <Select
                            value={basicInfo.supervisor || ""}
                            onValueChange={(code) => setBasicInfo({ ...basicInfo, supervisor: code })}
                            disabled={step1Locked}
                          >
                            <SelectTrigger
                              className={`text-sm rounded-xl px-3 py-2 ${
                                !basicInfo.supervisor ? "border-amber-300 bg-amber-50" : "border-gray-300 bg-white"
                              }`}
                            >
                              <SelectValue placeholder="確認者を選択" />
                            </SelectTrigger>
                            <SelectContent
                              position="popper"
                              sideOffset={6}
                              className="z-[100] w-[240px] max-h-72 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg"
                            >
                              {employeesInOffice.map((e) => (
                                <SelectItem
                                  key={e.code}
                                  value={e.code}
                                  className="cursor-pointer pr-10 data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-700 data-[state=checked]:font-medium"
                                >
                                  {e.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* 勤務区分 */}
                      <div className="space-y-1">
                        <span className="text-gray-900 text-sm">勤務区分</span>
                        <Select value={workType} onValueChange={(v) => setWorkType(v as WorkType)} disabled={step1Locked}>
                          <SelectTrigger className="text-sm rounded-xl px-3 py-2 border-gray-300 bg-white">
                            <SelectValue placeholder="勤務区分" />
                          </SelectTrigger>
                          <SelectContent
                            position="popper"
                            sideOffset={6}
                            className="z-[100] w-[200px] rounded-xl border border-gray-200 bg-white shadow-lg"
                          >
                            <SelectItem
                              value="work"
                              className="cursor-pointer pr-10 data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-700 data-[state=checked]:font-medium"
                            >
                              出勤日
                            </SelectItem>
                            <SelectItem
                              value="off"
                              className="cursor-pointer pr-10 data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-700 data-[state=checked]:font-medium"
                            >
                              休み
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 体温・体調（共通） */}
                <Card
                  className={`border-gray-200 ${
                    healthChecks.some((i) => !i.checked) ? "ring-2 ring-amber-200" : ""
                  }`}
                >
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
                          disabled={isLocked}
                          className={`w-24 text-sm rounded-xl ${
                            parseFloat(basicInfo.temperature) >= 37.5
                              ? "border-red-300 bg-red-50"
                              : "border-gray-300"
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
                            <label
                              htmlFor={item.id}
                              className="flex items-center gap-3 cursor-pointer select-none"
                            >
                              <Checkbox
                                id={item.id}
                                checked={item.checked}
                                disabled={isLocked}
                                onCheckedChange={(checked) =>
                                  updateCheckItem(setHealthChecks, item.id, checked as boolean)
                                }
                                className={`h-4 w-4 shrink-0 translate-y-[1px] border-gray-300 ${
                                  item.checked
                                    ? "data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                    : ""
                                }`}
                              />
                              <span
                                className={`text-sm leading-4 ${
                                  item.checked ? "text-gray-900" : "text-red-700 font-medium"
                                }`}
                              >
                                {item.label}
                              </span>
                            </label>
                          </div>

                          {item.requiresComment && (
                            <div className="ml-5 space-y-1">
                              <span className="text-red-600 text-xs">詳細をご記入ください（必須）</span>
                              <Textarea
                                id={`${item.id}-comment`}
                                placeholder="症状や状況の詳細を記入してください"
                                value={item.comment ?? ""}
                                disabled={isLocked}
                                onChange={(e) =>
                                  updateCheckItem(setHealthChecks, item.id, item.checked, e.target.value)
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

                {/* 以下は出勤日のみ表示（休みでは非表示） */}
                {workType === "work" && (
                  <>
                    <CompactCheckboxSection
                      title="呼吸器症状"
                      items={respiratoryChecks}
                      setItems={setRespiratoryChecks}
                      headerColor="blue"
                      icon={Wind}
                      updateCheckItem={updateCheckItem}
                    />
                    <CompactCheckboxSection
                      title="手指・爪の状態"
                      items={handHygieneChecks}
                      setItems={setHandHygieneChecks}
                      headerColor="orange"
                      icon={Hand}
                      updateCheckItem={updateCheckItem}
                    />
                    <CompactCheckboxSection
                      title="服装チェック"
                      items={uniformHygieneChecks}
                      setItems={setUniformHygieneChecks}
                      headerColor="purple"
                      icon={Shirt}
                      updateCheckItem={updateCheckItem}
                    />
                  </>
                )}
              </div>

              {/* 保存 */}
              <div className="flex justify-center mt-8 pb-8">
                <Button
                  disabled={saving || isLocked}
                  onClick={handleStep1Save}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-base gap-2 shadow-lg rounded-xl"
                  title={
                    isLocked
                      ? (alreadyOff ? "休み登録済みのため操作できません" : "退勤登録済みのため操作できません")
                      : undefined
                  }
                >
                  <Save className="w-5 h-5" />
                  {workType === "work" ? "出勤時チェックを保存" : "休日の体調チェックを保存"}
                </Button>
              </div>
            </>
          )}

          {/* Step 2（出勤日のみ） */}
          {workType === "work" && currentStep === 2 && (
            <div className="max-w-4xl mx-auto">
              <div className="text-center text-3xl font-semibold mb-4">
                👤 {basicInfo.employee ? findEmpName(basicInfo.employee) : "従業員名未設定"}
              </div>

              <div className="mb-8">
                <CompactCheckboxSection
                  title="作業後のチェック"
                  items={postWorkChecks}
                  setItems={setPostWorkChecks}
                  headerColor="teal"
                  icon={ClipboardCheck}
                  updateCheckItem={updateCheckItem}
                />
              </div>

              <div className="flex justify-center gap-4 pb-8">
                <Button
                  disabled={saving || !isCheckedIn || isLocked}
                  onClick={handleFinalSubmit}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 text-base gap-2 shadow-lg rounded-xl"
                  title={
                    isLocked
                      ? (alreadyOff ? "休み登録済みのため操作できません" : "退勤登録済みのため操作できません")
                      : (!isCheckedIn ? "出勤チェックを完了すると有効になります" : undefined)
                  }
                >
                  <Save className="w-5 h-5" />
                  登録
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
