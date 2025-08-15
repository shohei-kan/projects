export interface Branch {
  code: string;
  name: string;
  password: string; // 平文でOK（ハッシュ化はサーバー側想定）
  created_at: string;
}

export const mockBranches: Branch[] = [
  {
    code: "YK1234",
    name: "横浜市立馬場小学校",
    password: "1234",
    created_at: "2025-07-01T09:00:00Z",
  },
  {
    code: "KM5678",
    name: "横浜英和学院",
    password: "5678",
    created_at: "2025-07-05T09:00:00Z",
  },
  {
    code: "TK9012",
    name: "横浜市立緑小学校",
    password: "9012",
    created_at: "2025-07-10T09:00:00Z",
  },
];
