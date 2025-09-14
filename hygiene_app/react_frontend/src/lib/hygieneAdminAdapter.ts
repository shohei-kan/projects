// src/lib/hygieneAdminAdapter.ts

/** ================= 共通ヘルパ ================= */
const toStr = (v: any) => (v == null ? "" : String(v));
const pickList = (res: any) => {
  if (Array.isArray(res)) return res;
  const cand =
    res?.results ?? res?.data ?? res?.items ?? res?.rows ?? res?.employees ?? res?.records;
  return Array.isArray(cand) ? cand : [];
};
const norm = (s: string) =>
  toStr(s).replace(/\u3000/g, "").replace(/\s+/g, "").toLowerCase();
const normCode = (s: string) =>
  toStr(s).replace(/[\s\-_.]/g, "").toUpperCase();

/** ================= 環境設定 ================= */
export const API_ROOT = String(import.meta.env.VITE_API_BASE ?? "/api").replace(/\/+$/, "");
const CREDENTIALS: RequestCredentials =
  import.meta.env.VITE_USE_CREDENTIALS === "1" ? "include" : "omit";
const join = (path: string) => `${API_ROOT}${path.startsWith("/") ? path : `/${path}`}`;

async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(join(path), { credentials: CREDENTIALS });
  if (!r.ok) throw new Error(`${path} GET ${r.status}`);
  return r.json() as Promise<T>;
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(join(path), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: CREDENTIALS,
  });
  if (!r.ok) throw new Error(`${path} PATCH ${r.status}`);
  return r.json() as Promise<T>;
}

/** ================= 型 ================= */
export type HygieneRecordRow = {
  id: string;
  officeName: string;
  employeeName: string;
  date: string; // "YYYY-MM-DD"
  status: "出勤入力済" | "退勤入力済" | "未入力";
  supervisorConfirmed: boolean;
  abnormalItems: string[];
  hasAnyComment: boolean;
};

// 内部用：正規化後にコード/IDも保持（UIには出さない）
type NormalizedRow = HygieneRecordRow & { _officeCode?: string; _officeId?: string };

type OfficeDTO = {
  id?: number | string;
  code?: string;
  office_code?: string;
  name?: string;
  office_name?: string;
  title?: string;
};

/** ================= Office キャッシュ ================= */
let OFFICE_CACHE:
  | {
      nameByCode: Map<string, string>;
      codeByName: Map<string, string>;
      nameById: Map<string, string>;
      idByName: Map<string, string>;
    }
  | null = null;

async function ensureOfficeCache() {
  if (OFFICE_CACHE) return OFFICE_CACHE;
  try {
    const rows = await getOffices().catch(() => []);
    const nameByCode = new Map<string, string>();
    const codeByName = new Map<string, string>();
    const nameById   = new Map<string, string>();
    const idByName   = new Map<string, string>();

    for (const o of rows) {
      const code = toStr((o as any).code ?? (o as any).office_code ?? "");
      const id   = toStr((o as any).id ?? (o as any).office_id ?? (o as any).pk ?? "");
      const nameCandidate =
        (o as any).name ?? (o as any).title ?? (o as any).office_name ?? "";
      const name = toStr(nameCandidate || code || id);

      if (code) nameByCode.set(normCode(code), name);
      if (name && code) codeByName.set(norm(name), code);

      if (id)   nameById.set(id, name);
      if (name && id)   idByName.set(norm(name), id);
    }
    OFFICE_CACHE = { nameByCode, codeByName, nameById, idByName };
  } catch {
    OFFICE_CACHE = {
      nameByCode: new Map(),
      codeByName: new Map(),
      nameById:   new Map(),
      idByName:   new Map(),
    };
  }
  return OFFICE_CACHE!;
}

function officeEqByName(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (norm(a) === norm(b)) return true;
  if (!OFFICE_CACHE) return false;
  // 名前→コード照合
  const aCode = OFFICE_CACHE.codeByName.get(norm(a)) ?? a;
  const bCode = OFFICE_CACHE.codeByName.get(norm(b)) ?? b;
  if (normCode(aCode) === normCode(bCode)) return true;
  // コード→名前照合
  const aName = OFFICE_CACHE.nameByCode.get(normCode(a)) ?? a;
  const bName = OFFICE_CACHE.nameByCode.get(normCode(b)) ?? b;
  return norm(aName) === norm(bName);
}

