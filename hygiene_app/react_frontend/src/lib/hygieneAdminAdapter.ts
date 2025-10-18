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
}

// 内部用：正規化後の補助キー（UIには出さない）
type NormalizedRow = HygieneRecordRow & {
  recordId?: number | null
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

/** ================= 正規化 ================= */
function normalizeRow(x: any): NormalizedRow {
  const id =
    x?.id ??
    x?.record_id ??
    x?.uuid ??
    x?.pk ??
    `${toStr(x?.employee_name ?? x?.employee ?? "")}-${toStr(x?.date ?? x?.record_date ?? "")}`

  // recordId を拾う（数値化を試みる）
  const recIdRaw = x?.recordId ?? x?.record_id
let recordId: number | null =
   recIdRaw == null ? null : Number.isFinite(Number(recIdRaw)) ? Number(recIdRaw) : null
 // ★ フォールバック：recordId が無い時、id が数値ならそれを Record PK とみなす
 if (recordId == null) {
   const idNum = Number(id)
   if (Number.isFinite(idNum)) recordId = idNum
 }
  const officeCodeRaw =
    x?.office_code ?? x?.branch_code ?? x?.office?.code ?? x?.branch?.code
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

  const abnormalSrc =
    x?.abnormalItems ?? x?.abnormal_items ?? x?.abnormal_labels ?? x?.abnormal ?? []
  const abnormalItems: string[] = Array.isArray(abnormalSrc)
    ? abnormalSrc.map((s: any) => toStr(s)).filter(Boolean)
    : []

  type StatusLiteral = HygieneRecordRow["status"]
  const toStatus = (raw: string): StatusLiteral => {
    const s = String(raw).trim().replace(/\s+/g, "")
    if (/休/.test(s)) return "休み"
    if (/退勤/.test(s)) return "退勤入力済"
    if (/出勤/.test(s)) return "出勤入力済"
    // "未入力" 以外の未知表現は安全側で未入力に丸める
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

/** ================= Records（日次） ================= */
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

// getRecordDetail（string|number対応）
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
async function fetchRecordDetailFlexible(id: string): Promise<any | null> {
  const key = String(id)
  if (DETAIL_CACHE.has(key)) return DETAIL_CACHE.get(key)

  // まず /records/:id/ を試す
  for (const path of [`/records/${key}/`, `/records/${key}`]) {
    try {
      const d = await apiGet<any>(path)
      DETAIL_CACHE.set(key, d)
      return d
    } catch {}
  }

  // 合成キー探索
  let datePart: string | null = null,
    empPart: string | null = null
  const m1 = key.match(/^(\d{4}-\d{2}-\d{2})-(\d+)$/)
  const m2 = key.match(/^(\d+)-(\d{4}-\d{2}-\d{2})$/)
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
          DETAIL_CACHE.set(key, arr[0])
          return arr[0]
        }
      } catch {}
    }
  }

  DETAIL_CACHE.set(key, null)
  return null
}

async function hydrateFromDetails(list: NormalizedRow[]): Promise<NormalizedRow[]> {
  const targets = list.filter((r) => (r.abnormalItems?.length ?? 0) === 0 || !r.hasAnyComment)
  if (!targets.length) return list

  const results = await Promise.allSettled(targets.map((r) => fetchRecordDetailFlexible(r.id)))

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
  const url = join(
    `/records/${encodeURIComponent(String(recordId))}/supervisor_confirm/`,
  )

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
  const n = (s: string) => String(s).replace(/\u3000/g, "").replace(/\s+/g, "").toLowerCase()
  const uc = (s: string) => String(s).replace(/[\s\-_.]/g, "").toUpperCase()

  const wantCode = OFFICE_CACHE!.codeByName.get(n(officeName)) || ""
  const wantId = OFFICE_CACHE!.idByName.get(n(officeName)) || ""

  const src = rows as any[]

  if (wantCode) {
    const byCode = src.filter((r) => uc(r._officeCode || "") === uc(wantCode))
    if (byCode.length) return byCode as HygieneRecordRow[]
  }
  if (wantId) {
    const byId = src.filter((r) => String(r._officeId || "") === String(wantId))
    if (byId.length) return byId as HygieneRecordRow[]
  }
  return src.filter((r) => officeEqByName(r.officeName, officeName)) as HygieneRecordRow[]
}
