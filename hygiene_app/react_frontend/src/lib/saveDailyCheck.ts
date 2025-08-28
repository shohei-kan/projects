// src/lib/saveDailyCheck.ts
type StatusJP = "出勤入力済" | "退勤入力済" | "未入力";

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; errorCode: 'VALIDATION' | 'STEP_ORDER' | 'STORAGE'; message: string; details?: any };

type RecordShape = {
  id: string;               // `${dateISO}-${employeeCode}`
  employeeCode: string;
  date: string;             // YYYY-MM-DD (JST)
  work_start_time?: string; // ISO string
  work_end_time?: string;   // ISO string
  status: StatusJP;         // "未入力" | "出勤入力済" | "退勤入力済"
  comment?: string;         // まとめコメント
  temperature?: number;
};

type RecordItemShape = {
  recordId: string;        // RecordShape.id
  category: string;        // 例: "temperature", "no_health_issues" ...
  is_normal: boolean;
  value?: string;          // 文字メモがあれば
};

const LS_RECORDS_KEY = 'records.snapshot.v1';
const LS_ITEMS_KEY   = 'recordItems.snapshot.v1';

// JSTで YYYY-MM-DD を得る（日付ずれ対策）
export function todayISOInJST(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(d);
}

function loadLS<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    if (!s) return fallback;
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function saveLS<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

function loadRecords(): RecordShape[] {
  return loadLS<RecordShape[]>(LS_RECORDS_KEY, []);
}

function loadItems(): RecordItemShape[] {
  return loadLS<RecordItemShape[]>(LS_ITEMS_KEY, []);
}

function upsert<T extends { id: string }>(arr: T[], entity: T): T[] {
  const i = arr.findIndex((x) => x.id === entity.id);
  if (i === -1) return [...arr, entity];
  const clone = arr.slice();
  clone[i] = entity;
  return clone;
}

export async function saveDailyCheck(input: {
  employeeCode: string;
  dateISO?: string; // 省略時はJSTで今日
  step: 1 | 2;      // 1=出勤, 2=退勤
  temperature?: number;
  items: { category: string; is_normal: boolean; value?: string }[];
  comment?: string; // 「チェックOFFが1つでもあれば必須」
}): Promise<SaveResult> {
  try {
    const dateISO = (input.dateISO ?? todayISOInJST()).slice(0, 10);
    const id = `${dateISO}-${input.employeeCode}`;

    // 1) バリデーション（チェックOFF→コメント必須）
    const hasAbnormal = input.items.some((i) => i.is_normal === false);
    if (hasAbnormal && !input.comment?.trim()) {
      return { ok: false, errorCode: 'VALIDATION', message: '異常がある項目があります。コメントを入力してください。' };
    }
    if (typeof input.temperature === 'number' && input.temperature >= 37.5 && !input.comment?.trim()) {
      return { ok: false, errorCode: 'VALIDATION', message: '体温が37.5℃以上です。コメントを入力してください。' };
    }

    // 2) 既存レコード読み込み
    let records = loadRecords();
    let items = loadItems();
    const existing = records.find((r) => r.id === id);

    // 3) ステップ整合性（Step2はStep1後のみ）
    if (input.step === 2 && (!existing || !existing.work_start_time)) {
      return { ok: false, errorCode: 'STEP_ORDER', message: '退勤は出勤登録の後に行ってください。' };
    }

    // 4) レコードのUpsert
    const nowISO = new Date().toISOString();
    const base: RecordShape =
      existing ?? {
        id,
        employeeCode: input.employeeCode,
        date: dateISO,
        status: '未入力',
      };

    let next: RecordShape = { ...base, temperature: input.temperature, comment: input.comment };

    if (input.step === 1) {
      next.work_start_time = nowISO;
      next.status = '出勤入力済';
    } else {
      next.work_end_time = nowISO;
      next.status = '退勤入力済';
    }

    records = upsert(records, next);

    // 5) 項目の保存（recordIdで張り替え）
    items = items.filter((x) => x.recordId !== id);
    const newItems: RecordItemShape[] = input.items.map((i) => ({
      recordId: id,
      category: i.category,
      is_normal: i.is_normal,
      value: i.value,
    }));
    items.push(...newItems);

    // 6) 永続化
    saveLS(LS_RECORDS_KEY, records);
    saveLS(LS_ITEMS_KEY, items);

    return { ok: true, id };
  } catch (e) {
    console.error('[saveDailyCheck] STORAGE_ERROR', e);
    return { ok: false, errorCode: 'STORAGE', message: '保存に失敗しました（ストレージエラー）。', details: String(e) };
  }
}
