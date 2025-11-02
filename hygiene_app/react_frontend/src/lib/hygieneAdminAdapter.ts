// src/lib/hygieneAdminAdapter.ts

/** ================= 共通ヘルパ ================= */
const toStr = (v: any) => (v == null ? "" : String(v))
const pickList = (res: any) => {
  if (Array.isArray(res)) return res
  const cand =
    res?.results ?? res?.data ?? res?.items ?? res?.rows ?? res?.employees ?? res?.records
  return Array.isArray(cand) ? cand : []
}
const norm = (s: string) => toStr(s).replace(/\u3000/g, "").replace(/\s+/g, "").toLowerCase()
const normCode = (s: string) => toStr(s).replace(/[\s\-_.]/g, "").toUpperCase()

/** ================= 環境設定 ================= */
export const API_ROOT = String(import.meta.env.VITE_API_BASE ?? "/api").replace(/\/+$/, "")
const CREDENTIALS: RequestCredentials =
  import.meta.env.VITE_USE_CREDENTIALS === "1" ? "include" : "omit"
const join = (path: string) => `${API_ROOT}${path.startsWith("/") ? path : `/${path}`}`

async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(join(path), { credentials: CREDENTIALS })
  if (!r.ok) throw new Error(`${path} GET ${r.status}`)
  return r.json() as Promise<T>
}
async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(join(path), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: CREDENTIALS,
  })
  if (!r.ok) throw new Error(`${path} PATCH ${r.status}`)
  try {
    return (await r.json()) as T
  } catch {
    return undefined as unknown as T
  }
}

/** ================= 型 ================= */
export type HygieneRecordRow = {
  id: string
  officeName: string
  employeeName: string
  date: string // "YYYY-MM-DD"
  status: "出勤入力済" | "退勤入力済" | "未入力" | "休み"
  supervisorConfirmed: boolean
  abnormalItems: string[]
  hasAnyComment: boolean
  /** backend の Record PK（未作成= null） */
  recordId?: number | null
}

// 内部用：正規化後の補助キー（UIには出さない）
type NormalizedRow = HygieneRecordRow & {
  _officeCode?: string
  _officeId?: string
  _employeeId?: string
  _employeeCode?: string
}

type OfficeDTO = {
  id?: number | string
  code?: string
  office_code?: string
  name?: string
  office_name?: string
  title?: string
}

/** ================= Office キャッシュ ================= */
let OFFICE_CACHE:
  | {
      nameByCode: Map<string, string>
      codeByName: Map<string, string>
      nameById: Map<string, string>
      idByName: Map<string, string>
    }
  | null = null

async function ensureOfficeCache() {
  if (OFFICE_CACHE) return OFFICE_CACHE
  try {
    const rows = await getOffices().catch(() => [])
    const nameByCode = new Map<string, string>()
    const codeByName = new Map<string, string>()
    const nameById = new Map<string, string>()
    const idByName = new Map<string, string>()

    for (const o of rows) {
      const code = toStr((o as any).code ?? (o as any).office_code ?? "")
      const id = toStr((o as any).id ?? (o as any).office_id ?? (o as any).pk ?? "")
      const name = toStr(
        (o as any).name ?? (o as any).title ?? (o as any).office_name ?? (code || id),
      )
      if (code) nameByCode.set(normCode(code), name)
      if (name && code) codeByName.set(norm(name), code)
      if (id) nameById.set(id, name)
      if (name && id) idByName.set(norm(name), id)
    }
    OFFICE_CACHE = { nameByCode, codeByName, nameById, idByName }
  } catch {
    OFFICE_CACHE = {
      nameByCode: new Map(),
      codeByName: new Map(),
      nameById: new Map(),
      idByName: new Map(),
    }
  }
  return OFFICE_CACHE!
}

function officeEqByName(a: string, b: string): boolean {
  if (!a || !b) return false
  if (norm(a) === norm(b)) return true
  if (!OFFICE_CACHE) return false
  const aCode = OFFICE_CACHE.codeByName.get(norm(a)) ?? a
  const bCode = OFFICE_CACHE.codeByName.get(norm(b)) ?? b
  if (normCode(aCode) === normCode(bCode)) return true
  const aName = OFFICE_CACHE.nameByCode.get(normCode(a)) ?? a
  const bName = OFFICE_CACHE.nameByCode.get(normCode(b)) ?? b
  return norm(aName) === norm(bName)
}

/** ================= 従業員キャッシュ ================= */
const EMP_BY_ID = new Map<string, string>() // id -> name
const EMP_BY_CODE = new Map<string, string>() // code -> name

function patchEmployeeName(row: NormalizedRow) {
  // 数字っぽい名前は補完
  const looksNumeric = row.employeeName && /^[0-9]+$/.test(row.employeeName)
  if (!looksNumeric && row.employeeName) return row
  const byId = row._employeeId ? EMP_BY_ID.get(String(row._employeeId)) : undefined
  const byCode = row._employeeCode ? EMP_BY_CODE.get(String(row._employeeCode)) : undefined
  if (byId || byCode) row.employeeName = byId ?? byCode ?? row.employeeName
  return row
}

