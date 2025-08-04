export interface RecordItem {
  id: number;
  recordId: number;
  category: string;
  is_normal: boolean;
  value: string | null;
}

export const mockRecordItems: RecordItem[] = [
  // Record ID: 1（田中 太郎）
  {
    id: 1,
    recordId: 1,
    category: "temperature",
    is_normal: true,
    value: "36.2",
  },
  {
    id: 2,
    recordId: 1,
    category: "health_check",
    is_normal: true,
    value: null,
  },
  {
    id: 3,
    recordId: 1,
    category: "uniform",
    is_normal: true,
    value: null,
  },

  // Record ID: 2（佐藤 花子）※退勤未登録
  {
    id: 4,
    recordId: 2,
    category: "temperature",
    is_normal: true,
    value: "36.7",
  },
  {
    id: 5,
    recordId: 2,
    category: "health_check",
    is_normal: false,
    value: "少し眠気あり",
  },
  {
    id: 6,
    recordId: 2,
    category: "uniform",
    is_normal: true,
    value: null,
  },

  // Record ID: 3（伊藤 誠）※異常あり
  {
    id: 7,
    recordId: 3,
    category: "temperature",
    is_normal: false,
    value: "38.1",
  },
  {
    id: 8,
    recordId: 3,
    category: "health_check",
    is_normal: false,
    value: "頭痛あり",
  },
  {
    id: 9,
    recordId: 3,
    category: "uniform",
    is_normal: true,
    value: null,
  },

  // Record ID: 5（山田 次郎）
  {
    id: 10,
    recordId: 5,
    category: "temperature",
    is_normal: true,
    value: "36.5",
  },
  {
    id: 11,
    recordId: 5,
    category: "health_check",
    is_normal: true,
    value: null,
  },
  {
    id: 12,
    recordId: 5,
    category: "uniform",
    is_normal: false,
    value: "爪が伸びていた",
  },
];