/** ================= 正規化 ================= */
function normalizeRow(x: any): NormalizedRow {
  const id =
    x?.id ?? x?.record_id ?? x?.uuid ?? x?.pk ??
    `${toStr(x?.employee_name ?? x?.employee ?? "")}-${toStr(x?.date ?? x?.record_date ?? "")}`;

  const officeCodeRaw =
    x?.office_code ?? x?.branch_code ?? x?.office?.code ?? x?.branch?.code;
  const officeIdRaw =
    x?.office_id ?? x?.branch_id ?? x?.office?.id ?? x?.branch?.id;

  const officeCode = officeCodeRaw != null ? toStr(officeCodeRaw) : "";
  const officeId   = officeIdRaw   != null ? toStr(officeIdRaw)   : "";

  // 名称が無ければ code → id の順で補完（キャッシュ利用）
  let officeName =
    x?.officeName ??
    x?.office_name ??
    x?.office ??
    x?.branch_name ??
    x?.branch ??
    x?.office?.name ??
    "";

  if (!officeName) {
    const byCode = officeCode ? OFFICE_CACHE?.nameByCode.get(normCode(officeCode)) : undefined;
    const byId   = officeId   ? OFFICE_CACHE?.nameById.get(officeId)               : undefined;
    officeName = (byCode ?? byId ?? "") || officeCode || officeId || "";
  }

  const employeeName =
    x?.employeeName ?? x?.employee_name ?? x?.employee ?? x?.user_name ?? x?.employee?.name ?? "";

  const date = toStr(x?.date ?? x?.record_date ?? x?.ymd ?? "").slice(0, 10);

  const supervisorConfirmed = Boolean(
    x?.supervisorConfirmed ?? x?.supervisor_confirmed ?? x?.confirmed ?? false
  );

  const abnormalSrc =
    x?.abnormalItems ?? x?.abnormal_items ?? x?.abnormal_labels ?? x?.abnormal ?? [];
  const abnormalItems: string[] = Array.isArray(abnormalSrc)
    ? abnormalSrc.map((s: any) => toStr(s)).filter(Boolean)
    : [];

  let status: HygieneRecordRow["status"] = (x?.status_jp ?? x?.status) as any;
  if (!status) {
    if (x?.clock_out || x?.checked_out || x?.work_end_time) status = "退勤入力済";
    else if (x?.clock_in || x?.checked_in || x?.work_start_time) status = "出勤入力済";
    else status = "未入力";
  }

  const hasAnyComment = Boolean(
    x?.hasAnyComment ?? x?.has_comment ?? x?.has_any_comment ?? (x?.comment_count ?? 0) > 0
  );

  return {
    id: toStr(id),
    officeName: toStr(officeName),
    employeeName: toStr(employeeName),
    date,
    status,
    supervisorConfirmed,
    abnormalItems,
    hasAnyComment,
    _officeCode: officeCode ? normCode(officeCode) : undefined,
    _officeId: officeId || undefined,
  };
}

/** ================= Offices ================= */
export async function getOffices(): Promise<OfficeDTO[]> {
  const res = await apiGet<any>("/offices/");
  return pickList(res);
}

export async function getOfficeNames(): Promise<string[]> {
  const rows = await getOffices();
  return rows
    .map(
      (o) =>
        toStr(
          (o as any).name ??
            (o as any).title ??
            (o as any).office_name ??
            (o as any).code ??
            (o as any).office_code
        )
    )
    .filter(Boolean);
}

export async function getBranchNameByCode(code: string): Promise<string> {
  if (!code) return "";
  await ensureOfficeCache();
  return OFFICE_CACHE!.nameByCode.get(normCode(code)) ?? code;
}

/** ================= Employees ================= */
export async function getEmployeesByOffice(officeKey: string): Promise<string[]> {
  await ensureOfficeCache();

  const wantCode = OFFICE_CACHE!.codeByName.get(norm(officeKey)) || "";
  const wantId   = OFFICE_CACHE!.idByName.get(norm(officeKey))   || "";

  const qName = encodeURIComponent(officeKey);
  const qCode = wantCode ? encodeURIComponent(wantCode) : null;

  const paths = [
    qCode && `/employees/?office_code=${qCode}`,
    `/employees/?office_name=${qName}`,
    `/employees/?office=${qName}`,
    `/employees/?branch_name=${qName}`,
    `/employees/?branch=${qName}`,
  ].filter(Boolean) as string[];

  for (const p of paths) {
    try {
      const res  = await apiGet<any>(p);
      const list = pickList(res);
      if (!list?.length) continue;

      // 後段フィルタ：所属で厳密絞り込み
      const filtered = list.filter((e: any) => {
        const name = toStr(e?.office_name ?? e?.branch_name ?? e?.office?.name ?? "");
        const code = toStr(e?.office_code ?? e?.branch_code ?? e?.office?.code ?? "");
        const id   = toStr(e?.office_id   ?? e?.branch_id   ?? e?.office?.id   ?? "");

        if (wantCode && normCode(code) === normCode(wantCode)) return true;
        if (wantId   && id && String(id) === String(wantId))   return true;
        return officeEqByName(name || code || id, officeKey);
      });

      const names = filtered
        .map((e: any) => e?.name ?? e?.full_name ?? e?.display_name ?? e?.employee_name)
        .map(toStr)
        .filter(Boolean);

      if (names.length) return names;
    } catch {
      /* 次へ */
    }
  }
  return [];
}