/** ------------- 詳細API 正規化＆キャッシュ（堅牢版） ------------- **/
const CATEGORY_DICT: Record<string, { label: string; section: string }> = {
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
}

const DETAIL_CACHE = new Map<string, any>()

const toLabelJa = (cat: string, fallback?: string) =>
  CATEGORY_DICT[cat]?.label ?? (fallback || cat)
const toSectionJa = (cat: string) => CATEGORY_DICT[cat]?.section ?? ""

/** ================= 正規化 ================= */
function normalizeItems(raw: any): Array<{
  category: string
  label: string
  section: string
  is_normal: boolean
  value: string | null
}> {
  const src: any[] = Array.isArray(raw) ? raw : []
  return src.map((it) => {
    const cat = String(it?.category ?? it?.key ?? it?.code ?? "")
    const isNormal = Boolean(it?.is_normal ?? it?.normal ?? it?.ok)
    const rawVal = it?.value ?? it?.comment ?? null
    const val = rawVal == null ? null : String(rawVal)
    return {
      category: cat,
      label: toLabelJa(cat, String(it?.label ?? "")),
      section: toSectionJa(cat),
      is_normal: isNormal,
      value: val,
    }
  })
}

function buildDetailFromRecord(rec: any, itemsOverride?: any[]) {
  const itemsRaw =
    itemsOverride ??
    (Array.isArray(rec?.items)
      ? rec.items
      : Array.isArray(rec?.record_items)
      ? rec.record_items
      : [])
  const items = normalizeItems(itemsRaw)

  const comment =
    items
      .filter((x) => !x.is_normal && x.value)
      .map((x) => `${x.label}: ${x.value}`)
      .join(" ／ ") || ""

  const employeeName =
    rec?.employee_name ?? rec?.employee?.name ?? rec?.user_name ?? rec?.name ?? ""
  const officeName = rec?.office_name ?? rec?.branch_name ?? rec?.office?.name ?? ""
  const date = String(rec?.date ?? rec?.record_date ?? "").slice(0, 10)

  return { items, comment, employeeName, officeName, date }
}

async function fetchItemsByRecordId(id: string | number) {
  const paths = [
    `/records/${id}/items/`,
    `/records/${id}/items`,
    `/record_items/?record=${encodeURIComponent(String(id))}`,
    `/record_items/?record_id=${encodeURIComponent(String(id))}`,
  ]
  for (const p of paths) {
    try {
      const res = await apiGet<any>(p)
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.results)
        ? res.results
        : Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res?.rows)
        ? res.rows
        : Array.isArray(res?.data)
        ? res.data
        : []
      if (list.length) return list
    } catch {
      /* 次へ */
    }
  }
  return []
}

