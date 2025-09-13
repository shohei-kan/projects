// src/lib/hygieneAdapter.ts
import { TODAY_STR } from "@/data/mockDate";
import { mockBranches, mockEmployees, mockRecords, mockRecordItems } from "@/data";
import { format } from "date-fns";

// --- debug: build-time env を確認（あとで消してOK） ---
if (typeof window !== "undefined") {
  (window as any).__ENV__ = {
    VITE_USE_API: import.meta.env.VITE_USE_API,
    VITE_API_BASE: import.meta.env.VITE_API_BASE,
  };
  console.info("[env]", (window as any).__ENV__);
}

/* =========================
 * 共通: APIユーティリティ
 * ========================= */
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
// 1=APIを使う / 0=ローカル(LS)・モックを使う
const USE_API = (import.meta.env.VITE_USE_API ?? "1") === "1";

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    // 認証を入れる予定があるなら "include" に切替（今は不要なら削ってOK）
    // credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${path} GET failed (${res.status}): ${body || res.statusText}`);
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`${path} returned non-JSON response`);
  }
}

/* =========================
 * LocalStorage スナップショット
 * ========================= */
const LS_RECORDS_KEY = "records.snapshot.v1";
const LS_ITEMS_KEY = "recordItems.snapshot.v1";

type LSStatus = "未入力" | "出勤入力済" | "退勤入力済";
type LSRecord = {
  id: string; // `${date}-${employeeCode}`
  employeeCode: string;
  date: string; // YYYY-MM-DD
  work_start_time?: string;
  work_end_time?: string;
  status: LSStatus;
  temperature?: number;
  comment?: string;
};
type LSItem = {
  recordId: string; // LSRecord.id
  category: string;
  is_normal: boolean;
  value?: string;
};

function loadLS<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

/* =========================
 * 画面表示用の型
 * ========================= */
export type StatusJP = "出勤入力済" | "退勤入力済" | "未入力";

