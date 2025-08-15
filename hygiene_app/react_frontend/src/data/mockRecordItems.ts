export interface RecordItem {
  id: number;
  recordId: number;
  category: string;
  is_normal: boolean;
  value: string | null;
}

export const mockRecordItems: RecordItem[] = 
[
  {
    "id": 1,
    "recordId": 1,
    "category": "temperature",
    "is_normal": true,
    "value": "36.7"
  },
  {
    "id": 2,
    "recordId": 1,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 3,
    "recordId": 1,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 4,
    "recordId": 2,
    "category": "temperature",
    "is_normal": true,
    "value": "36.3"
  },
  {
    "id": 5,
    "recordId": 2,
    "category": "no_health_issues",
    "is_normal": false,
    "value": "少し眠気あり"
  },
  {
    "id": 6,
    "recordId": 2,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 7,
    "recordId": 3,
    "category": "temperature",
    "is_normal": false,
    "value": "38.1"
  },
  {
    "id": 8,
    "recordId": 3,
    "category": "no_health_issues",
    "is_normal": false,
    "value": "頭痛あり"
  },
  {
    "id": 9,
    "recordId": 3,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 10,
    "recordId": 4,
    "category": "temperature",
    "is_normal": true,
    "value": "36.6"
  },
  {
    "id": 11,
    "recordId": 4,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 12,
    "recordId": 4,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 13,
    "recordId": 5,
    "category": "temperature",
    "is_normal": true,
    "value": "36.2"
  },
  {
    "id": 14,
    "recordId": 5,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 15,
    "recordId": 5,
    "category": "nails_groomed",
    "is_normal": false,
    "value": "爪が伸びていた"
  },
  {
    "id": 16,
    "recordId": 6,
    "category": "temperature",
    "is_normal": true,
    "value": "36.2"
  },
  {
    "id": 17,
    "recordId": 6,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 18,
    "recordId": 6,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 19,
    "recordId": 7,
    "category": "temperature",
    "is_normal": true,
    "value": "36.3"
  },
  {
    "id": 20,
    "recordId": 7,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 21,
    "recordId": 7,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 22,
    "recordId": 8,
    "category": "temperature",
    "is_normal": true,
    "value": "36.3"
  },
  {
    "id": 23,
    "recordId": 8,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 24,
    "recordId": 8,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 25,
    "recordId": 9,
    "category": "temperature",
    "is_normal": true,
    "value": "36.6"
  },
  {
    "id": 26,
    "recordId": 9,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 27,
    "recordId": 9,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 28,
    "recordId": 10,
    "category": "temperature",
    "is_normal": true,
    "value": "36.6"
  },
  {
    "id": 29,
    "recordId": 10,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 30,
    "recordId": 10,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 31,
    "recordId": 11,
    "category": "temperature",
    "is_normal": true,
    "value": "36.2"
  },
  {
    "id": 32,
    "recordId": 11,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 33,
    "recordId": 11,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 34,
    "recordId": 12,
    "category": "temperature",
    "is_normal": true,
    "value": "36.6"
  },
  {
    "id": 35,
    "recordId": 12,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 36,
    "recordId": 12,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 37,
    "recordId": 13,
    "category": "temperature",
    "is_normal": true,
    "value": "36.3"
  },
  {
    "id": 38,
    "recordId": 13,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 39,
    "recordId": 13,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 40,
    "recordId": 14,
    "category": "temperature",
    "is_normal": true,
    "value": "36.7"
  },
  {
    "id": 41,
    "recordId": 14,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 42,
    "recordId": 14,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 43,
    "recordId": 15,
    "category": "temperature",
    "is_normal": true,
    "value": "36.7"
  },
  {
    "id": 44,
    "recordId": 15,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 45,
    "recordId": 15,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 46,
    "recordId": 16,
    "category": "temperature",
    "is_normal": true,
    "value": "36.3"
  },
  {
    "id": 47,
    "recordId": 16,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 48,
    "recordId": 16,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 49,
    "recordId": 17,
    "category": "temperature",
    "is_normal": true,
    "value": "36.4"
  },
  {
    "id": 50,
    "recordId": 17,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 51,
    "recordId": 17,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 52,
    "recordId": 18,
    "category": "temperature",
    "is_normal": true,
    "value": "36.7"
  },
  {
    "id": 53,
    "recordId": 18,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 54,
    "recordId": 18,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 55,
    "recordId": 19,
    "category": "temperature",
    "is_normal": true,
    "value": "36.4"
  },
  {
    "id": 56,
    "recordId": 19,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 57,
    "recordId": 19,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 58,
    "recordId": 20,
    "category": "temperature",
    "is_normal": true,
    "value": "36.8"
  },
  {
    "id": 59,
    "recordId": 20,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 60,
    "recordId": 20,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 61,
    "recordId": 21,
    "category": "temperature",
    "is_normal": true,
    "value": "36.2"
  },
  {
    "id": 62,
    "recordId": 21,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 63,
    "recordId": 21,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 64,
    "recordId": 22,
    "category": "temperature",
    "is_normal": true,
    "value": "36.4"
  },
  {
    "id": 65,
    "recordId": 22,
    "category": "no_health_issues",
    "is_normal": false,
    "value": "倦怠感"
  },
  {
    "id": 66,
    "recordId": 22,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 67,
    "recordId": 23,
    "category": "temperature",
    "is_normal": true,
    "value": "36.4"
  },
  {
    "id": 68,
    "recordId": 23,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 69,
    "recordId": 23,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 70,
    "recordId": 24,
    "category": "temperature",
    "is_normal": true,
    "value": "36.6"
  },
  {
    "id": 71,
    "recordId": 24,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 72,
    "recordId": 24,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 73,
    "recordId": 25,
    "category": "temperature",
    "is_normal": true,
    "value": "36.2"
  },
  {
    "id": 74,
    "recordId": 25,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 75,
    "recordId": 25,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 76,
    "recordId": 26,
    "category": "temperature",
    "is_normal": true,
    "value": "36.8"
  },
  {
    "id": 77,
    "recordId": 26,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 78,
    "recordId": 26,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 79,
    "recordId": 27,
    "category": "temperature",
    "is_normal": true,
    "value": "36.6"
  },
  {
    "id": 80,
    "recordId": 27,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 81,
    "recordId": 27,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 82,
    "recordId": 28,
    "category": "temperature",
    "is_normal": true,
    "value": "36.2"
  },
  {
    "id": 83,
    "recordId": 28,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 84,
    "recordId": 28,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 85,
    "recordId": 29,
    "category": "temperature",
    "is_normal": true,
    "value": "36.2"
  },
  {
    "id": 86,
    "recordId": 29,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 87,
    "recordId": 29,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 88,
    "recordId": 30,
    "category": "temperature",
    "is_normal": true,
    "value": "36.5"
  },
  {
    "id": 89,
    "recordId": 30,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 90,
    "recordId": 30,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 91,
    "recordId": 31,
    "category": "temperature",
    "is_normal": true,
    "value": "36.7"
  },
  {
    "id": 92,
    "recordId": 31,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 93,
    "recordId": 31,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 94,
    "recordId": 32,
    "category": "temperature",
    "is_normal": true,
    "value": "36.4"
  },
  {
    "id": 95,
    "recordId": 32,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 96,
    "recordId": 32,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 97,
    "recordId": 33,
    "category": "temperature",
    "is_normal": true,
    "value": "36.7"
  },
  {
    "id": 98,
    "recordId": 33,
    "category": "no_health_issues",
    "is_normal": false,
    "value": "倦怠感あり"
  },
  {
    "id": 99,
    "recordId": 33,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 100,
    "recordId": 34,
    "category": "temperature",
    "is_normal": true,
    "value": "36.6"
  },
  {
    "id": 101,
    "recordId": 34,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 102,
    "recordId": 34,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 103,
    "recordId": 35,
    "category": "temperature",
    "is_normal": true,
    "value": "36.7"
  },
  {
    "id": 104,
    "recordId": 35,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 105,
    "recordId": 35,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 106,
    "recordId": 36,
    "category": "temperature",
    "is_normal": true,
    "value": "36.5"
  },
  {
    "id": 107,
    "recordId": 36,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 108,
    "recordId": 36,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 109,
    "recordId": 37,
    "category": "temperature",
    "is_normal": true,
    "value": "36.7"
  },
  {
    "id": 110,
    "recordId": 37,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 111,
    "recordId": 37,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 112,
    "recordId": 38,
    "category": "temperature",
    "is_normal": true,
    "value": "36.7"
  },
  {
    "id": 113,
    "recordId": 38,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 114,
    "recordId": 38,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 115,
    "recordId": 39,
    "category": "temperature",
    "is_normal": true,
    "value": "36.3"
  },
  {
    "id": 116,
    "recordId": 39,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 117,
    "recordId": 39,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 118,
    "recordId": 40,
    "category": "temperature",
    "is_normal": true,
    "value": "36.5"
  },
  {
    "id": 119,
    "recordId": 40,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 120,
    "recordId": 40,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 121,
    "recordId": 41,
    "category": "temperature",
    "is_normal": true,
    "value": "36.4"
  },
  {
    "id": 122,
    "recordId": 41,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 123,
    "recordId": 41,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 124,
    "recordId": 42,
    "category": "temperature",
    "is_normal": true,
    "value": "36.2"
  },
  {
    "id": 125,
    "recordId": 42,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 126,
    "recordId": 42,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 127,
    "recordId": 43,
    "category": "temperature",
    "is_normal": true,
    "value": "36.3"
  },
  {
    "id": 128,
    "recordId": 43,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 129,
    "recordId": 43,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 130,
    "recordId": 44,
    "category": "temperature",
    "is_normal": true,
    "value": "36.6"
  },
  {
    "id": 131,
    "recordId": 44,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 132,
    "recordId": 44,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 133,
    "recordId": 45,
    "category": "temperature",
    "is_normal": true,
    "value": "36.7"
  },
  {
    "id": 134,
    "recordId": 45,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 135,
    "recordId": 45,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 136,
    "recordId": 46,
    "category": "temperature",
    "is_normal": true,
    "value": "36.4"
  },
  {
    "id": 137,
    "recordId": 46,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 138,
    "recordId": 46,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 139,
    "recordId": 47,
    "category": "temperature",
    "is_normal": true,
    "value": "36.3"
  },
  {
    "id": 140,
    "recordId": 47,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 141,
    "recordId": 47,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 142,
    "recordId": 48,
    "category": "temperature",
    "is_normal": true,
    "value": "36.7"
  },
  {
    "id": 143,
    "recordId": 48,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 144,
    "recordId": 48,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 145,
    "recordId": 49,
    "category": "temperature",
    "is_normal": true,
    "value": "36.5"
  },
  {
    "id": 146,
    "recordId": 49,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 147,
    "recordId": 49,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 148,
    "recordId": 50,
    "category": "temperature",
    "is_normal": true,
    "value": "36.5"
  },
  {
    "id": 149,
    "recordId": 50,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 150,
    "recordId": 50,
    "category": "nails_groomed",
    "is_normal": false,
    "value": "身だしなみ不備"
  },
  {
    "id": 151,
    "recordId": 51,
    "category": "temperature",
    "is_normal": true,
    "value": "36.4"
  },
  {
    "id": 152,
    "recordId": 51,
    "category": "no_health_issues",
    "is_normal": false,
    "value": "咳あり"
  },
  {
    "id": 153,
    "recordId": 51,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 154,
    "recordId": 52,
    "category": "temperature",
    "is_normal": true,
    "value": "36.7"
  },
  {
    "id": 155,
    "recordId": 52,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 156,
    "recordId": 52,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 157,
    "recordId": 53,
    "category": "temperature",
    "is_normal": true,
    "value": "36.4"
  },
  {
    "id": 158,
    "recordId": 53,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 159,
    "recordId": 53,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 160,
    "recordId": 54,
    "category": "temperature",
    "is_normal": true,
    "value": "36.6"
  },
  {
    "id": 161,
    "recordId": 54,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 162,
    "recordId": 54,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 163,
    "recordId": 55,
    "category": "temperature",
    "is_normal": true,
    "value": "36.3"
  },
  {
    "id": 164,
    "recordId": 55,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 165,
    "recordId": 55,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 166,
    "recordId": 56,
    "category": "temperature",
    "is_normal": true,
    "value": "36.5"
  },
  {
    "id": 167,
    "recordId": 56,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 168,
    "recordId": 56,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 169,
    "recordId": 57,
    "category": "temperature",
    "is_normal": true,
    "value": "36.8"
  },
  {
    "id": 170,
    "recordId": 57,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 171,
    "recordId": 57,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 172,
    "recordId": 58,
    "category": "temperature",
    "is_normal": true,
    "value": "36.7"
  },
  {
    "id": 173,
    "recordId": 58,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 174,
    "recordId": 58,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 175,
    "recordId": 59,
    "category": "temperature",
    "is_normal": true,
    "value": "36.6"
  },
  {
    "id": 176,
    "recordId": 59,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 177,
    "recordId": 59,
    "category": "nails_groomed",
    "is_normal": false,
    "value": "名札未着用"
  },
  {
    "id": 178,
    "recordId": 60,
    "category": "temperature",
    "is_normal": true,
    "value": "36.5"
  },
  {
    "id": 179,
    "recordId": 60,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 180,
    "recordId": 60,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 181,
    "recordId": 61,
    "category": "temperature",
    "is_normal": true,
    "value": "36.6"
  },
  {
    "id": 182,
    "recordId": 61,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 183,
    "recordId": 61,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 184,
    "recordId": 62,
    "category": "temperature",
    "is_normal": true,
    "value": "36.8"
  },
  {
    "id": 185,
    "recordId": 62,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 186,
    "recordId": 62,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 187,
    "recordId": 63,
    "category": "temperature",
    "is_normal": true,
    "value": "36.7"
  },
  {
    "id": 188,
    "recordId": 63,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 189,
    "recordId": 63,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 190,
    "recordId": 64,
    "category": "temperature",
    "is_normal": true,
    "value": "36.8"
  },
  {
    "id": 191,
    "recordId": 64,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 192,
    "recordId": 64,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 193,
    "recordId": 65,
    "category": "temperature",
    "is_normal": true,
    "value": "36.4"
  },
  {
    "id": 194,
    "recordId": 65,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 195,
    "recordId": 65,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 196,
    "recordId": 66,
    "category": "temperature",
    "is_normal": true,
    "value": "36.5"
  },
  {
    "id": 197,
    "recordId": 66,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 198,
    "recordId": 66,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 199,
    "recordId": 67,
    "category": "temperature",
    "is_normal": true,
    "value": "36.6"
  },
  {
    "id": 200,
    "recordId": 67,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 201,
    "recordId": 67,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 202,
    "recordId": 68,
    "category": "temperature",
    "is_normal": false,
    "value": "38.0"
  },
  {
    "id": 203,
    "recordId": 68,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 204,
    "recordId": 68,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 205,
    "recordId": 69,
    "category": "temperature",
    "is_normal": true,
    "value": "36.8"
  },
  {
    "id": 206,
    "recordId": 69,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 207,
    "recordId": 69,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 208,
    "recordId": 70,
    "category": "temperature",
    "is_normal": true,
    "value": "36.3"
  },
  {
    "id": 209,
    "recordId": 70,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 210,
    "recordId": 70,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 211,
    "recordId": 71,
    "category": "temperature",
    "is_normal": true,
    "value": "36.8"
  },
  {
    "id": 212,
    "recordId": 71,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 213,
    "recordId": 71,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 214,
    "recordId": 72,
    "category": "temperature",
    "is_normal": true,
    "value": "36.8"
  },
  {
    "id": 215,
    "recordId": 72,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 216,
    "recordId": 72,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 217,
    "recordId": 73,
    "category": "temperature",
    "is_normal": true,
    "value": "36.6"
  },
  {
    "id": 218,
    "recordId": 73,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 219,
    "recordId": 73,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 220,
    "recordId": 74,
    "category": "temperature",
    "is_normal": true,
    "value": "36.2"
  },
  {
    "id": 221,
    "recordId": 74,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 222,
    "recordId": 74,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  },
  {
    "id": 223,
    "recordId": 75,
    "category": "temperature",
    "is_normal": true,
    "value": "36.8"
  },
  {
    "id": 224,
    "recordId": 75,
    "category": "no_health_issues",
    "is_normal": true,
    "value": null
  },
  {
    "id": 225,
    "recordId": 75,
    "category": "nails_groomed",
    "is_normal": true,
    "value": null
  }
];