// 置き換え：期待する従業員ID/コード/氏名でポストフィルタする版
async function fetchRecordDetailForRow(row: NormalizedRow): Promise<any | null> {
  const key = String(row.recordId != null ? row.recordId : row.id)
  if (DETAIL_CACHE.has(key)) return DETAIL_CACHE.get(key)

  // 1) Record PK がある → /records/:id を最優先
  if (row.recordId != null) {
    for (const path of [`/records/${row.recordId}/`, `/records/${row.recordId}`]) {
      try {
        const d = await apiGet<any>(path)
        DETAIL_CACHE.set(key, d)
        return d
      } catch {}
    }
  }

  // 2) 合成キー（date-emp or emp-date）から date/emp を抽出
  let datePart: string | null = null, empPart: string | null = null
  const mDateEmp = String(row.id).match(/^(\d{4}-\d{2}-\d{2})-(\d+)$/)
  const mEmpDate = String(row.id).match(/^(\d+)-(\d{4}-\d{2}-\d{2})$/)
  if (mDateEmp) { datePart = mDateEmp[1]; empPart = mDateEmp[2] }
  if (mEmpDate) { datePart = mEmpDate[2]; empPart = mEmpDate[1] }

  // 期待する従業員ヒント（優先順：_employeeId → _employeeCode → employeeName）
  const wantId   = row._employeeId ? String(row._employeeId) : null
  const wantCode = row._employeeCode ? String(row._employeeCode) : null
  const wantName = row.employeeName || null

  // 3) パラメータ検索 → 必ずポストフィルタで本人のレコードだけ採用
  if (datePart) {
    const qsDate = encodeURIComponent(datePart)
    const candPaths = [
      wantId   && `/records/?employee_id=${encodeURIComponent(wantId)}&date=${qsDate}`,
      wantCode && `/records/?employee_code=${encodeURIComponent(wantCode)}&date=${qsDate}`,
      empPart  && `/records/?employee_id=${encodeURIComponent(empPart)}&date=${qsDate}`,
      empPart  && `/records/?employee=${encodeURIComponent(empPart)}&date=${qsDate}`,
    ].filter(Boolean) as string[]

    for (const p of candPaths) {
      try {
        const list = await apiGet<any>(p)
        const arr: any[] = Array.isArray(list)
          ? list
          : Array.isArray(list?.results) ? list.results
          : Array.isArray(list?.records) ? list.records
          : []

        // --- ポストフィルタ：ID/コード/氏名で本人に絞る ---
        const hit = arr.find((rec) => {
          const rid   = String(rec?.employee_id ?? rec?.employee?.id ?? "")
          const rcode = String(rec?.employee_code ?? rec?.employee?.code ?? "")
          const rname = String(rec?.employee_name ?? rec?.employee?.name ?? "")
          if (wantId   && rid   && rid   === wantId)   return true
          if (wantCode && rcode && rcode === wantCode) return true
          if (!wantId && !wantCode && wantName && rname && rname === wantName) return true
          return false
        })

        if (hit) {
          DETAIL_CACHE.set(key, hit)
          return hit
        }
      } catch {}
    }
  }

  DETAIL_CACHE.set(key, null)
  return null
}
/** ================= 正規化（一覧行） ================= */
function normalizeRow(x: any): NormalizedRow {
  const id =
    x?.id ??
    x?.record_id ??
    x?.uuid ??
    x?.pk ??
    `${toStr(x?.employee_name ?? x?.employee ?? "")}-${toStr(x?.date ?? x?.record_date ?? "")}`

  // recordId を拾う（数値化を試みる）+ フォールバック
  const recIdRaw = x?.recordId ?? x?.record_id
  let recordId: number | null =
    recIdRaw == null ? null : Number.isFinite(Number(recIdRaw)) ? Number(recIdRaw) : null
  if (recordId == null) {
    const idNum = Number(id)
    if (Number.isFinite(idNum)) recordId = idNum
  }

  const officeCodeRaw = x?.office_code ?? x?.branch_code ?? x?.office?.code ?? x?.branch?.code
  const officeIdRaw = x?.office_id ?? x?.branch_id ?? x?.office?.id ?? x?.branch?.id

  const empIdRaw = x?.employee ?? x?.employee_id ?? x?.user_id ?? x?.employee?.id
  const empCodeRaw = x?.employee_code ?? x?.employee?.code ?? x?.emp_code

  const officeCode = officeCodeRaw != null ? toStr(officeCodeRaw) : ""
  const officeId = officeIdRaw != null ? toStr(officeIdRaw) : ""

  let officeName =
    x?.officeName ??
    x?.office_name ??
    x?.office ??
    x?.branch_name ??
    x?.branch ??
    x?.office?.name ??
    ""
  if (!officeName) {
    const byCode = officeCode ? OFFICE_CACHE?.nameByCode.get(normCode(officeCode)) : undefined
    const byId = officeId ? OFFICE_CACHE?.nameById.get(officeId) : undefined
    officeName = (byCode ?? byId ?? "") || officeCode || officeId || ""
  }

  const employeeName =
    x?.employeeName ?? x?.employee_name ?? x?.employee?.name ?? x?.user_name ?? toStr(empIdRaw ?? "")

  const date = toStr(x?.date ?? x?.record_date ?? x?.ymd ?? "").slice(0, 10)

  const supervisorConfirmed = Boolean(
    x?.supervisorConfirmed ?? x?.supervisor_confirmed ?? x?.confirmed ?? false,
  )

  // --- status の丸め（英語コードも吸収） ---
  type StatusLiteral = HygieneRecordRow["status"]
  const toStatus = (raw: string): StatusLiteral => {
    const s = String(raw).trim().replace(/\s+/g, "").toLowerCase()
    // 日本語（既存）
    if (/休/.test(s)) return "休み"
    if (/退勤/.test(s)) return "退勤入力済"
    if (/出勤/.test(s)) return "出勤入力済"
    // 英語コード
    if (s === "off" || s === "dayoff") return "休み"
    if (s === "left" || s === "checkedout" || s === "clockout") return "退勤入力済"
    if (s === "arrived" || s === "checkedin" || s === "clockin") return "出勤入力済"
    if (s === "none" || s === "unknown" || s === "") return "未入力"
    // 既知外は安全側で未入力
    return "未入力"
  }

  const apiStatusRaw = toStr(x?.status_jp ?? x?.status ?? "")
  const isOffFlag = Boolean(x?.is_off ?? x?.day_off ?? x?.is_day_off)

  let status: StatusLiteral
  if (apiStatusRaw) {
    status = toStatus(apiStatusRaw) // union に丸める
  } else if (isOffFlag) {
    status = "休み"
  } else if (x?.clock_out || x?.checked_out || x?.work_end_time) {
    status = "退勤入力済"
  } else if (x?.clock_in || x?.checked_in || x?.work_start_time) {
    status = "出勤入力済"
  } else {
    status = "未入力"
  }

  // --- 異常項目がカテゴリ英語なら日本語ラベルへ ---
  const abnormalSrc =
    x?.abnormalItems ?? x?.abnormal_items ?? x?.abnormal_labels ?? x?.abnormal ?? []
  let abnormalItems: string[] = Array.isArray(abnormalSrc)
    ? abnormalSrc.map((s: any) => toStr(s)).filter(Boolean)
    : []
  abnormalItems = abnormalItems.map((k) => toLabelJa(k, k))

  const hasAnyComment = Boolean(
    x?.hasAnyComment ?? x?.has_comment ?? x?.has_any_comment ?? (x?.comment_count ?? 0) > 0,
  )

  return {
    id: toStr(id),
    officeName: toStr(officeName),
    employeeName: toStr(employeeName),
    date,
    status,
    supervisorConfirmed,
    abnormalItems,
    hasAnyComment,
    recordId,
    _officeCode: officeCode ? normCode(officeCode) : undefined,
    _officeId: officeId || undefined,
    _employeeId: empIdRaw != null ? toStr(empIdRaw) : undefined,
    _employeeCode: empCodeRaw != null ? toStr(empCodeRaw) : undefined,
  }
}

