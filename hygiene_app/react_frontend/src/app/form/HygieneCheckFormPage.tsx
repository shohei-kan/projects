// src/app/form/HygieneCheckFormPage.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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
// Icons
import {
  Calendar,
  Save,
  AlertTriangle,
  Heart,
  Wind,
  Hand,
  Shirt,
  ClipboardCheck,
  CheckCircle,
  ChevronLeft,
  Home,
} from "lucide-react";

// Adapter（モック→APIの差し替えポイント）
import { getEmployeesByBranch, getTodayRecordWithItems,submitDailyForm} from "@/lib/hygieneAdapter";
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

/* ---------------- Component ---------------- */
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
  // セッション > 旧localStorageキー の優先で使用
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
    date: new Date(TODAY_STR).toISOString().split("T")[0],
    employee: "",
    supervisor: "",
    temperature: "36.0",
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 勤務区分（出勤日／休み）
  const [workType, setWorkType] = useState<WorkType>("work");
  // 休日に切り替えたら常に Step1 に戻す
  useEffect(() => {
    if (workType === "off" && currentStep !== 1) setCurrentStep(1);
  }, [workType, currentStep]);

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
              checked: !!normal, // is_normal === true を「正常（チェックON）」とみなす
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
      const { record, items, supervisorCode } =
        await getTodayRecordWithItems(code, basicInfo.date);
      if (aborted) return;

      // ★ 確認者コードが返ってきたら、未選択のときだけ自動セット
      if ((supervisorCode ?? "") !== "") {
        setBasicInfo(prev =>
          prev.supervisor ? prev : { ...prev, supervisor: supervisorCode! }
        );
      }


      // レコードがあれば「出勤日」に寄せる（※手動切替は尊重）
      if (record?.work_start_time) {
        setWorkType((prev) => prev); // 出勤記録があるなら off にはしない（手動で変えたときは維持）
      }

      // 休日選択中は退勤チェックのブロックは無効（タブも非表示にするため）
      if (workType === "work") {
        const isCheckedIn = !!record?.work_start_time;
        if (currentStep === 2 && !isCheckedIn) {
          alert("出勤登録がされていません。先に出勤チェックを完了してください。");
          navigate("/form");
          return;
        }
      }

      // 体温
      const tempVal = items.find((it) => it.category === "temperature")?.value;
      if (tempVal !== undefined && tempVal !== null) {
        setBasicInfo((prev) => ({
          ...prev,
          temperature: String(tempVal),
        }));
      }

      // 各カテゴリの is_normal / value を反映
      for (const it of items) {
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

  const findEmpName = (code: string) => employeesInOffice.find((e) => e.code === code)?.name ?? code;

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

  const buildSummaryComment = (isStep2: boolean) => {
    const parts: string[] = [];
    const temp = parseFloat(basicInfo.temperature);
    if (!Number.isNaN(temp) && temp >= 37.5) parts.push(`体温${basicInfo.temperature}℃`);
    const pushFrom = (arr: CheckItem[]) =>
      arr.filter(i => !i.checked && i.comment.trim()).forEach(i => parts.push(`${i.label}: ${i.comment.trim()}`));
    pushFrom(healthChecks);
    if (workType === "work") {
      pushFrom(respiratoryChecks);
      pushFrom(handHygieneChecks);
      pushFrom(uniformHygieneChecks);
    }
    if (isStep2) pushFrom(postWorkChecks);
    return parts.length ? parts.join(" / ") : undefined;
  };

  /* ---------- 保存/送信（モックのまま） ---------- */
const handleStep1Save = async () => {
  // 既存のバリデーション維持
  const lists =
    workType === "work"
      ? [healthChecks, respiratoryChecks, handHygieneChecks, uniformHygieneChecks]
      : [healthChecks];

  const requireComment = lists.flat().some((i) => !i.checked && i.comment.trim() === "");
  if (requireComment) {
    alert("異常が報告されている項目について、詳細コメントが必要です。");
    return;
  }
  if (!basicInfo.employee || !basicInfo.supervisor) {
    alert("従業員名と確認者名を入力してください。");
    return;
  }

  // 送信用アイテムを組み立て（collectStep1Items は使わずAPI仕様に合わせる）
  const items: { category: string; is_normal: boolean; value?: number | string | null; comment?: string | null }[] = [
    { category: "temperature", is_normal: true, value: Number(basicInfo.temperature) },
  ];
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

  const payload = {
    employeeCode: basicInfo.employee,
    dateISO: basicInfo.date,
    workStartTime: workType === "work" ? "08:30" : null, // 必要に応じてUI化
    workEndTime: null,
    items,
    supervisorCode: basicInfo.supervisor || null,
  } as const;

  try {
    setSaving(true);
    setErrorMsg(null);
    console.info("[form->submit] step1 payload", payload);
    await submitDailyForm(payload);
    console.info("[form->submit] step1 OK");
    alert(workType === "work" ? "出勤時チェックを保存しました！" : "休日の体調チェックを保存しました！");
    navigate("/dashboard");
  } catch (err) {
    const msg = (err as Error).message;
    console.error("[form->submit] step1 NG", err);
    setErrorMsg(msg);
    alert("保存に失敗しました: " + msg);
  } finally {
    setSaving(false);
  }
};


// 既存の handleFinalSubmit を丸ごと置き換え
const handleFinalSubmit = async () => {
  const requireComment = postWorkChecks.some((i) => !i.checked && i.comment.trim() === "");
  if (requireComment) {
    alert("異常が報告されている項目について、詳細コメントが必要です。");
    return;
  }
  if (!basicInfo.employee) {
    alert("従業員を選択してください。");
    return;
  }

  // 退勤で送るペイロード（必要なら時刻はUIから変更してね）
  const payload = {
    employeeCode: basicInfo.employee,
    dateISO: basicInfo.date,
    workStartTime: null,
    workEndTime: "17:30",
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
    console.info("[form->submit] step2 payload", payload);
    await submitDailyForm(payload);
    console.info("[form->submit] step2 OK");
    alert("退勤チェックを保存しました！");
    navigate("/dashboard");
  } catch (err) {
    const msg = (err as Error).message;
    console.error("[form->submit] step2 NG", err);
    setErrorMsg(msg);
    alert("保存に失敗しました: " + msg);
  } finally {
    setSaving(false);
  }
};

  /* ---------------- Render ---------------- */
  return (
    <div className="hygiene-form min-h-screen bg-gray-50 py-4 relative">
      {
        !branchCode ? (
          // ログイン促し
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
          // ローディング
          <div className="min-h-[60vh] grid place-items-center">
            <div className="animate-pulse text-gray-500">読み込み中...</div>
          </div>
        ) : employeesInOffice.length === 0 ? (
          // 空データ
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

              {/* 勤務区分トグル（出勤日 / 休み）
              <div className="mb-4 flex items-center justify-center gap-3">
                <span className="text-sm text-gray-700">勤務区分</span>
                <Select
                  value={workType}
                  onValueChange={(v) => setWorkType(v as WorkType)}
                >
                  <SelectTrigger className="w-40 text-sm rounded-xl px-3 py-2 border-gray-300 bg-white">
                    <SelectValue placeholder="勤務区分" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    sideOffset={6}
                    className="z-[100] w-[160px] rounded-xl border border-gray-200 bg-white shadow-lg"
                  >
                    <SelectItem value="work" className="cursor-pointer pr-10 data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-700 data-[state=checked]:font-medium">
                      出勤日
                    </SelectItem>
                    <SelectItem value="off" className="cursor-pointer pr-10 data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-700 data-[state=checked]:font-medium">
                      休み
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div> */}

              {/* ステップ切替（出勤日のみ表示） */}
              {workType === "work" && (
                <div className="flex items-center justify-center mb-4 space-x-4">
                  <Button
                    variant={currentStep === 1 ? "default" : "outline"}
                    className={`text-sm rounded-xl px-6 py-2 ${
                      currentStep === 1
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                    onClick={() => setCurrentStep(1)}
                  >
                    出勤時チェック
                  </Button>
                  <Button
                    variant={currentStep === 2 ? "default" : "outline"}
                    className={`text-sm rounded-xl px-6 py-2 ${
                      currentStep === 2
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                    onClick={() => setCurrentStep(2)}
                  >
                    退勤時チェック
                  </Button>
                </div>
              )}

              <p className="text-gray-600 text-sm text-center">
                {workType === "off"
                  ? "休日の体調チェックのみを記録します（体温・体調チェック）"
                  : currentStep === 1
                  ? "出勤時の衛生管理項目を確認し、記録してください"
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
                      !basicInfo.employee || !basicInfo.supervisor ? "ring-2 ring-amber-200" : ""
                    }`}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-5 h-5 text-gray-500" />
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
                            onValueChange={(code) => setBasicInfo({ ...basicInfo, employee: code })}
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

                        {/* 確認者 */}
                        <div className="space-y-1">
                          <span className="text-gray-900 text-sm">確認者名</span>
                          <Select
                            value={basicInfo.supervisor || ""}               // ← 空は "" を渡す
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
                              className="z-[100] w-[240px] max-h-72 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg"
                            >
                              {employeesInOffice.map((e) => (
                                <SelectItem
                                  key={e.code}
                                  value={e.code}                           // ← value は“コード”
                                  className="cursor-pointer pr-10 data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-700 data-[state=checked]:font-medium"
                                >
                                  {e.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* 勤務区分（ここでも変更可能） */}
                        <div className="space-y-1">
                          <span className="text-gray-900 text-sm">勤務区分</span>
                          <Select value={workType} onValueChange={(v) => setWorkType(v as WorkType)}>
                            <SelectTrigger className="text-sm rounded-xl px-3 py-2 border-gray-300 bg-white">
                              <SelectValue placeholder="勤務区分" />
                            </SelectTrigger>
                            <SelectContent
                              position="popper"
                              sideOffset={6}
                              className="z-[100] w-[200px] rounded-xl border border-gray-200 bg-white shadow-lg"
                            >
                              <SelectItem value="work" className="cursor-pointer pr-10 data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-700 data-[state=checked]:font-medium">
                                出勤日
                              </SelectItem>
                              <SelectItem value="off" className="cursor-pointer pr-10 data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-700 data-[state=checked]:font-medium">
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

  {/* 以下は出勤日のみ表示（休みでは非表示） */}
  {workType === "work" && (
    <>
      <CompactCheckboxSection
        title="呼吸器症状"
        items={respiratoryChecks}
        setItems={setRespiratoryChecks}
        headerColor="blue"
        icon={Wind}
      />
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
    </>
  )}
</div>

                {/* 保存 */}
                <div className="flex justify-center mt-8 pb-8">
                  <Button disabled={saving} onClick={handleStep1Save} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-base gap-2 shadow-lg rounded-xl">
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
                  />
                </div>

                <div className="flex justify-center gap-4 pb-8">
                  <Button
                    onClick={() => setCurrentStep(1)}
                    variant="outline"
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-3 text-base rounded-xl gap-2"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    出勤時チェックへ
                  </Button>
                  <Button disabled={saving} onClick={handleFinalSubmit} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 text-base gap-2 shadow-lg rounded-xl">
                    <Save className="w-5 h-5" />
                    登録
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      }
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
