// src/lib/hygieneAdapter.ts
import { TODAY_STR } from "@/data/mockDate";
import { mockBranches, mockEmployees, mockRecords, mockRecordItems } from "@/data";

/** 画面表示用1行 */
export type StatusJP = "出勤入力済" | "退勤入力済" | "未入力";

export type HygieneRecordRow = {
  /** 1日×従業員で一意（ `${date}-${employeeCode}` 推奨 ） */
  id: string;
  employeeCode: string;
  employeeName: string;
  officeName: string;
  date: string; // YYYY-MM-DD
  abnormalItems: string[];
  hasComment: boolean;
  status: StatusJP;
  supervisorConfirmed: boolean;
};

export type UserRole = "hq_admin" | "branch_manager";

/* --------------------------------
 * オフィス名⇔コード、従業員検索のマップ
 * -------------------------------- */
const officeNameToCodes = (() => {
  const m = new Map<string, string[]>();
  for (const b of mockBranches) {
    const arr = m.get(b.name) ?? [];
    arr.push(b.code);
    m.set(b.name, arr);
  }
  return m;
})();

const branchCodeToOfficeName = new Map(mockBranches.map((b) => [b.code, b.name]));
const codeToEmployee = new Map(mockEmployees.map((e) => [e.code, e]));
const nameToEmployee = new Map(mockEmployees.map((e) => [e.name, e]));

/* --------------------------------
 * 便利関数
 * -------------------------------- */
export const getOfficeNames = (): string[] => Array.from(officeNameToCodes.keys());

export const getEmployeeNames = (officeName?: string): string[] => {
  if (!officeName || !officeNameToCodes.has(officeName)) {
    return mockEmployees.map((e) => e.name);
  }
  const codes = officeNameToCodes.get(officeName)!;
  return mockEmployees.filter((e) => codes.includes(e.branchCode)).map((e) => e.name);
};

const toISO = (d: Date) => d.toISOString().slice(0, 10);

const dayListOfCurrentMonth = (refISO: string) => {
  const ref = new Date(refISO);
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const list: string[] = [];
  for (let d = 1; d <= last; d++) list.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  return list;
};

const statusFromRecord = (rec: { work_start_time: string | null; work_end_time: string | null }): StatusJP => {
  if (rec.work_end_time) return "退勤入力済";
  if (rec.work_start_time) return "出勤入力済";
  return "未入力";
};

const abnormalItemsForRecordId = (recordId: number): string[] => {
  return mockRecordItems
    .filter((it) => it.recordId === recordId && it.is_normal === false)
    .map((it) => it.category);
};

const hasCommentForRecordId = (recordId: number): boolean => {
  return mockRecordItems.some((it) => it.recordId === recordId && it.value && String(it.value).trim().length > 0);
};

/* --------------------------------
 * モックから表データ作成
 * -------------------------------- */

/** 日次（営業所内の全従業員） */
export function getDailyRows(officeName: string, dateISO: string): HygieneRecordRow[] {
  const codes = officeNameToCodes.get(officeName) ?? [];
  const emps = mockEmployees.filter((e) => codes.includes(e.branchCode));

  return emps.map((e) => {
    const rec = mockRecords.find((r) => r.employeeCode === e.code && r.date === dateISO);
    if (!rec) {
      return {
        id: `${dateISO}-${e.code}`,
        employeeCode: e.code,
        employeeName: e.name,
        officeName: branchCodeToOfficeName.get(e.branchCode) ?? e.branchCode,
        date: dateISO,
        abnormalItems: [],
        hasComment: false,
        status: "未入力",
        supervisorConfirmed: false,
      };
    }
    const abns = abnormalItemsForRecordId(rec.id);
    const hasC = hasCommentForRecordId(rec.id);
    return {
      id: `${dateISO}-${e.code}`,
      employeeCode: e.code,
      employeeName: e.name,
      officeName: branchCodeToOfficeName.get(e.branchCode) ?? e.branchCode,
      date: dateISO,
      abnormalItems: abns,
      hasComment: hasC,
      status: statusFromRecord(rec),
      supervisorConfirmed: false, // 保存された確認があれば後で上書き
    };
  });
}