/** ================= Offices ================= */
export async function getOffices(): Promise<OfficeDTO[]> {
  const res = await apiGet<any>("/offices/")
  return pickList(res)
}
export async function getOfficeNames(): Promise<string[]> {
  const rows = await getOffices()
  return rows
    .map((o) =>
      toStr(
        (o as any).name ??
          (o as any).title ??
          (o as any).office_name ??
          (o as any).code ??
          (o as any).office_code,
      ),
    )
    .filter(Boolean)
}
export async function getBranchNameByCode(code: string): Promise<string> {
  if (!code) return ""
  await ensureOfficeCache()
  return OFFICE_CACHE!.nameByCode.get(normCode(code)) ?? code
}

/** ================= Employees ================= */
export type EmployeeLite = { id: string; code: string; name: string }

export async function getEmployeesByOffice(officeKey: string): Promise<string[]> {
  const xs = await getEmployeesForOffice(officeKey)
  return xs.map((e) => e.name)
}
export async function getEmployeesForOffice(officeKey: string): Promise<EmployeeLite[]> {
  await ensureOfficeCache()
  const wantCode = OFFICE_CACHE!.codeByName.get(norm(officeKey)) || ""
  const wantId = OFFICE_CACHE!.idByName.get(norm(officeKey)) || ""

  const qName = encodeURIComponent(officeKey)
  const qCode = wantCode ? encodeURIComponent(wantCode) : null

  const paths = [
    qCode && `/employees/?office_code=${qCode}`,
    `/employees/?office_name=${qName}`,
    `/employees/?office=${qName}`,
    `/employees/?branch_name=${qName}`,
    `/employees/?branch=${qName}`,
  ].filter(Boolean) as string[]

  for (const p of paths) {
    try {
      const res = await apiGet<any>(p)
      const list = pickList(res)
      if (!list?.length) continue

      const filtered = list.filter((e: any) => {
        const name = toStr(e?.office_name ?? e?.branch_name ?? e?.office?.name ?? "")
        const code = toStr(e?.office_code ?? e?.branch_code ?? e?.office?.code ?? "")
        const id = toStr(e?.office_id ?? e?.branch_id ?? e?.office?.id ?? "")
        if (wantCode && normCode(code) === normCode(wantCode)) return true
        if (wantId && id && String(id) === String(wantId)) return true
        return officeEqByName(name || code || id, officeKey)
      })

      const employees: EmployeeLite[] = filtered
        .map((e: any) => ({
          id: toStr(e?.id ?? e?.pk ?? e?.employee_id ?? ""),
          code: toStr(e?.code ?? e?.employee_code ?? ""),
          name: toStr(e?.name ?? e?.full_name ?? e?.display_name ?? e?.employee_name ?? ""),
        }))
        .filter((x) => x.id && x.name)

      // キャッシュ（後で名前補完に使う）
      for (const emp of employees) {
        if (emp.id) EMP_BY_ID.set(emp.id, emp.name)
        if (emp.code) EMP_BY_CODE.set(emp.code, emp.name)
      }

      if (employees.length) return employees
    } catch {
      /* 次 */
    }
  }
  return []
}

