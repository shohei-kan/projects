import type { HygieneRecordRow } from "@/lib/hygieneAdapter";
import { setSupervisorConfirm, loadSupervisorConfirm } from "@/lib/hygieneAdapter";
import { mockRecordItems } from "@/data/mockRecordItems"; // 従業員入力の項目データ
import { mockRecords } from "@/data/mockRecords";       // レコード本体（employeeCode/date 紐付け）
import { hygieneCategories } from "@/data/hygieneCategories"; // ← カテゴリ辞書（key/label/section）

const KEY_COMMENT = (id: string) => `hygiene:comment:${id}`;             // 自由記述（任意）
const KEY_ITEM_COMMENTS = (id: string) => `hygiene:itemComments:${id}`;  // 互換用（任意）

export type ItemComments = Record<string, string>;

/** カテゴリ辞書 → ラベル/セクションのマップを自動生成 */
export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  hygieneCategories.map((c) => [c.key, c.label])
);
export const CATEGORY_SECTIONS: Record<string, string> = Object.fromEntries(
  hygieneCategories.map((c) => [c.key, c.section])
);

export type DetailItem = {
  category: string;
  label: string;   // UI表示名
  section: string; // 表示セクション（体調/服装/…）
  is_normal: boolean;
  value: string | null; // 従業員入力（コメント/測定値）
};

function findRecordIdByRow(row: HygieneRecordRow): number | undefined {
  const rec = (mockRecords as any[]).find(
    (r) => r.employeeCode === row.employeeCode && r.date === row.date
  );
  return rec?.id as number | undefined;
}

/** 指定行の「項目別データ」を取得（mockRecordItems 由来） */
export function mockLoadRecordItems(row: HygieneRecordRow): DetailItem[] {
  const rid = findRecordIdByRow(row);
  if (!rid) return [];
  return (mockRecordItems as any[])
    .filter((it) => it.recordId === rid)
    .map((it) => ({
      category: it.category,
      label: CATEGORY_LABELS[it.category] ?? it.category,
      section: CATEGORY_SECTIONS[it.category] ?? "",
      is_normal: it.is_normal,
      value: it.value,
    }));
}

/** 確認フラグの保存（DB代わりに localStorage） */
export async function mockPatchConfirm(id: string, checked: boolean, _note = "") {
  await setSupervisorConfirm(id, checked);
  return { ok: true, id, supervisor_confirmed: checked };
}

/** 自由記述コメント（任意）— 使わないなら呼ばなくてOK */
export async function mockSaveFreeComment(id: string, text: string) {
  localStorage.setItem(KEY_COMMENT(id), text);
  return { ok: true };
}
export function mockLoadFreeComment(id: string): string {
  return localStorage.getItem(KEY_COMMENT(id)) ?? "";
}

/** （互換）任意の項目別コメントの保存/読込。主役は mockRecordItems 側。 */
export async function mockSaveItemComments(id: string, comments: ItemComments) {
  localStorage.setItem(KEY_ITEM_COMMENTS(id), JSON.stringify(comments || {}));
  return { ok: true };
}
export function mockLoadItemComments(id: string): ItemComments {
  const raw = localStorage.getItem(KEY_ITEM_COMMENTS(id));
  if (!raw) return {};
  try { return JSON.parse(raw) as ItemComments; } catch { return {}; }
}

/** 詳細取得：行 + 追加入力（mockRecordItems 等）を合成 */
export async function mockFetchDetail(row: HygieneRecordRow) {
  const comment = mockLoadFreeComment(row.id);
  const supervisorConfirmed = loadSupervisorConfirm(row.id);
  const items = mockLoadRecordItems(row);
  return {
    ...row,
    comment, // 総合コメント（任意）
    items,   // 項目別の実データ（従業員入力）
    supervisorConfirmed: supervisorConfirmed ?? row.supervisorConfirmed,
  };
}

/** 一覧用「コメントあり」判定：異常項目の value が1つでも入っていれば true */
export function mockHasAnyComment(row: HygieneRecordRow): boolean {
  const free = mockLoadFreeComment(row.id);
  const items = mockLoadRecordItems(row);
  const abnormalHas = items.some((it) => !it.is_normal && (it.value ?? '').trim().length > 0);
  return abnormalHas || !!free || !!row.hasComment; // 互換のため row.hasComment も考慮
}

