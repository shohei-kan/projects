// src/data/mockDate.ts
export const USE_FIXED_TODAY = false as const; // ← 本番/通常は false（リアルタイム）
export const FIXED_TODAY = "2025-08-01" as const; // ← 固定したい日がある時だけ使う

export function jstToday(d = new Date()): string {
  // "YYYY-MM-DD" を返す（en-CAでゼロ埋め、JST基準）
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// ← これを有効化（固定/リアルタイムをトグル）
export const TODAY_STR = USE_FIXED_TODAY ? FIXED_TODAY : jstToday();