/** ================= Records（日次 単発取得） ================= */
export async function getDailyRows(
  officeName: string,
  ymd: string,
): Promise<HygieneRecordRow[]> {
  await ensureOfficeCache()

  const wantCodeRaw = OFFICE_CACHE!.codeByName.get(norm(officeName)) ?? ""
  const WANT = { code: normCode(wantCodeRaw), name: officeName }

  const qsOfficeName = encodeURIComponent(officeName)
  const qsOfficeCode = WANT.code ? encodeURIComponent(wantCodeRaw) : null
  const qsDate = encodeURIComponent(ymd)

  const candidates: Array<{ path: string; isOfficeScoped: boolean }> = [
    qsOfficeCode
      ? { path: `/records/?office_code=${qsOfficeCode}&date=${qsDate}`, isOfficeScoped: true }
      : null,
    { path: `/records/?office_name=${qsOfficeName}&date=${qsDate}`, isOfficeScoped: true },
    { path: `/records/?office=${qsOfficeName}&date=${qsDate}`, isOfficeScoped: true },
    { path: `/records/?branch_name=${qsOfficeName}&date=${qsDate}`, isOfficeScoped: true },
    { path: `/records/?branch=${qsOfficeName}&date=${qsDate}`, isOfficeScoped: true },
    { path: `/records/?date=${qsDate}`, isOfficeScoped: false },
  ].filter(Boolean) as Array<{ path: string; isOfficeScoped: boolean }>

  const postFilter = (rows: NormalizedRow[]) => {
    if (WANT.code) {
      const byCode = rows.filter((r) => r._officeCode && r._officeCode === WANT.code)
      if (byCode.length) return byCode
    }
    return rows.filter((r) => officeEqByName(r.officeName, WANT.name))
  }

  for (const { path, isOfficeScoped } of candidates) {
    try {
      let list = pickList(await apiGet<any>(path)).map(normalizeRow)

      if (isOfficeScoped) {
        list = list.map((r) => {
          const patched: any = { ...r }
          if (!patched.officeName) patched.officeName = WANT.name
          if (WANT.code && !patched._officeCode) patched._officeCode = WANT.code
          return patched
        })
      } else {
        list = postFilter(list)
      }

      if (list.length) {
        // 異常/コメント注入
        const enriched = await hydrateFromDetails(list)
        // 従業員名の補完（数字→名前）
        await getEmployeesForOffice(officeName)
        enriched.forEach(patchEmployeeName)
        return enriched as unknown as HygieneRecordRow[]
      }
    } catch {
      /* 次へ */
    }
  }
  return []
}

/** ================= Records（月次） ================= */
export async function getMonthRowsByEmployeeId(
  employeeId: string,
  ym: string,
): Promise<HygieneRecordRow[]> {
  const qsId = encodeURIComponent(employeeId)
  const qsYm = encodeURIComponent(ym)

  const paths = [
    `/records/?employee=${qsId}&month=${qsYm}`,
    `/records/?employee_id=${qsId}&month=${qsYm}`,
    `/records/?employee_pk=${qsId}&month=${qsYm}`,
  ]

  for (const p of paths) {
    try {
      const res = await apiGet<any>(p)
      let list = pickList(res)
        .map(normalizeRow)
        .filter((r: any) => toStr((r as any)._employeeId) === toStr(employeeId))
      if (list.length) {
        list = await hydrateFromDetails(list)
        list.forEach(patchEmployeeName)
        return list
      }
    } catch {
      /* 次 */
    }
  }
  // 月のみ → フロントでID照合
  try {
    let list = pickList(await apiGet<any>(`/records/?month=${qsYm}`))
      .map(normalizeRow)
      .filter((r: any) => toStr((r as any)._employeeId) === toStr(employeeId))
    list = await hydrateFromDetails(list)
    list.forEach(patchEmployeeName)
    return list as unknown as HygieneRecordRow[]
  } catch {
    return []
  }
}

// 互換：名前 or ID or コードを受け取り、自動で解決
export async function getMonthRows(employeeKey: string, ym: string): Promise<HygieneRecordRow[]> {
  const key = (employeeKey || "").trim()
  if (!key) return []
  if (/^[0-9]+$/.test(key)) {
    // “100003” のような ID/コードはまず ID として試す
    const byId = await getMonthRowsByEmployeeId(key, ym)
    if (byId.length) return byId
  }
  const qsEmp = encodeURIComponent(key)
  const qsYm = encodeURIComponent(ym)
  const namePaths = [
    `/records/?employee_name=${qsEmp}&month=${qsYm}`,
    `/records/?user_name=${qsEmp}&month=${qsYm}`,
    `/records/?employee=${qsEmp}&month=${qsYm}`, // 一部実装では name を受ける
  ]
  for (const p of namePaths) {
    try {
      let list = pickList(await apiGet<any>(p))
        .map(normalizeRow)
        .filter((r) => norm(r.employeeName) === norm(key))
      if (list.length) {
        list = await hydrateFromDetails(list)
        list.forEach(patchEmployeeName)
        return list
      }
    } catch {
      /* 次 */
    }
  }
  // 最後の保険：月だけ取得して名前で名寄せ
  try {
    let list = pickList(await apiGet<any>(`/records/?month=${qsYm}`))
      .map(normalizeRow)
      .filter((r) => norm(r.employeeName) === norm(key))
    list = await hydrateFromDetails(list)
    list.forEach(patchEmployeeName)
    return list
  } catch {
    return []
  }
}

