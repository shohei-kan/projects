// src/data/mockDate.ts
// ← これに置き換え（固定にも戻せるトグル付）
export const USE_FIXED_TODAY = false;      // ← 開発で固定したい時だけ true
export const FIXED_TODAY = "2025-08-01";
// ここを “いま見たい日付” に合わせる（例：2025-08-28）
export const TODAY_STR = "2025-08-28";

function jstToday(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// export const TODAY_STR = USE_FIXED_TODAY ? FIXED_TODAY : jstToday();
