export interface Employee {
  code: string;
  name: string;
  branchCode: string;
  position: "general" | "branch_admin" | "manager";
  password?: string; // 管理者のみ
  is_active: boolean;
}

export const mockEmployees: Employee[] = [
  // 横浜営業所（YK1234）
  { code: "100001", name: "森 真樹", branchCode: "YK1234", position: "branch_admin", password: "0225", is_active: true },
  { code: "100002", name: "菅野 祥平", branchCode: "YK1234", position: "general", is_active: true },
  { code: "100003", name: "池田 菜乃", branchCode: "YK1234", position: "general", is_active: true },
  { code: "100004", name: "山田 次郎", branchCode: "YK1234", position: "general", is_active: true },
  { code: "100005", name: "鈴木 美咲", branchCode: "YK1234", position: "general", is_active: true },

  // 鎌倉営業所（KM5678）
  { code: "200001", name: "関 昌昭", branchCode: "KM5678", position: "branch_admin", password: "1234", is_active: true },
  { code: "200002", name: "飯田 竜平", branchCode: "KM5678", position: "general", is_active: true },
  { code: "200003", name: "渡辺 恵子", branchCode: "KM5678", position: "general", is_active: true },
  { code: "200004", name: "松本 大樹", branchCode: "KM5678", position: "general", is_active: true },
  { code: "200005", name: "中村 さゆり", branchCode: "KM5678", position: "general", is_active: true },

  // 東京営業所（TK9012）
  { code: "300001", name: "本部 太郎", branchCode: "TK9012", position: "manager", password: "0000", is_active: true },
  { code: "300002", name: "森 真樹", branchCode: "TK9012", position: "general", is_active: true },
  { code: "300003", name: "大野 未来", branchCode: "TK9012", position: "general", is_active: true },
  { code: "300004", name: "清水 健太", branchCode: "TK9012", position: "general", is_active: true },
  { code: "300005", name: "西村 純", branchCode: "TK9012", position: "general", is_active: true },
];