/** 個人（月次） */
export function getMonthRows(employeeName: string, monthBaseISO = TODAY_STR): HygieneRecordRow[] {
  const emp = nameToEmployee.get(employeeName);
  if (!emp) return [];

  const dates = dayListOfCurrentMonth(monthBaseISO);
  const officeName = branchCodeToOfficeName.get(emp.branchCode) ?? emp.branchCode;

  const rows = dates.map((iso) => {
    const rec = mockRecords.find((r) => r.employeeCode === emp.code && r.date === iso);
    if (!rec) {
      return {
        id: `${iso}-${emp.code}`,
        employeeCode: emp.code,
        employeeName: emp.name,
        officeName,
        date: iso,
        abnormalItems: [],
        hasComment: false,
        status: "未入力",
        supervisorConfirmed: false,
      } as HygieneRecordRow;
    }
    const abns = abnormalItemsForRecordId(rec.id);
    const hasC = hasCommentForRecordId(rec.id);
    return {
      id: `${iso}-${emp.code}`,
      employeeCode: emp.code,
      employeeName: emp.name,
      officeName,
      date: iso,
      abnormalItems: abns,
      hasComment: hasC,
      status: statusFromRecord(rec),
      supervisorConfirmed: false,
    } as HygieneRecordRow;
  });

  // 新しい日付が上に
  return rows.reverse();
}

/* --------------------------------
 * 責任者確認（今は localStorage。API化時はここを差し替え）
 * -------------------------------- */
const CONFIRM_STORE_KEY = "supervisorConfirmations.v1";

export async function setSupervisorConfirm(recordId: string, confirmed: boolean) {
  const raw = localStorage.getItem(CONFIRM_STORE_KEY);
  const map: Record<string, boolean> = raw ? JSON.parse(raw) : {};
  map[recordId] = confirmed;
  localStorage.setItem(CONFIRM_STORE_KEY, JSON.stringify(map));
}

export function loadSupervisorConfirm(recordId: string): boolean | undefined {
  const raw = localStorage.getItem(CONFIRM_STORE_KEY);
  if (!raw) return undefined;
  const map: Record<string, boolean> = JSON.parse(raw);
  return map[recordId];
}

export function canConfirmRow(opts: {
  role: UserRole;
  row: HygieneRecordRow;
  userOffice?: string;
}): boolean {
  const { role, row, userOffice } = opts;
  if (row.status === "未入力") return false;
  if (role === "hq_admin") return true;
  if (!userOffice) return false;
  return row.officeName === userOffice;
}

/* --------------------------------
 * フォーム画面向け（読取）
 * -------------------------------- */

// 型を使うなら（任意）
export type EmployeeRow   = (typeof mockEmployees)[number];
export type RecordRow     = (typeof mockRecords)[number];
export type RecordItemRow = (typeof mockRecordItems)[number];

/** ブランチコードで従業員一覧を取得（フォームのプルダウン用） */
export async function getEmployeesByBranch(branchCode: string): Promise<EmployeeRow[]> {
  return mockEmployees.filter(e => e.branchCode === branchCode);
}

/** 当日のレコードと明細を取得（フォームの自動反映用） */
export async function getTodayRecordWithItems(
  employeeCode: string,
  dateISO: string
): Promise<{ record: RecordRow | null; items: RecordItemRow[] }> {
  const record = mockRecords.find(r => r.employeeCode === employeeCode && r.date === dateISO) ?? null;
  const items = record ? mockRecordItems.filter(i => i.recordId === record.id) : [];
  return { record, items };
}

// --- Dashboard 用の型（ダッシュボードが今使っている形） ---
export type DashboardStaffRow = {
  id: string;
  name: string;
  arrivalRegistered: boolean;
  departureRegistered: boolean;
  temperature: number | null;
  symptoms: boolean;
  comment: string;
};

// 営業所コード→営業所名
export function getBranchNameByCode(code?: string | null): string {
  if (!code) return "営業所未設定";
  return mockBranches.find((b) => b.code === code)?.name ?? "営業所未設定";
}

