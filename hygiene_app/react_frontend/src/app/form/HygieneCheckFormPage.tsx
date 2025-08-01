import { useState } from "react";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Checkbox } from "@components/ui/checkbox";
import { Textarea } from "@components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@components/ui/select";
import { Separator } from "@components/ui/separator";
import { Alert, AlertDescription } from "@components/ui/alert";


import {
  Calendar,
  User,
  Save,
  AlertTriangle,
  Heart,
  Wind,
  Hand,
  Shirt,
  ClipboardCheck,
  UserCheck,
  ChevronRight,
  CheckCircle,
  ChevronLeft,
  ArrowLeft,
  Home,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Fragment } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";



const employees = [
  "森 真樹",
  "菅野 祥平",
  "池田 菜乃",
  "鈴木 美咲",
  "高橋 健一",
  "伊藤 誠",
  "渡辺 恵子",
  "松本 大樹",
];

interface CheckItem {
  id: string;
  label: string;
  checked: boolean;
  requiresComment: boolean;
  comment: string;
  guidance?: string;
}

export default function DailyHygieneCheckForm() {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const navigate = useNavigate();

  
  const [step1Completed, setStep1Completed] = useState(false);
  
  const [basicInfo, setBasicInfo] = useState({
    date: new Date().toISOString().split("T")[0],
    employee: "",
    supervisor: "",
    temperature: "36.0",
  });

  const [healthChecks, setHealthChecks] = useState<CheckItem[]>(
    [
      {
        id: "no_health_issues",
        label:
          "本人に体調異常はないか（下痢・嘔吐・腹痛・発熱・倦怠感等）",
        checked: true,
        requiresComment: false,
        comment: "",
        guidance:
          "異常がある場合は直ちに責任者に報告し、作業を中止してください",
      },
      {
        id: "family_no_symptoms",
        label: "同居者に下痢・嘔吐・発熱の症状はないか",
        checked: true,
        requiresComment: false,
        comment: "",
        guidance:
          "症状がある場合は家族の健康状態を継続観察し、本人の健康管理を強化してください",
      },
    ],
  );

  const [respiratoryChecks, setRespiratoryChecks] = useState<
    CheckItem[]
  >([
    {
      id: "no_respiratory_symptoms",
      label: "咳や喉の腫れはない",
      checked: true,
      requiresComment: false,
      comment: "",
      guidance:
        "症状がある場合はマスク着用を徹底し、必要に応じて医療機関を受診してください",
    },
  ]);

  const [handHygieneChecks, setHandHygieneChecks] = useState<
    CheckItem[]
  >([
    {
      id: "no_severe_hand_damage",
      label: "重度の手荒れはないか",
      checked: true,
      requiresComment: false,
      comment: "",
      guidance:
        "重度の手荒れがある場合は適切な保護手袋を着用し、治療を受けてください",
    },
    {
      id: "no_mild_hand_damage",
      label: "軽度の手荒れないか",
      checked: true,
      requiresComment: false,
      comment: "",
      guidance:
        "軽度の手荒れがある場合は保護クリーム使用し、手洗い後の保湿を心がけてください",
    },
  ]);

  const [uniformHygieneChecks, setUniformHygieneChecks] =
    useState<CheckItem[]>([
      {
        id: "nails_groomed",
        label: "爪・ひげは整っている",
        checked: true,
        requiresComment: false,
        comment: "",
        guidance:
          "整っていない場合は作業前に必ず爪を短く切り、ひげを剃って清潔にしてください",
      },
      {
        id: "proper_uniform",
        label: "服装が正しい",
        checked: true,
        requiresComment: false,
        comment: "",
        guidance:
          "服装が不適切な場合は規定の作業服・帽子・履物に着替えてから作業を開始してください",
      },
    ]);

  const [postWorkChecks, setPostWorkChecks] = useState<
    CheckItem[]
  >([
    {
      id: "no_work_illness",
      label: "作業中に体調不良・怪我等の発生はなかったか",
      checked: true,
      requiresComment: false,
      comment: "",
      guidance:
        "発生した場合は直ちに作業を中止し、責任者に報告してください",
    },
    {
      id: "proper_handwashing",
      label: "手洗いは規定通りに実施した",
      checked: true,
      requiresComment: false,
      comment: "",
      guidance:
        "未実施の場合は直ちに規定の手洗い手順（石鹸で30秒以上）を実施してください",
    },
  ]);

  const [confirmerInfo, setConfirmerInfo] = useState({
    confirmer: "",
  });

  const [finalConfirmation, setFinalConfirmation] = useState({
    directorSignature: "",
  });

  const updateCheckItem = (
    items: CheckItem[],
    setItems: React.Dispatch<React.SetStateAction<CheckItem[]>>,
    id: string,
    checked: boolean,
    comment?: string,
  ) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          const updatedItem = {
            ...item,
            checked,
            requiresComment: !checked,
          };
          if (comment !== undefined) {
            updatedItem.comment = comment;
          } else if (checked) {
            updatedItem.comment = "";
          }
          return updatedItem;
        }
        return item;
      }),
    );
  };

  const handleStep1Save = () => {
    // Validate step 1 data
    const step1Issues = [
      ...healthChecks,
      ...respiratoryChecks,
      ...handHygieneChecks,
      ...uniformHygieneChecks,
    ].some(
      (item) => !item.checked && item.comment.trim() === "",
    );

    if (step1Issues) {
      alert(
        "異常が報告されている項目について、詳細コメントが必要です。",
      );
      return;
    }

    if (!basicInfo.employee || !basicInfo.supervisor) {
      alert("従業員名と確認者名を入力してください。");
      return;
    }

    // Save step 1 data (in real app, this would be saved to backend)
    setStep1Completed(true);
    alert("出勤時チェックを保存しました");
    navigate("/dashboard");
  };

  const handleGoBack = () => {
    setCurrentStep(1);
  };

  const handleFinalSubmit = () => {
    const step2Issues = postWorkChecks.some(
      (item) => !item.checked && item.comment.trim() === "",
    );

    if (step2Issues) {
      alert(
        "異常が報告されている項目について、詳細コメントが必要です。",
      );
      return;
    }

    if (!finalConfirmation.directorSignature) {
      alert("所長又は責任者のサインを入力してください。");
      return;
    }

    alert("衛生チェックフォームが最終送信されました");
  };

  const CompactCheckboxSection = ({
    title,
    items,
    setItems,
    headerColor = "blue",
    icon: Icon,
    className = "",
  }: {
    title: string;
    items: CheckItem[];
    setItems: React.Dispatch<React.SetStateAction<CheckItem[]>>;
    headerColor?:
      | "blue"
      | "green"
      | "orange"
      | "purple"
      | "teal";
    icon?: React.ComponentType<any>;
    className?: string;
  }) => {
    const getHeaderColors = (color: string) => {
      switch (color) {
        case "green":
          return "bg-emerald-50 border-emerald-200 text-emerald-800";
        case "orange":
          return "bg-orange-50 border-orange-200 text-orange-800";
        case "purple":
          return "bg-purple-50 border-purple-200 text-purple-800";
        case "teal":
          return "bg-teal-50 border-teal-200 text-teal-800";
        default:
          return "bg-blue-50 border-blue-200 text-blue-800";
      }
    };

    const getIconColors = (color: string) => {
      switch (color) {
        case "green":
          return "text-emerald-600";
        case "orange":
          return "text-orange-600";
        case "purple":
          return "text-purple-600";
        case "teal":
          return "text-teal-600";
        default:
          return "text-blue-600";
      }
    };

    const hasIssues = items.some(item => !item.checked);
    const isComplete = !items.some(item => !item.checked && item.comment.trim() === "");

    return (
      <Card
        className={`border-gray-200 overflow-hidden h-fit ${className} ${hasIssues ? 'ring-2 ring-amber-200' : ''}`}
      >
        <CardHeader
          className={`pb-3 ${getHeaderColors(headerColor)} relative`}
        >
          <CardTitle className="flex items-center gap-2 text-sm">
            {Icon && (
              <Icon
                className={`w-4 h-4 ${getIconColors(headerColor)}`}
              />
            )}
            {title}
            {isComplete && (
              <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />
            )}
            {hasIssues && !isComplete && (
              <AlertTriangle className="w-4 h-4 text-amber-600 ml-auto" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4 pb-4">
          {items.map((item) => (
            <div key={item.id} className="space-y-2">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id={item.id}
                  checked={item.checked}
                  onCheckedChange={(checked) =>
                    updateCheckItem(
                      items,
                      setItems,
                      item.id,
                      checked as boolean,
                    )
                  }
                  className={`border-gray-300 mt-0.5 ${item.checked ? "data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600" : ""}`}
                />
                <div className="flex-1">
                  <span
                    
                    className={`cursor-pointer leading-relaxed text-sm ${item.checked ? "text-gray-900" : "text-red-700 font-medium"}`}
                  >
                    {item.label}
                  </span>
                  {!item.checked && item.guidance && (
                    <div className="mt-2">
                      <Alert className="border-amber-200 bg-amber-50 py-2 px-3">
                        <AlertDescription className="text-amber-800 text-xs leading-tight">
                          {item.guidance}
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </div>
              </div>
              {item.requiresComment && (
                <div className="ml-5 space-y-1">
                  <span
                    
                    className="text-red-600 text-xs"
                  >
                    詳細をご記入ください（必須）
                  </span>
                  <Textarea
                    id={`${item.id}-comment`}
                    placeholder="症状や状況の詳細を記入してください"
                    value={item.comment}
                    onChange={(e) =>
                      updateCheckItem(
                        items,
                        setItems,
                        item.id,
                        item.checked,
                        e.target.value,
                      )
                    }
                    className="border-red-200 focus:border-red-400 bg-red-50 text-sm"
                    rows={2}
                  />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-4 relative">
      <div className="max-w-7xl mx-auto px-4">
          {/* 右上の戻るボタン */}
  <button
    onClick={() => navigate("/dashboard")}
    className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition"
    aria-label="ホームへ"
  >
    <Home className="w-5 h-5 text-gray-600" />
  </button>

        {/* Header with title and step indicator */}
        <div className="mb-6">
          <h1 className="text-2xl font-medium text-gray-900 mb-4">
            日次衛生チェックフォーム
          </h1>
          
          {/* Step Indicator with Buttons */}
<div className="flex items-center justify-center mb-4 space-x-4">
  <Button
    variant={currentStep === 1 ? "default" : "outline"}
    className={`text-sm px-6 py-2 ${
      currentStep === 1
        ? "bg-blue-600 text-white hover:bg-blue-700"
        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
    }`}
    onClick={() => setCurrentStep(1)}
  >
    出勤時チェック
  </Button>
  <Button
    variant={currentStep === 2 ? "default" : "outline"}
    className={`text-sm px-6 py-2 ${
      currentStep === 2
        ? "bg-blue-600 text-white hover:bg-blue-700"
        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
    }`}
    onClick={() => setCurrentStep(2)}
  >
    退勤時チェック
  </Button>
</div>


          <p className="text-gray-600 text-sm text-center">
            {currentStep === 1 
              ? "出勤時の衛生管理項目を確認し、記録してください" 
              : "作業後の確認項目をチェックしてください"
            }
          </p>
        </div>

        {currentStep === 1 ? (
          /* Step 1: Check-in */
          <>
            {/* 基本情報 - 上部に全幅で配置 */}
            <div className="mb-8">
              <Card className={`border-gray-200 ${(!basicInfo.employee || !basicInfo.supervisor) ? 'ring-2 ring-amber-200' : ''}`}>
{/* /yyy */}
                <CardHeader>
  <div className="flex items-center justify-between w-full">
    <div className="flex items-center space-x-2">
      <Calendar className="w-5 h-5 text-gray-500" />
      <CardTitle className="text-gray-700 text-lg">基本情報</CardTitle>
    </div>

    {basicInfo.employee && (
      <div className="flex items-center justify-center flex-1">
        <p className="text-3xl text-gray-700 font-semibold text-center">
          👤 {basicInfo.employee}
        </p>
      </div>
    )}
  </div>
</CardHeader>


                <CardContent className="space-y-4 pt-4 pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <span
                        
                        className="text-gray-900 text-sm"
                      >
                        日付
                      </span>
                      <Input
                        id="date"
                        type="date"
                        value={basicInfo.date}
                        onChange={(e) =>
                          setBasicInfo({
                            ...basicInfo,
                            date: e.target.value,
                          })
                        }
                        className="border-gray-300 text-sm"
                      />
                    </div>
                    {/* <div className="space-y-1">
                      <span className="text-gray-900 text-sm">
  従業員名
</span> */}
{/* <Select
  value={employees.includes(basicInfo.employee) ? basicInfo.employee : ""}
  onValueChange={(value) =>
    setBasicInfo({
      ...basicInfo,
      employee: value,
    })
  }
>
  <SelectTrigger className={`text-sm ${!basicInfo.employee ? 'border-amber-300 bg-amber-50' : 'border-gray-300'}`}>
    <SelectValue placeholder="従業員を選択" />
  </SelectTrigger>
  <SelectContent  className="bg-white text-gray-800 border border-gray-200 shadow-md">
  {employees.map((employee) => (
    <SelectItem
      key={employee}
      value={employee}
      className="hover:bg-blue-100 focus:bg-blue-100 focus:text-blue-700"
    >
      {employee}
    </SelectItem>
  ))}
</SelectContent>

</Select> */}
<div className="space-y-1">
  <span className="text-gray-900 text-sm">従業員名</span>

  <Listbox
    value={basicInfo.employee}
    onChange={(value) =>
      setBasicInfo({ ...basicInfo, employee: value })
    }
  >
    <div className="relative">
      <Listbox.Button
        className={`relative w-full cursor-default rounded-md border px-3 py-2 text-left text-sm focus:outline-none ${
          !basicInfo.employee
            ? "border-amber-300 bg-amber-50"
            : "border-gray-300 bg-white"
        }`}
      >
        <span className="block truncate">
          {basicInfo.employee || "従業員を選択"}
        </span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <ChevronUpDownIcon className="h-4 w-4 text-gray-400" />
        </span>
      </Listbox.Button>

      <Transition
        as={Fragment}
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <Listbox.Options className="absolute z-[9999] mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          {employees.map((employee) => (
            <Listbox.Option
              key={employee}
              className={({ active }) =>
                `relative cursor-default select-none py-2 pl-10 pr-4 ${
                  active ? "bg-blue-100 text-blue-700" : "text-gray-900"
                }`
              }
              value={employee}
            >
              {({ selected }) => (
                <>
                  <span
                    className={`block truncate ${
                      selected ? "font-medium" : "font-normal"
                    }`}
                  >
                    {employee}
                  </span>
                  {selected ? (
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                      <CheckIcon className="h-4 w-4" aria-hidden="true" />
                    </span>
                  ) : null}
                </>
              )}
            </Listbox.Option>
          ))}
        </Listbox.Options>
      </Transition>
    </div>
  </Listbox>
</div>


                    {/* </div> */}
                    <div className="space-y-1">
                     <span className="text-gray-900 text-sm">
  確認者名
</span>
{/* <Select
  value={basicInfo.supervisor}
  onValueChange={(value) =>
    setBasicInfo({
      ...basicInfo,
      supervisor: value,
    })
  }
>
  <SelectTrigger
    
    className={`text-sm ${
      !basicInfo.supervisor ? 'border-amber-300 bg-amber-50' : 'border-gray-300'
    }`}
  >
    <SelectValue placeholder="確認者を選択" />
  </SelectTrigger>
  <SelectContent  className="bg-white text-gray-800 border border-gray-200 shadow-md">
  {employees.map((employee) => (
    <SelectItem
      key={employee}
      value={employee}
      className="hover:bg-blue-100 focus:bg-blue-100 focus:text-blue-700"
    >
      {employee}
    </SelectItem>
  ))}
</SelectContent>

</Select> */}
<Listbox
    value={basicInfo.supervisor}
    onChange={(value) =>
      setBasicInfo({ ...basicInfo, supervisor: value })
    }
  >
    <div className="relative">
      <Listbox.Button
        className={`relative w-full cursor-default rounded-md border px-3 py-2 text-left text-sm focus:outline-none ${
          !basicInfo.supervisor
            ? "border-amber-300 bg-amber-50"
            : "border-gray-300 bg-white"
        }`}
      >
        <span className="block truncate">
          {basicInfo.supervisor || "確認者を選択"}
        </span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <ChevronUpDownIcon className="h-4 w-4 text-gray-400" />
        </span>
      </Listbox.Button>
      <Transition
        as={Fragment}
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          {employees.map((employee) => (
            <Listbox.Option
              key={employee}
              className={({ active }) =>
                `relative cursor-default select-none py-2 pl-10 pr-4 ${
                  active ? "bg-blue-100 text-blue-700" : "text-gray-900"
                }`
              }
              value={employee}
            >
              {({ selected }) => (
                <>
                  <span
                    className={`block truncate ${
                      selected ? "font-medium" : "font-normal"
                    }`}
                  >
                    {employee}
                  </span>
                  {selected ? (
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                      <CheckIcon className="h-4 w-4" aria-hidden="true" />
                    </span>
                  ) : null}
                </>
              )}
            </Listbox.Option>
          ))}
        </Listbox.Options>
      </Transition>
    </div>
  </Listbox>


                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 左列 */}
              <div className="space-y-6">
                {/* 体温・体調チェック */}
                <Card className={`border-gray-200 overflow-hidden ${healthChecks.some(item => !item.checked) ? 'ring-2 ring-amber-200' : ''}`}>
                  <CardHeader className="pb-3 bg-emerald-50 border-emerald-200">
                    <CardTitle className="text-emerald-800 flex items-center gap-2 text-sm">
                      <Heart className="w-4 h-4 text-emerald-600" />
                      体温・体調チェック
                      {!healthChecks.some(item => !item.checked && item.comment.trim() === "") && (
                        <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />
                      )}
                      {healthChecks.some(item => !item.checked) && healthChecks.some(item => !item.checked && item.comment.trim() === "") && (
                        <AlertTriangle className="w-4 h-4 text-amber-600 ml-auto" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4 pb-4">
                    <div className="space-y-1">
                      <span
                        className="text-gray-900 text-sm"
                      >
                        体温（℃）
                      </span>
                      <div className="flex items-center gap-3">
                        <Input
                          id="temperature"
                          type="number"
                          step="0.1"
                          min="35.0"
                          max="42.0"
                          value={basicInfo.temperature}
                          onChange={(e) =>
                            setBasicInfo({
                              ...basicInfo,
                              temperature: e.target.value,
                            })
                          }
                          className={`w-24 text-sm ${parseFloat(basicInfo.temperature) >= 37.5 ? "border-red-300 bg-red-50" : "border-gray-300"}`}
                        />
                        {parseFloat(basicInfo.temperature) >=
                          37.5 && (
                          <Alert className="border-red-200 bg-red-50 flex-1 py-2 px-3">
                            <AlertTriangle className="h-3 w-3 text-red-600" />
                            <AlertDescription className="text-red-800 text-xs">
                              発熱確認。責任者に報告し、作業中止してください。
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>
                    <Separator className="bg-gray-200" />
                    <div className="space-y-3">
                      {healthChecks.map((item) => (
                        <div key={item.id} className="space-y-2">
                          <div className="flex items-start space-x-2">
                            <Checkbox
                              id={item.id}
                              checked={item.checked}
                              onCheckedChange={(checked) =>
                                updateCheckItem(
                                  healthChecks,
                                  setHealthChecks,
                                  item.id,
                                  checked as boolean,
                                )
                              }
                              className={`border-gray-300 mt-0.5 ${item.checked ? "data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600" : ""}`}
                            />
                            <div className="flex-1">
                              <span
                                className={`cursor-pointer leading-relaxed text-sm ${item.checked ? "text-gray-900" : "text-red-700 font-medium"}`}
                              >
                                {item.label}
                              </span>
                              {!item.checked && item.guidance && (
                                <div className="mt-2">
                                  <Alert className="border-amber-200 bg-amber-50 py-2 px-3">
                                    <AlertDescription className="text-amber-800 text-xs leading-tight">
                                      {item.guidance}
                                    </AlertDescription>
                                  </Alert>
                                </div>
                              )}
                            </div>
                          </div>
                          {item.requiresComment && (
                            <div className="ml-5 space-y-1">
                              <span
                                className="text-red-600 text-xs"
                              >
                                詳細をご記入ください（必須）
                              </span>
                              <Textarea
                                id={`${item.id}-comment`}
                                placeholder="症状や状況の詳細を記入してください"
                                value={item.comment}
                                onChange={(e) =>
                                  updateCheckItem(
                                    healthChecks,
                                    setHealthChecks,
                                    item.id,
                                    item.checked,
                                    e.target.value,
                                  )
                                }
                                className="border-red-200 focus:border-red-400 bg-red-50 text-sm"
                                rows={2}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* 呼吸器症状 */}
                <CompactCheckboxSection
                  title="呼吸器症状"
                  items={respiratoryChecks}
                  setItems={setRespiratoryChecks}
                  headerColor="blue"
                  icon={Wind}
                />
              </div>

              {/* 右列 */}
              <div className="space-y-6">
                {/* 手指・爪の状態 */}
                <CompactCheckboxSection
                  title="手指・爪の状態"
                  items={handHygieneChecks}
                  setItems={setHandHygieneChecks}
                  headerColor="orange"
                  icon={Hand}
                />

                {/* 服装チェック */}
                <CompactCheckboxSection
                  title="服装チェック"
                  items={uniformHygieneChecks}
                  setItems={setUniformHygieneChecks}
                  headerColor="purple"
                  icon={Shirt}
                />
              </div>
            </div>

            {/* Step 1 Save Button */}
            <div className="flex justify-center mt-8 pb-8">
              <Button
                onClick={handleStep1Save}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-base gap-2 shadow-lg"
              >
                <Save className="w-5 h-5" />
                出勤時チェックを保存
              </Button>
            </div>
          </>
        ) : (
          /* Step 2: Check-out */
          <>
            <div className="max-w-4xl mx-auto">
              {/* 作業後のチェック */}
              <div className="mb-8">
                <CompactCheckboxSection
                  title="作業後のチェック"
                  items={postWorkChecks}
                  setItems={setPostWorkChecks}
                  headerColor="teal"
                  icon={ClipboardCheck}
                />
              </div>

              {/* 所長又は責任者の確認
              <div className="mb-8">
                <Card className={`border-gray-200 overflow-hidden ${!finalConfirmation.directorSignature ? 'ring-2 ring-amber-200' : ''}`}>
                  <CardHeader className="pb-3 bg-gray-100 border-gray-300">
                    <CardTitle className="text-gray-800 flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-gray-600" />
                      所長又は責任者の確認
                      {finalConfirmation.directorSignature && (
                        <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4 pb-4">
                    <div className="space-y-1">
                      <span
                        className="text-gray-900 text-sm"
                      >
                        所長又は責任者サイン
                      </span>
                      <Input
                        id="directorSignature"
                        placeholder="所長又は責任者のサインを入力してください"
                        value={finalConfirmation.directorSignature}
                        onChange={(e) =>
                          setFinalConfirmation({
                            ...finalConfirmation,
                            directorSignature: e.target.value,
                          })
                        }
                        className={`text-sm ${!finalConfirmation.directorSignature ? 'border-amber-300 bg-amber-50' : 'border-gray-300'}`}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div> */}

              {/* Step 2 Buttons */}
              <div className="flex justify-center gap-4 pb-8">
                <Button
                  onClick={handleGoBack}
                  variant="outline"
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-3 text-base gap-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                  出勤時チェックへ
                </Button>
                <Button
                  onClick={handleFinalSubmit}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 text-base gap-2 shadow-lg"
                >
                  <Save className="w-5 h-5" />
                  登録
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}