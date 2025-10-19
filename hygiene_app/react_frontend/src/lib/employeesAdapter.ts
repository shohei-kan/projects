// src/lib/employeesAdapter.ts
/** ================= 共通 ================= */
const API_ROOT = String(import.meta.env.VITE_API_BASE ?? "/api").replace(/\/+$/, "");
const CREDENTIALS: RequestCredentials =
  import.meta.env.VITE_USE_CREDENTIALS === "1" ? "include" : "omit";
const url = (p: string) => `${API_ROOT}${p.startsWith("/") ? p : `/${p}`}`;

/** ---- fetch ラッパ（エラー詳細を拾う） ---- */
async function parseErr(r: Response) {
  try { return await r.json(); } catch { return null as unknown as any; }
}
async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(url(path), { credentials: CREDENTIALS });
  if (!r.ok) {
    const j = await parseErr(r);
    throw new Error(`${path} GET ${r.status}${j?.detail ? ` – ${j.detail}` : ""}`);
  }
  return r.json() as Promise<T>;
}
async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(url(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: CREDENTIALS,
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const j = await parseErr(r);
    throw new Error(`${path} POST ${r.status}${j?.detail ? ` – ${j.detail}` : ""}`);
  }
  try { return await r.json() as T; } catch { return undefined as unknown as T; }
}
async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(url(path), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: CREDENTIALS,
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const j = await parseErr(r);
    throw new Error(`${path} PATCH ${r.status}${j?.detail ? ` – ${j.detail}` : ""}`);
  }
  try { return await r.json() as T; } catch { return undefined as unknown as T; }
}
async function apiDelete(path: string): Promise<void> {
  const r = await fetch(url(path), { method: "DELETE", credentials: CREDENTIALS });
  if (!r.ok) {
    const j = await parseErr(r);
    throw new Error(`${path} DELETE ${r.status}${j?.detail ? ` – ${j.detail}` : ""}`);
  }
}

/** ================= 型 ================= */
export type OfficeDTO = { id: string | number; code?: string | null; name: string };

export type PositionCode = "general" | "deputy_manager" | "branch_admin" | "manager"; // ★ backend に合わせる
export type PositionJP = "一般" | "副所長" | "所長" | "本部";

export type EmployeeDTO = {
  id: string | number;
  code: string;                // 個人コード(6桁)
  name: string;                // 氏名
  office?: string | number | null; // FK id（読みは返る）
  office_name?: string | null;     // 便利フィールド（読み）
  position?: PositionCode | null;  // コード
};

export type EmployeeRow = {
  id: string;
  name: string;
  personalCode: string;
  office: string;          // 営業所「名」
  position: PositionJP;    // 日本語
};

const posToJP = (p?: PositionCode | null): PositionJP => {
  switch (p) {
    case "branch_admin":   return "所長";
    case "deputy_manager": return "副所長";
    case "manager":        return "本部";
    default:               return "一般";
  }
};
const jpToPos = (p?: PositionJP | string | null): PositionCode => {
  switch (String(p ?? "").trim()) {
    case "所長":   return "branch_admin";
    case "副所長": return "deputy_manager";
    case "本部":   return "manager";
    case "一般":
    default:       return "general";
  }
};
const toStr = (v: any) => (v == null ? "" : String(v));

/** ================= Offices ================= */
export async function getOffices(): Promise<OfficeDTO[]> {
  const res = await apiGet<any>("/offices/");
  const list = Array.isArray(res)
    ? res
    : Array.isArray(res?.results) ? res.results
    : Array.isArray(res?.data) ? res.data
    : [];
  return list
    .map((o: any) => ({
      id: o.id ?? o.pk ?? o.office_id,
      code: o.code ?? o.office_code ?? null,
      name: o.name ?? o.office_name ?? o.title ?? "",
    }))
    .filter((o: OfficeDTO) => o.id && o.name);
}

/** ロール別のオプション（HQ=全社＋全拠点 / 支店管理者=自所のみ） */
export async function getOfficeOptionsForRole(isHQ: boolean, myBranchCode?: string) {
  const offices = await getOffices();
  if (isHQ) {
    const opts = offices.map((o) => ({ value: toStr(o.name), label: toStr(o.name) }));
    return [{ value: "all", label: "全営業所" }, ...opts];
  }
  const mine = offices.find((o) => toStr(o.code) === toStr(myBranchCode));
  return mine ? [{ value: toStr(mine.name), label: toStr(mine.name) }] : [];
}

