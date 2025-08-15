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
