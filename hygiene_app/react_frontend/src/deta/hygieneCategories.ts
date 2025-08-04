export interface CategoryDefinition {
  key: string;
  label: string;
  section: string; // 表示セクション（例: 健康、服装など）
}

export const hygieneCategories: CategoryDefinition[] = [
  { key: "temperature", label: "体温", section: "体調" },
  { key: "no_health_issues", label: "本人に体調異常はないか", section: "体調" },
  { key: "family_no_symptoms", label: "同居者に症状はないか", section: "体調" },
  { key: "no_respiratory_symptoms", label: "咳や喉の腫れはない", section: "呼吸器" },
  { key: "no_severe_hand_damage", label: "重度の手荒れはないか", section: "手指" },
  { key: "no_mild_hand_damage", label: "軽度の手荒れないか", section: "手指" },
  { key: "nails_groomed", label: "爪・ひげは整っている", section: "服装" },
  { key: "proper_uniform", label: "服装が正しい", section: "服装" },
  { key: "no_work_illness", label: "作業中に体調不良・怪我等の発生はなかったか", section: "退勤時" },
  { key: "proper_handwashing", label: "手洗いは規定通りに実施した", section: "退勤時" },
];