export type HygieneRecordRow = {
  /** 1日×従業員で一意（ `${date}-${employeeCode}` ） */
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
 * オフィス名⇔コード、従業員検索のマップ（モック名簿基準）
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

const dayListOfCurrentMonth = (refISO: string) => {
  const ref = new Date(refISO);
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const list: string[] = [];
  for (let d = 1; d <= last; d++) list.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  return list;
};

// これに差し替え
const statusFromRecord = (
  rec: { work_start_time?: string | null; work_end_time?: string | null } | null | undefined
): StatusJP => {
  if (!rec) return "未入力";
  if (rec.work_end_time != null && rec.work_end_time !== "") return "退勤入力済";
  if (rec.work_start_time != null && rec.work_start_time !== "") return "出勤入力済";
  return "未入力";
};

/* --------------------------------
 * 表データ（ローカル優先で構築）
 * -------------------------------- */

/** 日次（営業所内の全従業員） */
export function getDailyRows(officeName: string, dateISO: string): HygieneRecordRow[] {
  const codes = officeNameToCodes.get(officeName) ?? [];
  const emps = mockEmployees.filter((e) => codes.includes(e.branchCode));

  // LSを読んで当日分をマップ化
  const lsRecs = loadLS<LSRecord[]>(LS_RECORDS_KEY, []).filter((r) => r.date === dateISO);
  const lsItems = loadLS<LSItem[]>(LS_ITEMS_KEY, []);
  const lsByEmp = new Map(lsRecs.map((r) => [r.employeeCode, r]));

  return emps.map((e) => {
    const ls = lsByEmp.get(e.code);
    if (ls) {
      const its = lsItems.filter((i) => i.recordId === ls.id);
      const abnormal = its.filter((i) => i.is_normal === false).map((i) => i.category);
      const hasC = its.some((i) => i.is_normal === false && (i.value ?? "").trim().length > 0);
      return {
        id: ls.id,
        employeeCode: e.code,
        employeeName: e.name,
        officeName: branchCodeToOfficeName.get(e.branchCode) ?? e.branchCode,
        date: dateISO,
        abnormalItems: abnormal,
        hasComment: hasC,
        status: statusFromRecord(ls),
        supervisorConfirmed: loadSupervisorConfirm(ls.id) ?? false,
      };
    }

    // LSが無いときはモックで埋める（後方互換）
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
    const abns = mockRecordItems
      .filter((it) => it.recordId === rec.id && it.is_normal === false)
      .map((it) => it.category);
    const hasC = mockRecordItems.some(
      (it) => it.recordId === rec.id && it.is_normal === false && it.value && String(it.value).trim().length > 0
    );
    return {
      id: `${dateISO}-${e.code}`,
      employeeCode: e.code,
      employeeName: e.name,
      officeName: branchCodeToOfficeName.get(e.branchCode) ?? e.branchCode,
      date: dateISO,
      abnormalItems: abns,
      hasComment: hasC,
      status: statusFromRecord(rec),
      supervisorConfirmed: false,
    };
  });
}

/** 個人（月次） */
export function getMonthRows(employeeName: string, monthBaseISO = TODAY_STR): HygieneRecordRow[] {
  const emp = nameToEmployee.get(employeeName);
  if (!emp) return [];

  const dates = dayListOfCurrentMonth(monthBaseISO);
  const officeName = branchCodeToOfficeName.get(emp.branchCode) ?? emp.branchCode;

  const lsRecs = loadLS<LSRecord[]>(LS_RECORDS_KEY, []);
  const lsItems = loadLS<LSItem[]>(LS_ITEMS_KEY, []);

  const rows = dates.map((iso) => {
    const ls = lsRecs.find((r) => r.employeeCode === emp.code && r.date === iso);
    if (ls) {
      const its = lsItems.filter((i) => i.recordId === ls.id);
      const abnormal = its.filter((i) => i.is_normal === false).map((i) => i.category);
      const hasC = its.some((i) => i.is_normal === false && (i.value ?? "").trim().length > 0);
      return {
        id: ls.id,
        employeeCode: emp.code,
        employeeName: emp.name,
        officeName,
        date: iso,
        abnormalItems: abnormal,
        hasComment: hasC,
        status: statusFromRecord(ls),
        supervisorConfirmed: loadSupervisorConfirm(ls.id) ?? false,
      } as HygieneRecordRow;
    }

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
    const abns = mockRecordItems
      .filter((it) => it.recordId === rec.id && it.is_normal === false)
      .map((it) => it.category);
    const hasC = mockRecordItems.some(
      (it) => it.recordId === rec.id && it.is_normal === false && it.value && String(it.value).trim().length > 0
    );
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
 * 責任者確認（localStorage）
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

// 追加：責任者が確認ボタンを押せるかの判定
export function canConfirmRow(opts: {
  role: UserRole;
  row: HygieneRecordRow;
  userOffice?: string | null;
}): boolean {
  const { role, row, userOffice } = opts;
  if (row.status === "未入力") return false;      // 未入力は確認不可
  if (role === "hq_admin") return true;           // 本部は全件OK
  if (!userOffice) return false;                  // 営業所が不明なら不可
  return row.officeName === userOffice;           // 同一営業所のみOK
}

/* --------------------------------
 * フォーム画面向け（読取）
 * -------------------------------- */
// 既存のモック型に合わせたエイリアス（型目的のみ）
export type EmployeeRow = (typeof mockEmployees)[number];
export type RecordRow = (typeof mockRecords)[number];
export type RecordItemRow = (typeof mockRecordItems)[number];

/** ブランチコードで従業員一覧を取得（フォームのプルダウン用） */
export async function getEmployeesByBranch(branchCode: string): Promise<EmployeeRow[]> {
  const useApi = (import.meta.env.VITE_USE_API ?? "1") === "1";

  // 正規化ヘルパ
  const normalizeCode = (s: string | undefined | null) =>
    (s ?? "").trim().replace(/[\u3000\s-]/g, "").toUpperCase();
  const normalizeName = (s: string | undefined | null) =>
    (s ?? "").trim().replace(/[\u3000\s]/g, ""); // 日本語名は大文字化しない

  const bc = normalizeCode(branchCode);

  // スナップショット/モックを読む
  const readSnapshot = (): EmployeeRow[] => {
    const raw = localStorage.getItem("employees.snapshot.v1");
    return raw ? (JSON.parse(raw) as EmployeeRow[]) : (mockEmployees as EmployeeRow[]);
  };

  // ===== APIを使わない（推奨の開発モード） =====
  if (!useApi) {
    const src = readSnapshot();

    // 1) ブランチコード一致（正規化比較）
    let list = src.filter((e: any) => normalizeCode((e as any).branchCode) === bc);

    // 2) 0件なら、引数が「営業所名」だった可能性を考慮（完全一致/空白無視）
    if (list.length === 0) {
      const byName = mockBranches.find(
        (b) =>
          normalizeName(b.name) === normalizeName(branchCode) ||
          normalizeName(b.code) === normalizeName(branchCode)
      );
      if (byName) {
        const code = byName.code;
        list = src.filter((e: any) => normalizeCode((e as any).branchCode) === normalizeCode(code));
      }
    }

    // 3) まだ0件なら、本当に該当なし → 混入防止のため **空配列** を返す
    if (list.length === 0) {
      console.warn(
        "[employees] 該当ブランチなし:",
        branchCode,
        "（sessionのbranchCodeがモックと不一致の可能性）"
      );
    }
    return list as EmployeeRow[];
  }

  // ===== APIモード：失敗/0件なら「厳格に空配列返す」（混入防止） =====
  try {
    const apiEmps = await apiGet<
      Array<{ id: number; code: string; name: string; office: number; office_name: string }>
    >(`/api/employees?branch_code=${encodeURIComponent(branchCode)}`);

    if (apiEmps.length > 0) {
      return apiEmps.map(
        (e) => ({ id: e.id, code: e.code, name: e.name, branchCode }) as unknown as EmployeeRow
      );
    }
    console.warn("[employees] API 0件:", branchCode);
    return [];
  } catch (e) {
    console.warn("[employees] API失敗:", e);
    return [];
  }
}

/** 当日のレコードと明細を取得（フォームの自動反映用） */
export async function getTodayRecordWithItems(
  employeeCode: string,
  dateISO: string
): Promise<{ record: RecordRow | null; items: RecordItemRow[]; supervisorCode?: string | null }> {
  if (!USE_API) {
    const id = `${dateISO}-${employeeCode}`;
    const recs = loadLS<LSRecord[]>(LS_RECORDS_KEY, []);
    const items = loadLS<LSItem[]>(LS_ITEMS_KEY, []);
    const r = recs.find((x) => x.id === id) ?? null;
    const its = items.filter((i) => i.recordId === id);

    if (r) {
      const record = {
        id: 0, // ダミー
        employeeCode: r.employeeCode,
        date: r.date,
        work_start_time: r.work_start_time ?? null,
        work_end_time: r.work_end_time ?? null,
      } as unknown as RecordRow;

      const rows = its.map(
        (it, idx) =>
          ({
            id: idx,
            recordId: 0, // 使わない
            category: it.category,
            is_normal: it.is_normal,
            value: it.value ?? null,
            comment: it.value ?? null,
          }) as unknown as RecordItemRow
      );

      // モック時は supervisor を保持していないので null を返す
      return { record, items: rows, supervisorCode: null };
    }

    // モックのフォールバック
    const rec = mockRecords.find((x) => x.employeeCode === employeeCode && x.date === dateISO) ?? null;
    const its2 = rec ? mockRecordItems.filter((i) => i.recordId === rec.id) : [];
    return { record: rec as unknown as RecordRow, items: its2 as unknown as RecordItemRow[], supervisorCode: null };
  }

  // ===== API モード =====
  type ApiItem = { id: number; category: string; is_normal: boolean; value: number | string | null; comment: string };
  type ApiRecord = {
    id: number;
    date: string;
    employee: number;
    work_start_time: string | null;
    work_end_time: string | null;
    items: ApiItem[];
    supervisor_code?: string | null;   // ★ サーバが返す
  };

  const list = await apiGet<ApiRecord[]>(
    `/api/records/?employee_code=${encodeURIComponent(employeeCode)}&date=${encodeURIComponent(dateISO)}`
  );
  const rec = list[0] ?? null;

  const record = rec
    ? ({
        id: rec.id,
        employeeCode,
        date: rec.date,
        work_start_time: rec.work_start_time,
        work_end_time: rec.work_end_time,
      } as unknown as RecordRow)
    : null;

  const items = rec
    ? (rec.items.map(
        (it) =>
          ({
            id: it.id,
            recordId: rec.id,
            category: it.category,
            is_normal: it.is_normal,
            value: it.value as any,
            comment: it.comment,
          }) as unknown as RecordItemRow
      ) as unknown as RecordItemRow[])
    : [];

  // ★ ここで supervisorCode を返す（文字列 or null）
  return { record, items, supervisorCode: rec?.supervisor_code ?? null };
}

/* --------------------------------
 * Dashboard 用
 * -------------------------------- */
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
export async function getDashboardStaffRows(branchCode: string, dateISO: string): Promise<DashboardStaffRow[]> {
  if (!USE_API) {
    const emps = mockEmployees.filter((e) => e.branchCode === branchCode);

    const recs = loadLS<LSRecord[]>(LS_RECORDS_KEY, []).filter((r) => r.date === dateISO);
    const items = loadLS<LSItem[]>(LS_ITEMS_KEY, []);

    const byEmp = new Map(recs.map((r) => [r.employeeCode, r]));
    return emps.map((emp) => {
      // ① LSにあればそれを優先
      const lr = byEmp.get(emp.code);
      if (lr) {
        const its = items.filter((i) => i.recordId === lr.id);
        const temperatureRaw = its.find((i) => i.category === "temperature")?.value;
        const temperature =
          temperatureRaw !== undefined && temperatureRaw !== null && temperatureRaw !== ""
            ? Number(temperatureRaw)
            : null;
        const symptoms = its.some(
          (i) =>
            i.is_normal === false &&
            ["no_health_issues", "family_no_symptoms", "no_respiratory_symptoms"].includes(i.category)
        );
        const comment = its.find((i) => i.is_normal === false && (i.value ?? "").trim().length > 0)?.value ?? "";

        return {
          id: emp.code,
          name: emp.name,
          arrivalRegistered: !!lr.work_start_time,
          departureRegistered: !!lr.work_end_time,
          temperature,
          symptoms,
          comment,
        };
      }

      // ② 無ければモックにフォールバック
      const rec = mockRecords.find((r) => r.employeeCode === emp.code && r.date === dateISO);
      const its2 = rec ? mockRecordItems.filter((i) => i.recordId === rec.id) : [];
      const temperatureRaw = its2.find((i) => i.category === "temperature")?.value;
      const temperature =
        temperatureRaw !== undefined && temperatureRaw !== null ? Number(temperatureRaw) : null;
      const symptoms = its2.some(
        (i) =>
          i.is_normal === false &&
          ["no_health_issues", "family_no_symptoms", "no_respiratory_symptoms"].includes(i.category)
      );
      const comment = its2.find((i) => i.value && i.is_normal === false)?.value ?? "";

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

  // API: /api/dashboard?branch_code=...&date=...
  type ApiRow = {
    id: string;
    name: string;
    arrivalRegistered: boolean;
    departureRegistered: boolean;
    temperature: number | null;
    symptoms: boolean;
    comment: string;
  };
  const data = await apiGet<{ rows: ApiRow[] }>(
    `/api/dashboard?branch_code=${encodeURIComponent(branchCode)}&date=${encodeURIComponent(dateISO)}`
  );
  return data.rows;
}

/* --------------------------------
 * 管理画面：詳細取得（ラベル付き）
 * -------------------------------- */
export const CATEGORY_LABELS: Record<string, { label: string; section: string }> = {
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
  // まずLSで探す
  const itemsLS = loadLS<LSItem[]>(LS_ITEMS_KEY, []).filter((i) => i.recordId === row.id);
  if (itemsLS.length > 0) {
    const items = itemsLS.map((it) => {
      const meta = CATEGORY_LABELS[it.category] ?? { label: it.category, section: "" };
      return {
        category: it.category,
        label: meta.label,
        section: meta.section,
        is_normal: !!it.is_normal,
        value: it.value ?? null,
      };
    });
    const comment =
      items.filter((i) => i.is_normal === false && i.value).map((i) => `${i.label}: ${i.value}`).join(" ／ ") || "";
    return { ...row, comment, items };
  }

  // フォールバック：モック
  const rec = mockRecords.find((r) => `${r.date}-${r.employeeCode}` === row.id) ?? null;
  const itemsRaw = rec ? mockRecordItems.filter((i) => i.recordId === rec.id) : [];
  const items = itemsRaw.map((it) => {
    const meta = CATEGORY_LABELS[it.category] ?? { label: it.category, section: "" };
    return {
      category: it.category,
      label: meta.label,
      section: meta.section,
      is_normal: !!it.is_normal,
      value: (it as any).value ?? null,
    };
  });
  const comment =
    items.filter((i) => i.is_normal === false && i.value).map((i) => `${i.label}: ${i.value}`).join(" ／ ") || "";
  return { ...row, comment, items };
}

/* --------------------------------
 * 従業員一覧：アダプタAPI（ローカル保存でモックを上書き）
 * -------------------------------- */
export type EmployeePosition = "general" | "branch_admin" | "sub_manager" | "manager";
export type EmployeeDTO = {
  code: string; // 個人コード（6桁）
  name: string;
  branchCode: string; // 営業所コード
  position: EmployeePosition;
};

const EMP_STORE_KEY = "employees.snapshot.v1";

// 事実上の「現在の名簿」を返す（localStorage があればそれ、なければモック）
export async function listEmployees(): Promise<EmployeeDTO[]> {
  const raw = localStorage.getItem(EMP_STORE_KEY);
  if (raw) return JSON.parse(raw) as EmployeeDTO[];
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

/* --------------------------------
 * 既存 submit（API用）。ローカル時は saveDailyCheck を使う想定
 * -------------------------------- */
type WriteItem = {
  category: string;
  is_normal: boolean;
  value?: string | number | null;
  comment?: string | null;
};

export async function submitDailyForm(params: {
  employeeCode: string;
  dateISO: string;
  workStartTime?: string | null;
  workEndTime?: string | null;
  items: { category: string; is_normal: boolean; value?: string | number | null; comment?: string | null }[];
  supervisorCode?: string | null; // ★追加
}): Promise<void> {
  if (USE_API) {
    const payload = {
      employee_code: params.employeeCode,
      date: params.dateISO,
      work_start_time: params.workStartTime ?? null,
      work_end_time: params.workEndTime ?? null,
      supervisor_code: params.supervisorCode ?? null,
      items: params.items.map((it) => ({
        category: it.category,
        is_normal: !!it.is_normal,
        value: it.value == null ? null : String(it.value),
        comment: it.comment ?? null,
      })),
    };
    const r = await fetch(`${API_BASE}/api/records/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`submit failed: ${r.status} ${t}`);
    }
    return;
  }

  // モック/ローカル時は saveDailyCheck を使う想定なので何もしない
  console.warn("USE_API=0 のため、submitDailyForm は無効（saveDailyCheck を利用してください）");
}

/* --------------------------------
 * 営業所PIN：ダッシュボードの管理者認証で使用
 * -------------------------------- */
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

/* --------------------------------
 * カレンダー（フォームの丸表示用）
 * -------------------------------- */
type CalendarStatusResponse = { dates: string[] };

export async function getCalendarStatus(employeeCode: string, month: string): Promise<Set<string>> {
  const url = `/api/records/calendar_status/?employee_code=${encodeURIComponent(employeeCode)}&month=${encodeURIComponent(month)}`;
  try {
    const { dates } = await apiGet<CalendarStatusResponse>(url);
    return new Set(Array.isArray(dates) ? dates : []);
  } catch (e) {
    console.warn("[calendar] calendar_status fetch failed:", e);
    return new Set();
  }
}

// 互換ラッパ：配列で欲しい場合
export async function getCalendarMarks(employeeCode: string, ym: string): Promise<string[]> {
  if (!USE_API) {
    // モック: 当月の1,3,5日に丸
    const d = new Date(ym + "-01");
    return [1, 3, 5].map((n) => format(new Date(d.getFullYear(), d.getMonth(), n), "yyyy-MM-dd"));
  }
  const set = await getCalendarStatus(employeeCode, ym);
  return Array.from(set).sort();
}
