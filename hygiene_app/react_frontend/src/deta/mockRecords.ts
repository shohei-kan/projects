export interface Record {
  id: number;
  employeeCode: string;
  date: string;
  work_start_time: string | null;
  work_end_time: string | null;
  status: "draft" | "submitted";
  verifierCode: string | null;
  submitted_at: string | null;
}

export const mockRecords: Record[] = [
  {
    id: 1,
    employeeCode: "100002", // 横浜・田中 太郎
    date: "2025-08-01",
    work_start_time: "2025-08-01T08:00:00Z",
    work_end_time: "2025-08-01T17:00:00Z",
    status: "submitted",
    verifierCode: "100001", // 所長: 菅野 祥平
    submitted_at: "2025-08-01T17:05:00Z",
  },
  {
    id: 2,
    employeeCode: "100003",
    date: "2025-08-01",
    work_start_time: "2025-08-01T08:10:00Z",
    work_end_time: null,
    status: "draft",
    verifierCode: null,
    submitted_at: null,
  },
  {
    id: 3,
    employeeCode: "200002", // 鎌倉・伊藤 誠
    date: "2025-08-01",
    work_start_time: "2025-08-01T08:15:00Z",
    work_end_time: "2025-08-01T16:50:00Z",
    status: "submitted",
    verifierCode: "200001", // 鎌倉所長
    submitted_at: "2025-08-01T16:55:00Z",
  },
  {
    id: 4,
    employeeCode: "300003", // 東京・大野 未来
    date: "2025-08-01",
    work_start_time: null,
    work_end_time: null,
    status: "draft",
    verifierCode: null,
    submitted_at: null,
  },
  {
    id: 5,
    employeeCode: "100004",
    date: "2025-08-01",
    work_start_time: "2025-08-01T08:00:00Z",
    work_end_time: null,
    status: "draft",
    verifierCode: null,
    submitted_at: null,
  },
];