// ダッシュボード1日の一覧
export async function getDashboardStaffRows(
  branchCode: string,
  dateISO: string
): Promise<DashboardStaffRow[]> {
  const emps = mockEmployees.filter((e) => e.branchCode === branchCode);

  return emps.map((emp) => {
    const rec = mockRecords.find((r) => r.employeeCode === emp.code && r.date === dateISO);
    const items = rec ? mockRecordItems.filter((i) => i.recordId === rec.id) : [];

    const temperatureRaw = items.find((i) => i.category === "temperature")?.value;
    const temperature =
      temperatureRaw !== undefined && temperatureRaw !== null
        ? Number(temperatureRaw)
        : null;

    const symptoms = items.some(
      (i) =>
        i.is_normal === false &&
        ["no_health_issues", "family_no_symptoms", "no_respiratory_symptoms"].includes(
          i.category
        )
    );

    const comment = items.find((i) => i.value && i.is_normal === false)?.value ?? "";

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
}

// 営業所PIN（またはパスワード）を取得：ダッシュボードの管理者認証で使用
export async function getBranchExpectedPin(branchCode: string): Promise<string | null> {
  const b = mockBranches.find((x) => x.code === branchCode) as
    | { managementPin?: string | number; password?: string | number }
    | undefined;

  if (!b) return null;

  // managementPin があれば優先、なければ password を使う
  const pinRaw = b.managementPin ?? b.password;
  if (pinRaw == null) return null;

  // 数値でも文字列でも受け取り、4桁ゼロパディングして返す
  const s = String(pinRaw);
  return /^\d+$/.test(s) ? s.padStart(4, "0") : s;
}

// ===== 管理画面：カテゴリ → ラベル/セクション辞書 =====
export const CATEGORY_LABELS: Record<
  string,
  { label: string; section: string }
> = {
  temperature: { label: "体温", section: "体温・体調" },

  no_health_issues: { label: "体調異常なし", section: "体温・体調" },
  family_no_symptoms: { label: "同居者の症状なし", section: "体温・体調" },

  no_respiratory_symptoms: { label: "咳・喉の腫れなし", section: "呼吸器" },

  no_severe_hand_damage: { label: "手荒れ（重度）なし", section: "手指・爪" },
  no_mild_hand_damage: { label: "手荒れ（軽度）なし", section: "手指・爪" },

  nails_groomed: { label: "爪・ひげ整っている", section: "身だしなみ" },
  proper_uniform: { label: "服装が正しい", section: "身だしなみ" },

  no_work_illness: { label: "作業中の不調なし", section: "作業後" },
  proper_handwashing: { label: "手洗い実施", section: "作業後" },
};

// ===== 管理画面：詳細取得（ラベル付きアイテム返却） =====
export async function getRecordDetail(row: HygieneRecordRow): Promise<
  HygieneRecordRow & {
    comment: string;
    items: {
      category: string;
      label: string;
      section: string;
      is_normal: boolean;
      value: string | null;
    }[];
  }
> {
  // 該当レコード
  const rec =
    mockRecords.find(
      (r) =>
        r.employeeCode === row.employeeCode && r.date === row.date
    ) ?? null;

  const itemsRaw = rec
    ? mockRecordItems.filter((i) => i.recordId === rec.id)
    : [];

  const items = itemsRaw.map((it) => {
    const meta = CATEGORY_LABELS[it.category] ?? {
      label: it.category,
      section: "",
    };
    return {
      category: it.category,
      label: meta.label,
      section: meta.section,
      is_normal: !!it.is_normal,
      value: it.value ?? null,
    };
  });

  // 異常のコメントをざっくりまとめる（必要ならAPI化時に差し替え）
  const comment =
    items
      .filter((i) => i.is_normal === false && i.value)
      .map((i) => `${i.label}: ${i.value}`)
      .join(" ／ ") || "";

  return { ...row, comment, items };
}

// ===== 従業員一覧：アダプタAPI（ローカル保存でモックを上書き） =====
export type EmployeePosition = "general" | "branch_admin" | "sub_manager" | "manager";
export type EmployeeDTO = {
  code: string;       // 個人コード（6桁）
  name: string;
  branchCode: string; // 営業所コード
  position: EmployeePosition;
};

const EMP_STORE_KEY = "employees.snapshot.v1";

// 事実上の「現在の名簿」を返す（localStorage があればそれ、なければモック）
export async function listEmployees(): Promise<EmployeeDTO[]> {
  const raw = localStorage.getItem(EMP_STORE_KEY);
  if (raw) return JSON.parse(raw) as EmployeeDTO[];
  // モックを EmployeeDTO として返す
  return mockEmployees as EmployeeDTO[];
}

async function saveEmployees(all: EmployeeDTO[]) {
  localStorage.setItem(EMP_STORE_KEY, JSON.stringify(all));
}

// 追加
export async function createEmployee(newEmp: EmployeeDTO): Promise<EmployeeDTO> {
  const all = await listEmployees();
  if (all.some((e) => e.code === newEmp.code)) {
    throw new Error("この個人コードは既に使われています");
  }
  const next = [...all, newEmp];
  await saveEmployees(next);
  return newEmp;
}

// 更新（code 変更も許可）
export async function updateEmployee(code: string, patch: Partial<EmployeeDTO>): Promise<EmployeeDTO> {
  const all = await listEmployees();
  const idx = all.findIndex((e) => e.code === code);
  if (idx < 0) throw new Error("対象の従業員が見つかりません");
  const nextCode = patch.code ?? code;
  if (nextCode !== code && all.some((e) => e.code === nextCode)) {
    throw new Error("この個人コードは既に使われています");
  }
  const updated: EmployeeDTO = { ...all[idx], ...patch, code: nextCode };
  const next = [...all];
  next[idx] = updated;
  await saveEmployees(next);
  return updated;
}

// 削除
export async function deleteEmployee(code: string): Promise<void> {
  const all = await listEmployees();
  const next = all.filter((e) => e.code !== code);
  await saveEmployees(next);
}

// 営業所名 → 営業所コード
export function getBranchCodeByOfficeName(name: string): string | null {
  const b = mockBranches.find((x) => x.name === name);
  return b ? b.code : null;
}