/** ================= 詳細の取得（UIの行から） ================= */
export async function getRecordDetail(
  recordId: string | number,
): Promise<{
  items: {
    category: string
    label: string
    section: string
    is_normal: boolean
    value: string | null
  }[]
  comment: string
  employeeName?: string
  officeName?: string
  date?: string
}> {
  const key = String(recordId)
  if (DETAIL_CACHE.has(key)) return DETAIL_CACHE.get(key)

  // 1) 最優先：/records/:id/（このAPIが items を返す想定）
  const tryRecord = async (idLike: string) => {
    for (const path of [`/records/${idLike}/`, `/records/${idLike}`]) {
      try {
        const rec = await apiGet<any>(path)
        const items =
          Array.isArray(rec?.items) || Array.isArray(rec?.record_items)
            ? undefined
            : await fetchItemsByRecordId(rec?.id ?? idLike)
        const normed = buildDetailFromRecord(rec, items)
        DETAIL_CACHE.set(key, normed)
        return normed
      } catch {
        /* 次 */
      }
    }
    return null
  }

  const byId = await tryRecord(key)
  if (byId) return byId

  // 2) 合成キー（emp-date / date-emp）→ 検索で拾う
  let datePart: string | null = null,
    empPart: string | null = null
  const m1 = key.match(/^(\d{4}-\d{2}-\d{2})-(\d+)$/) // date-emp
  const m2 = key.match(/^(\d+)-(\d{4}-\d{2}-\d{2})$/) // emp-date
  if (m1) {
    datePart = m1[1]
    empPart = m1[2]
  }
  if (m2) {
    datePart = m2[2]
    empPart = m2[1]
  }

  if (datePart && empPart) {
    const qsDate = encodeURIComponent(datePart)
    const qsEmp = encodeURIComponent(empPart)
    for (const p of [
      `/records/?employee_code=${qsEmp}&date=${qsDate}`,
      `/records/?employee=${qsEmp}&date=${qsDate}`,
      `/records/?employee_id=${qsEmp}&date=${qsDate}`,
    ]) {
      try {
        const list = await apiGet<any>(p)
        const arr: any[] = Array.isArray(list)
          ? list
          : Array.isArray(list?.results)
          ? list.results
          : Array.isArray(list?.records)
          ? list.records
          : []
        if (arr.length) {
          const rec = arr[0]
          const items =
            Array.isArray(rec?.items) || Array.isArray(rec?.record_items)
              ? undefined
              : await fetchItemsByRecordId(rec?.id)
          const normed = buildDetailFromRecord(rec, items)
          DETAIL_CACHE.set(key, normed)
          return normed
        }
      } catch {
        /* 次 */
      }
    }
  }

  console.warn("[detail] failed to resolve record detail for", key)
  const empty = { items: [], comment: "" }
  DETAIL_CACHE.set(key, empty)
  return empty
}

/** ================= 異常/コメント注入（一覧用） ================= */
async function hydrateFromDetails(list: NormalizedRow[]): Promise<NormalizedRow[]> {
  const targets = list.filter((r) => (r.abnormalItems?.length ?? 0) === 0 || !r.hasAnyComment)
  if (!targets.length) return list

  const results = await Promise.allSettled(targets.map((r) => fetchRecordDetailForRow(r)))

  results.forEach((res, i) => {
    if (res.status !== "fulfilled" || !res.value) return
    const d = res.value
    const items: any[] = Array.isArray(d?.items)
      ? d.items
      : Array.isArray(d?.record_items)
      ? d.record_items
      : []

    let abnormal: string[] = []
    let hasComment = false
    for (const it of items) {
      const isNormal = Boolean(it?.is_normal ?? it?.normal ?? it?.ok)
      if (!isNormal) {
        const cat = String(it?.category ?? it?.key ?? "")
        const lbl = String(it?.label ?? "")
        const label = toLabelJa(cat, lbl)
        abnormal.push(label)
        const v = String((it?.comment ?? it?.value ?? "") as any).trim()
        if (v.length > 0) hasComment = true
      }
    }
    abnormal = Array.from(new Set(abnormal))

    const row = targets[i]
    row.abnormalItems = abnormal
    row.hasAnyComment = hasComment
  })

  return list
}

/** ================= 責任者確認 ================= */
export async function patchSupervisorConfirm(
  recordId: string | number,
  confirmed: boolean,
  supervisorCode?: string | null, // 任意
): Promise<boolean> {
  if (!recordId && recordId !== 0) {
    throw new Error("recordId is required")
  }
  const url = join(`/records/${encodeURIComponent(String(recordId))}/supervisor_confirm/`)

  const init: RequestInit = confirmed
    ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: CREDENTIALS,
        body: supervisorCode ? JSON.stringify({ supervisor_code: supervisorCode }) : "{}",
      }
    : {
        method: "DELETE",
        credentials: CREDENTIALS,
      }

  const r = await fetch(url, init)
  if (!r.ok) {
    const t = await r.text().catch(() => "")
    throw new Error(`supervisor_confirm ${confirmed ? "POST" : "DELETE"} ${r.status} ${t}`)
  }
  try {
    const json = await r.json()
    if (typeof json?.supervisor_confirmed === "boolean") return json.supervisor_confirmed
  } catch {
    /* no body */
  }
  return confirmed
}

/** ================= 確認可否（休みも許可） ================= */
export function canConfirmRow(opts: {
  role: "hq_admin" | "branch_manager"
  row: HygieneRecordRow
  userOffice?: string
  fallbackOffice?: string
}): boolean {
  const { role, row, userOffice, fallbackOffice } = opts

  // UI行IDが無いのは不可（最低限のガード）
  if (!row?.id) return false

  // ★ 休みも許可：退勤入力済 か 休み
  if (!(row.status === "退勤入力済" || row.status === "休み")) {
    return false
  }

  // HQ は全件OK
  if (role === "hq_admin") return true

  // 支店管理者は自拠点のみ
  const rowOffice = row.officeName || fallbackOffice || ""
  if (!rowOffice || !userOffice) return false
  return officeEqByName(rowOffice, userOffice)
}