/** ================= Employees ================= */
const mapDtoToRow = (e: any, fallbackOfficeName = ""): EmployeeRow => ({
  id: toStr(e.id ?? e.pk ?? e.employee_id),
  name: toStr(e.name ?? e.full_name ?? e.display_name ?? e.employee_name),
  personalCode: toStr(e.code ?? e.employee_code),
  office: toStr(e.office_name ?? e.branch_name ?? fallbackOfficeName),
  position: posToJP(e.position),
});

export async function getEmployeesByOfficeName(officeName?: string | null): Promise<EmployeeRow[]> {
  const qs = officeName ? `?office_name=${encodeURIComponent(officeName)}` : "";
  const res = await apiGet<any>(`/employees/${qs}`);
  const list: any[] = Array.isArray(res)
    ? res
    : Array.isArray(res?.results) ? res.results
    : Array.isArray(res?.data) ? res.data
    : [];
  return list.map((e) => mapDtoToRow(e, officeName ?? "")).filter((r) => r.id && r.name && r.personalCode);
}

export async function getEmployeesByBranchCode(branchCode: string): Promise<EmployeeRow[]> {
  const qs = branchCode ? `?branch_code=${encodeURIComponent(branchCode)}` : "";
  const res = await apiGet<any>(`/employees/${qs}`);
  const list: any[] = Array.isArray(res)
    ? res
    : Array.isArray(res?.results) ? res.results
    : Array.isArray(res?.data) ? res.data
    : [];
  return list.map((e) => mapDtoToRow(e)).filter((r) => r.id && r.name && r.personalCode);
}

/** ================ CRUD（基本形） ================ */
export type UpsertPayload = {
  code: string;                     // 6桁
  name: string;
  office_name?: string;             // ← backend はこれでOK（office の代替）
  position?: PositionCode;          // コード（日本語で送りたい場合は下の FromRow を使う）
};

export async function createEmployee(body: UpsertPayload): Promise<EmployeeRow> {
  const payload: UpsertPayload = {
    code: String(body.code ?? "").trim(),
    name: String(body.name ?? "").trim(),
    office_name: body.office_name ?? undefined,
    position: body.position ?? undefined,
  };
  const e = await apiPost<EmployeeDTO>("/employees/", payload);
  return mapDtoToRow(e);
}

export async function updateEmployee(id: string | number, body: Partial<UpsertPayload>): Promise<EmployeeRow> {
  const payload: Partial<UpsertPayload> = { ...body };
  if (payload.code != null) payload.code = String(payload.code).trim();
  if (payload.name != null) payload.name = String(payload.name).trim();
  const e = await apiPatch<EmployeeDTO>(`/employees/${encodeURIComponent(String(id))}/`, payload);
  return mapDtoToRow(e);
}

export async function deleteEmployee(id: string | number): Promise<void> {
  await apiDelete(`/employees/${encodeURIComponent(String(id))}/`);
}

/** ================ CRUD（画面Row→API 便利ラッパ） ================ */
/** Row から POST 用 payload を作成（position は日本語→コード変換、office は“名”を office_name へ） */
export function buildPayloadFromRow(row: {
  name: string;
  personalCode: string;
  office: string;
  position: PositionJP | string;
}): UpsertPayload {
  const code = String(row.personalCode ?? "").replace(/\D/g, "").slice(0, 6);
  return {
    code,
    name: String(row.name ?? "").trim(),
    office_name: String(row.office ?? "").trim() || undefined,
    position: jpToPos(row.position),
  };
}

/** 画面の Add 用：Row 相当から create */
export async function createEmployeeFromRow(row: {
  name: string;
  personalCode: string;
  office: string;
  position: PositionJP | string;
}): Promise<EmployeeRow> {
  return createEmployee(buildPayloadFromRow(row));
}

/** 画面の Edit 用：Row 相当から patch（差分だけ送りたい場合は第二引数で上書き） */
export async function updateEmployeeFromRow(
  id: string | number,
  row: { name?: string; personalCode?: string; office?: string; position?: PositionJP | string },
): Promise<EmployeeRow> {
  const base = buildPayloadFromRow({
    name: row.name ?? "",
    personalCode: row.personalCode ?? "",
    office: row.office ?? "",
    position: (row.position as any) ?? "一般",
  });
  // PATCH は送ったキーのみ反映なので、未入力は削る
  const payload: Partial<UpsertPayload> = {};
  if (row.name != null) payload.name = base.name;
  if (row.personalCode != null) payload.code = base.code;
  if (row.office != null) payload.office_name = base.office_name;
  if (row.position != null) payload.position = base.position;
  return updateEmployee(id, payload);
}
