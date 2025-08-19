// 本部ユーザー（営業所に属さない）
export interface Admin {
  id: string;          // 数字6桁
  password: string;    // 数字6桁
  name: string;
  role: "hq_admin";
  branchCode: null;    // 所属なしを明示
  is_active: boolean;
}

export const mockAdmins: Admin[] = [
  { id: "100001", password: "654321", name: "本部 太郎", role: "hq_admin", branchCode: null, is_active: true },
  { id: "100002", password: "123456", name: "本部 花子", role: "hq_admin", branchCode: null, is_active: true },
];