/** ================= Records（日次） ================= */
export async function getDailyRows(officeName: string, ymd: string): Promise<HygieneRecordRow[]> {
  await ensureOfficeCache();

  const wantCodeRaw = OFFICE_CACHE!.codeByName.get(norm(officeName)) ?? "";
  const WANT = { code: normCode(wantCodeRaw), name: officeName };

  const qsOfficeName = encodeURIComponent(officeName);
  const qsOfficeCode = WANT.code ? encodeURIComponent(wantCodeRaw) : null;
  const qsDate = encodeURIComponent(ymd);

  const paths = [
    qsOfficeCode && `/records/?office_code=${qsOfficeCode}&date=${qsDate}`,
    `/records/?office_name=${qsOfficeName}&date=${qsDate}`,
    `/records/?office=${qsOfficeName}&date=${qsDate}`,
    `/records/?branch_name=${qsOfficeName}&date=${qsDate}`,
    `/records/?branch=${qsOfficeName}&date=${qsDate}`,
  ].filter(Boolean) as string[];

  const postFilter = (rows: NormalizedRow[]) => {
    if (WANT.code) {
      const byCode = rows.filter((r) => r._officeCode && r._officeCode === WANT.code);
      if (byCode.length) return byCode;
    }
    return rows.filter((r) => officeEqByName(r.officeName, WANT.name));
  };

  for (const p of paths) {
    try {
      const res = await apiGet<any>(p);
      const list = pickList(res).map(normalizeRow);
      const filtered = postFilter(list);
      if (filtered.length) return filtered;
    } catch {
      /* 次へ */
    }
  }

  // 最後の手段：日付のみ → フロントで絞り込み
  try {
    const res = await apiGet<any>(`/records/?date=${qsDate}`);
    const list = pickList(res).map(normalizeRow);
    return postFilter(list);
  } catch {
    return [];
  }
}

/** ================= Records（月次） ================= */
export async function getMonthRows(employeeName: string, ym: string): Promise<HygieneRecordRow[]> {
  await ensureOfficeCache();

  const qsEmp = encodeURIComponent(employeeName);
  const qsYm = encodeURIComponent(ym);

  const paths = [
    `/records/?employee_name=${qsEmp}&month=${qsYm}`,
    `/records/?employee=${qsEmp}&month=${qsYm}`,
    `/records/?user_name=${qsEmp}&month=${qsYm}`,
  ];

  for (const p of paths) {
    try {
      const res = await apiGet<any>(p);
      const list = pickList(res).map(normalizeRow);
      const filtered = list.filter((r) => norm(r.employeeName) === norm(employeeName));
      if (filtered.length) return filtered;
    } catch {
      /* 次へ */
    }
  }

  // 月のみ取得 → 名寄せフィルタ
  try {
    const res = await apiGet<any>(`/records/?month=${qsYm}`);
    const list = pickList(res).map(normalizeRow);
    return list.filter((r) => norm(r.employeeName) === norm(employeeName));
  } catch {
    return [];
  }
}

/** ================= 詳細 ================= */
export async function getRecordDetail(id: string) {
  try {
    return await apiGet<any>(`/records/${id}/detail/`);
  } catch {
    return await apiGet<any>(`/records/${id}/`);
  }
}

/** ================= 責任者確認 ================= */
export async function patchSupervisorConfirm(recordId: string, confirmed: boolean) {
  try {
    return await apiPatch<any>(`/confirmations/${recordId}/`, { supervisor_confirmed: confirmed });
  } catch {
    return await apiPatch<any>(`/records/${recordId}/supervisor_confirm/`, { supervisor_confirmed: confirmed });
  }
}

/** ================= 権限制御（簡易） ================= */
export function canConfirmRow(opts: {
  role: "hq_admin" | "branch_manager";
  row: HygieneRecordRow;
  userOffice?: string;
}): boolean {
  if (opts.role === "hq_admin") return true;
  if (!opts.userOffice) return false;
  // 名前ゆらぎを吸収して比較
  return officeEqByName(opts.row.officeName, opts.userOffice);
}

/** ================= 行フィルタ（営業所で厳密に絞る） ================= */
export async function filterRowsByOffice(
  rows: HygieneRecordRow[],
  officeName: string
): Promise<HygieneRecordRow[]> {
  await ensureOfficeCache();
  const n  = (s: string) => String(s).replace(/\u3000/g, "").replace(/\s+/g, "").toLowerCase();
  const uc = (s: string) => String(s).replace(/[\s\-_.]/g, "").toUpperCase();

  const wantCode = OFFICE_CACHE!.codeByName.get(n(officeName)) || "";
  const wantId   = OFFICE_CACHE!.idByName.get(n(officeName))   || "";

  const src = rows as any[];

  if (wantCode) {
    const byCode = src.filter((r) => uc(r._officeCode || "") === uc(wantCode));
    if (byCode.length) return byCode as HygieneRecordRow[];
  }
  if (wantId) {
    const byId = src.filter((r) => String(r._officeId || "") === String(wantId));
    if (byId.length) return byId as HygieneRecordRow[];
  }

  // 最後の砦：名称（ゆらぎ吸収）
  return src.filter((r) => officeEqByName(r.officeName, officeName)) as HygieneRecordRow[];
}