/** ================= 行フィルタ（営業所で厳密に） ================= */
export async function filterRowsByOffice(
  rows: HygieneRecordRow[],
  officeName: string,
): Promise<HygieneRecordRow[]> {
  await ensureOfficeCache()

  const n = (s: string) => String(s ?? "").replace(/\u3000/g, "").replace(/\s+/g, "").toLowerCase()
  const uc = (s: string) => String(s ?? "").replace(/[\s\-_.]/g, "").toUpperCase()

  // 期待する営業所キー（キャッシュ）
  const wantNameKey = n(officeName)
  const wantCode = OFFICE_CACHE!.codeByName.get(wantNameKey) || ""
  const wantId = OFFICE_CACHE!.idByName.get(wantNameKey) || ""

  // 行から取りうる“営業所の手掛かり”を吸収
  const getRowKeys = (r: any) => {
    const code = r._officeCode ?? r.officeCode ?? r.office?.code ?? ""
    const id = r._officeId ?? r.officeId ?? r.office?.id ?? ""
    const name = r.officeName ?? (r as any)._officeName ?? r.office?.name ?? ""
    return { code: uc(code), id: String(id), nameKey: n(name) }
  }

  let filtered: HygieneRecordRow[]

  if (wantCode) {
    // code が分かっているときは code で厳密フィルタ
    filtered = rows.filter((r) => getRowKeys(r).code === uc(wantCode)) as HygieneRecordRow[]
  } else if (wantId) {
    // id が分かっているときは id で厳密フィルタ
    filtered = rows.filter((r) => getRowKeys(r).id === String(wantId)) as HygieneRecordRow[]
  } else {
    // 最後の手段として name 正規化一致（※混入防止のため“必ず絞る”）
    filtered = rows.filter((r) => getRowKeys(r).nameKey === wantNameKey) as HygieneRecordRow[]
  }

  return filtered
}

/** ================= 日次：全従業員で埋める ================= */
// ================= 日次：全従業員で埋める（ID→コード→一意氏名 で厳密突合） =================
export async function getDailyRowsAllEmployees(
  officeName: string,
  ymd: string,
): Promise<HygieneRecordRow[]> {
  // 1) APIからその日の既存記録 & 営業所の従業員マスタ
  const [rows, employees] = await Promise.all([
    getDailyRows(officeName, ymd),
    getEmployeesForOffice(officeName),
  ])

  // 2) 既存行を内部正規化
  const normed = (rows as any[]).map((x) => normalizeRow(x)) as NormalizedRow[]

  // 3) 既存行を引くための索引（ID 最優先 → コード → 氏名）
  const byEmpId   = new Map<string, NormalizedRow>()
  const byEmpCode = new Map<string, NormalizedRow>()
  const byEmpName = new Map<string, NormalizedRow>()
  for (const r of normed) {
    if (r._employeeId)   byEmpId.set(String(r._employeeId), r)
    if (r._employeeCode) byEmpCode.set(String(r._employeeCode), r)
    if (r.employeeName)  byEmpName.set(String(r.employeeName), r)
  }

  // 4) 同姓同名の曖昧一致を避けるため、重複名を検出
  const nameCount = new Map<string, number>()
  employees.forEach((e) => nameCount.set(e.name, 1 + (nameCount.get(e.name) ?? 0)))
  const isUniqueName = (name: string) => (nameCount.get(name) ?? 0) === 1

  // 5) 従業員マスタをベースに画面行を構築（既存ヒットが無ければ「未入力」の合成行）
  const synth: HygieneRecordRow[] = employees.map((e) => {
    const code = (e.code || "").trim()
    const name = (e.name || "").trim()

    // 突合の優先順位：employeeId → employeeCode → （重複のない場合のみ）name
    const hit =
      (e.id && byEmpId.get(String(e.id))) ||
      (code && byEmpCode.get(code)) ||
      (name && isUniqueName(name) ? byEmpName.get(name) : undefined)

    if (hit) {
      return {
        id: String(hit.id),
        officeName: String(hit.officeName || officeName),
        employeeName: String(hit.employeeName || name),
        date: String(hit.date || ymd).slice(0, 10),
        status: hit.status,
        supervisorConfirmed: !!hit.supervisorConfirmed,
        abnormalItems: Array.isArray(hit.abnormalItems) ? hit.abnormalItems : [],
        hasAnyComment: !!hit.hasAnyComment,
        recordId: hit.recordId ?? (Number.isFinite(Number(hit.id)) ? Number(hit.id) : null),
      }
    }

    // 合成行のキーは employeeId 起点にして衝突を回避
    return {
      id: `${ymd}-${e.id}`,
      officeName,
      employeeName: name,
      date: ymd,
      status: "未入力",
      supervisorConfirmed: false,
      abnormalItems: [],
      hasAnyComment: false,
      recordId: null,
    }
  })

  // 6) 既存行にいるが従業員マスタに居ない（退職・異動の残骸等）も保持
  const extra = normed
    .filter((r) => {
      const key = String(r._employeeId || r._employeeCode || r.employeeName || "")
      if (!key) return false
      return !employees.some(
        (e) =>
          String(e.id) === String(r._employeeId) ||
          e.code === r._employeeCode ||
          e.name === r.employeeName,
      )
    })
    .map((hit) => ({
      id: String(hit.id),
      officeName: String(hit.officeName || officeName),
      employeeName: String(hit.employeeName || ""),
      date: String(hit.date || ymd).slice(0, 10),
      status: hit.status,
      supervisorConfirmed: !!hit.supervisorConfirmed,
      abnormalItems: Array.isArray(hit.abnormalItems) ? hit.abnormalItems : [],
      hasAnyComment: !!hit.hasAnyComment,
      recordId: hit.recordId ?? (Number.isFinite(Number(hit.id)) ? Number(hit.id) : null),
    }))

  const merged = [...synth, ...extra]

  // 7) 異常/コメントの注入（不足分のみ）
  const enriched = await hydrateFromDetails(merged as any)

  // 8) 数字の employeeName をキャッシュから補完
  enriched.forEach((r: any) => patchEmployeeName(r))

  // 9) 最終防波堤：営業所で厳密フィルタ（0件になったら合成行を優先）
  const strictly = await filterRowsByOffice(enriched as any, officeName)
  const finalRows = strictly.length > 0 ? strictly : (enriched as any)

  // 10) 表示安定のため氏名ソート
  return finalRows.sort((a: HygieneRecordRow, b: HygieneRecordRow) =>
    a.employeeName.localeCompare(b.employeeName, "ja"),
  )
}

/** ================= レコードクリア（安全版） ================= */
export async function clearDailyRecord(params: {
  recordId?: number | string | null
  employeeCode?: string | null
  dateISO?: string | null
}): Promise<void> {
  const id = params.recordId != null ? String(params.recordId) : null

  // 1) /records/:id/clear/ （推奨エンドポイント想定）
  const tryIdClear = async () => {
    if (!id) return false
    const paths = [
      `/records/${encodeURIComponent(id)}/clear/`,
      `/records/${encodeURIComponent(id)}/clear`,
    ]
    for (const p of paths) {
      try {
        const r = await fetch(join(p), {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: CREDENTIALS,
        })
        if (r.ok) return true
      } catch {}
    }
    return false
  }

  // 2) DELETE /records/:id/（削除が許可されている場合）
  const tryIdDelete = async () => {
    if (!id) return false
    try {
      const r = await fetch(join(`/records/${encodeURIComponent(id)}/`), {
        method: "DELETE",
        credentials: CREDENTIALS,
      })
      if (r.ok || r.status === 204) return true
    } catch {}
    try {
      const r2 = await fetch(join(`/records/${encodeURIComponent(id)}`), {
        method: "DELETE",
        credentials: CREDENTIALS,
      })
      if (r2.ok || r2.status === 204) return true
    } catch {}
    return false
  }

  // 3) 代替：submit で空の値を上書き（items空・打刻null）
  const trySubmitEmpty = async () => {
    if (!params.employeeCode || !params.dateISO) return false
    try {
      const payload = {
        employee_code: params.employeeCode,
        date: params.dateISO,
        work_start_time: null,
        work_end_time: null,
        supervisor_code: null,
        items: [] as any[],
      }
      const r = await fetch(join("/records/submit"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: CREDENTIALS,
      })
      return r.ok
    } catch {
      return false
    }
  }

  // 順に試す
  if (await tryIdClear()) return
  if (await tryIdDelete()) return
  if (await trySubmitEmpty()) return

  throw new Error("レコードのクリアに失敗しました")
}

/** ================= Active Range（最初の記録〜今日） ================= */
export type ActiveRange = { startYm: string; endYm: string }

export async function getEmployeeActiveRange(
  employeeId: string | number,
): Promise<{ startYm: string; endYm: string }> {
  const id = encodeURIComponent(String(employeeId))

  // 推奨：パス版
  try {
    const res = await apiGet<any>(`/employees/${id}/active_range/`)
    const startYm = String(res?.startYm || "").slice(0, 7)
    const endYm = String(res?.endYm || "").slice(0, 7)
    return { startYm, endYm }
  } catch {
    // フォールバック：クエリ版
    const res = await apiGet<any>(`/employees/active_range/?employee_id=${id}`)
    const startYm = String(res?.startYm || "").slice(0, 7)
    const endYm = String(res?.endYm || "").slice(0, 7)
    return { startYm, endYm }
  }
}

/** ================= YYYY-MM の列挙 ================= */
export function enumerateYm(startYm: string, endYm: string): string[] {
  const ok = (s: string) => /^\d{4}-\d{2}$/.test(s)
  if (!ok(startYm) || !ok(endYm)) return []
  const [sy, sm] = startYm.split("-").map(Number)
  const [ey, em] = endYm.split("-").map(Number)
  const out: string[] = []
  let y = sy,
    m = sm
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}
