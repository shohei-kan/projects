import { useMemo, useState } from 'react'
import { UsersRound, Home,FileDown, FileText, ArrowLeft, Calendar, Search, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TODAY_STR } from '@/data/mockDate'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// アダプター（既存）
import {
  getDailyRows,
  getMonthRows,
  getOfficeNames,
  getEmployeeNames,
  loadSupervisorConfirm,
  canConfirmRow,
  type HygieneRecordRow,
  type StatusJP,
} from '@/lib/hygieneAdapter'

// モックAPI（mockRecordItems + カテゴリ辞書 連携）
import { mockPatchConfirm, mockFetchDetail, mockHasAnyComment, mockLoadRecordItems } from '@/lib/hygieneMockApi'

/* ======= Figma寄せの見た目トークン ======= */
const fieldBase =
  'h-10 w-full rounded-xl border text-sm leading-none focus-visible:outline-none focus-visible:ring-2'
const fieldMuted =
  'bg-gray-50 border-gray-200 text-gray-700 focus-visible:ring-blue-200'
const triggerClass = `${fieldBase} ${fieldMuted} px-3 justify-between`
const inputClass = `${fieldBase} ${fieldMuted} px-3`
const inputWithIcon = `${fieldBase} ${fieldMuted} pl-10`
const chipOff =
  'h-9 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
const chipOn =
  'h-9 rounded-full bg-gray-400 text-white hover:bg-gray-300 border border-gray-900'

const statusBadge = (s: StatusJP) => {
  const map: Record<StatusJP, string> = {
    出勤入力済: 'bg-blue-50 text-blue-700 border border-blue-200',
    退勤入力済: 'bg-green-50 text-green-700 border border-green-200',
    未入力: 'bg-slate-50 text-slate-700 border border-slate-200',
  }
  return (
    <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 ${map[s]}`}>
      {s}
    </Badge>
  )
}

export interface HygieneManagementProps {
  onEmployeeListClick: () => void
  onBackToDashboard: () => void
}

export default function HygieneManagement({
  onEmployeeListClick,
  onBackToDashboard,
}: HygieneManagementProps) {
  /* ---------- 表示モード ---------- */
  const [mode, setMode] = useState<'daily' | 'monthly'>('daily')

  /* ---------- フィルター ---------- */
  const officeNames = useMemo(() => getOfficeNames(), [])
  const [selectedOffice, setSelectedOffice] = useState<string>(officeNames[0] ?? '')
  const [selectedDate, setSelectedDate] = useState(
    new Date(TODAY_STR).toISOString().slice(0, 10),
  )

  // 個人月次の従業員選択（営業所連動で候補更新）
  const employeeOptions = useMemo(
    () => getEmployeeNames(selectedOffice),
    [selectedOffice],
  )
  const [selectedEmployee, setSelectedEmployee] = useState<string>(
    employeeOptions[0] ?? '',
  )

  // テキスト検索 & 絞り込みチップ
  const [q, setQ] = useState('')
  const [abnormalOnly, setAbnormalOnly] = useState(false)
  const [commentOnly, setCommentOnly] = useState(false)
  const [unsubmittedOnly, setUnsubmittedOnly] = useState(false)

  // 責任者確認（ロール）
  const [userRole] = useState<'hq_admin' | 'branch_manager'>('hq_admin')
  const [userOffice] = useState<string | undefined>(undefined)

  // ★ 再計算トリガ
  const [confirmVersion, setConfirmVersion] = useState(0)

  // ★ 詳細ダイアログの状態
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<null | (HygieneRecordRow & { comment: string; items: { category: string; label: string; section: string; is_normal: boolean; value: string | null }[] })>(null)

  // ★ データ取得（アダプター呼び出し）
  const baseRows: HygieneRecordRow[] = useMemo(() => {
    if (mode === 'daily') {
      if (!selectedOffice || !selectedDate) return []
      return getDailyRows(selectedOffice, selectedDate)
    }
    if (!selectedEmployee) return []
    return getMonthRows(selectedEmployee, TODAY_STR)
  }, [mode, selectedOffice, selectedDate, selectedEmployee])

  // ★ localStorage の確認状態を反映
  const rows = useMemo(() => {
    return baseRows.map((r) => {
      const saved = loadSupervisorConfirm(r.id)
      return saved === undefined ? r : { ...r, supervisorConfirmed: saved }
    })
  }, [baseRows, confirmVersion])

  // ★ 画面側のフィルター（コメントは実データで判定）
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (q && !r.employeeName.includes(q)) return false
      if (abnormalOnly && r.abnormalItems.length === 0) return false
      if (commentOnly && !mockHasAnyComment(r)) return false
      if (unsubmittedOnly && r.status !== '未入力') return false
      return true
    })
  }, [rows, q, abnormalOnly, commentOnly, unsubmittedOnly])

  const abnormalMark = (items: string[]) =>
    items.length === 0 ? '' : items.some((x) => x.includes('温') || x.includes('発熱')) ? '🔴' : '⚠️'

  // 未確認の異常件数（上部アラートに使用）
  const abnormalUnconfirmedCount = filtered.filter(
    (r) => r.abnormalItems.length > 0 && !r.supervisorConfirmed,
  ).length

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">衛生チェック管理</h1>
            <p className="mt-1 text-sm text-gray-600">従業員の健康管理記録を管理</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={onEmployeeListClick}
              className="h-9 rounded-xl bg-blue-600 text-white hover:bg-blue-500 gap-2"
            >
              <UsersRound className="h-4 w-4" />
              従業員一覧
            </Button>
            {/* <Button variant="outline" className="h-9 rounded-xl border-gray-300 text-gray-700 bg-white hover:bg-gray-50 gap-2">
              <FileDown className="h-4 w-4" /> */}
              {/* Excel出力
            </Button>
            <Button variant="outline" className="h-9 rounded-xl border-gray-300 text-gray-700 bg-white hover:bg-gray-50 gap-2">
              <FileText className="h-4 w-4" />
              PDF出力
            </Button> */}
            <Button variant="ghost" onClick={onBackToDashboard} className="h-9 rounded-xl text-gray-600 bg-gray-200 hover:bg-gray-100 gap-2">
              <Home className="h-10 w-10" />
               
            </Button>
          </div>
        </div>

        {/* 表示設定 */}
        <Card className="rounded-2xl border border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-gray-800">表示設定</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
              <TabsList className="grid w-full grid-cols-2 rounded-full bg-gray-100 p-1">
                <TabsTrigger value="daily" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  日次営業所表示
                </TabsTrigger>
                <TabsTrigger value="monthly" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  個人月次表示
                </TabsTrigger>
              </TabsList>

              <div className="mt-6">
                {/* 日次 */}
                <TabsContent value="daily" className="m-0">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div className="space-y-2 min-w-0">
                      <span className="text-sm font-medium">営業所</span>
                      <Select value={selectedOffice} onValueChange={setSelectedOffice}>
                        <SelectTrigger className={triggerClass}>
                          <SelectValue placeholder="営業所を選択" />
                        </SelectTrigger>
                        <SelectContent className="z-[60]  rounded-xl border bg-white border-gray-200 p-2 shadow-xl">
                          {officeNames.map((n) => (
                            <SelectItem key={n} value={n} className="rounded-md px-3 py-1 text-[14px] data-[highlighted]:bg-gray-100">
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 min-w-0">
                      <span className="text-sm font-medium">表示日</span>
                      <div className="relative">
                        <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className={inputWithIcon}
                        />
                      </div>
                    </div>

                    <div className="col-span-2 space-y-2 min-w-0">
                      <span className="text-sm font-medium">検索</span>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="従業員名で検索"
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                          className={inputWithIcon}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* 月次 */}
                <TabsContent value="monthly" className="m-0">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-2 min-w-0">
                      <span className="text-sm font-medium">営業所</span>
                      <Select value={selectedOffice} onValueChange={(v) => {
                        setSelectedOffice(v)
                        const list = getEmployeeNames(v)
                        setSelectedEmployee(list[0] ?? '')
                      }}>
                        <SelectTrigger className={triggerClass}>
                          <SelectValue placeholder="営業所を選択" />
                        </SelectTrigger>
                        <SelectContent className="z-[60] rounded-xl border border-gray-200 p-1 shadow-xl">
                          {officeNames.map((n) => (
                            <SelectItem key={n} value={n} className="rounded-md px-3 py-2 text-[14px] data-[highlighted]:bg-gray-100">
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 min-w-0">
                      <span className="text-sm font-medium">従業員</span>
                      <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                        <SelectTrigger className={triggerClass}>
                          <SelectValue placeholder="従業員を選択" />
                        </SelectTrigger>
                        <SelectContent className="z-[60] rounded-xl border border-gray-200 p-1 shadow-xl">
                          {employeeOptions.map((n) => (
                            <SelectItem key={n} value={n} className="rounded-md px-3 py-2 text-[14px] data-[highlighted]:bg-gray-100">
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 min-w-0">
                      <span className="text-sm font-medium">検索</span>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="キーワード検索"
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                          className={inputWithIcon}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            <Separator className="my-4" />

            {/* チップ */}
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => setAbnormalOnly((v) => !v)} className={abnormalOnly ? chipOn : chipOff}>
                 異常のみ
              </Button>
              <Button type="button" variant="outline" onClick={() => setCommentOnly((v) => !v)} className={commentOnly ? chipOn : chipOff}>
                 コメントあり
              </Button>
              <Button type="button" variant="outline" onClick={() => setUnsubmittedOnly((v) => !v)} className={unsubmittedOnly ? chipOn : chipOff}>
                 未入力のみ
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* サマリー */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            {mode === 'daily'
              ? `${selectedOffice || '（未選択）'} ${new Date(selectedDate || TODAY_STR).toLocaleDateString('ja-JP')} の記録：${filtered.length}件`
              : `${selectedEmployee || '（未選択）'} の今月の記録：${filtered.length}件`}
          </span>
          <span>最終更新: {new Date(TODAY_STR).toLocaleString('ja-JP')}</span>
        </div>

        {/* 異常未確認アラート */}
        {abnormalUnconfirmedCount > 0 && (
          <Alert variant="destructive" className="border-red-300 bg-red-50 text-red-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>異常あり</AlertTitle>
            <AlertDescription className="flex items-center gap-3">
              未確認の異常が {abnormalUnconfirmedCount} 件あります。
              <Button variant="outline" size="sm" onClick={() => setAbnormalOnly(true)}>
                異常のみ表示
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* テーブル */}
        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                {mode === 'daily'
                  ? '営業所と日付を選択すると一覧が表示されます'
                  : '従業員を選択すると一覧が表示されます'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="text-[14px]">
                  <TableHeader className="sticky top-0 z-10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
                    <TableRow className="bg-gray-50 [&>th]:py-3 [&>th]:text-gray-700">
                      <TableHead className="w-[18ch] font-semibold">従業員名</TableHead>
                      <TableHead className="w-[12ch] font-semibold">記録日</TableHead>
                      <TableHead className="w-[24ch] font-semibold">異常項目</TableHead>
                      <TableHead className="w-[8ch] text-center font-semibold">異常</TableHead>
                      <TableHead className="w-[10ch] text-center font-semibold">コメント</TableHead>
                      <TableHead className="w-[14ch] font-semibold">ステータス</TableHead>
                      <TableHead className="w-[14ch] text-center font-semibold">責任者確認</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="[&_tr]:border-b [&_tr]:border-gray-100 [&_tr]:transition-colors [&_tr:hover]:!bg-gray-50">
                    {filtered.map((r) => {
                      const canToggle = canConfirmRow({ role: userRole, row: r, userOffice })
                      // 異常の日本語ラベル（mockRecordItems + カテゴリ辞書から導出）
                      const abnormalLabels = mockLoadRecordItems(r)
                        .filter((it) => !it.is_normal)
                        .map((it) => it.label)
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">
                            <button
                              className="underline decoration-gray-300 hover:decoration-gray-700 underline-offset-2"
                              onClick={async () => {
                                setDetail({ ...r, comment: '', items: [] })
                                setDetailOpen(true)
                                const d = await mockFetchDetail(r)
                                setDetail(d)
                              }}
                            >
                              {r.employeeName}
                            </button>
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {new Date(r.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                          </TableCell>
                          <TableCell className="text-gray-700">
                            {abnormalLabels.length ? abnormalLabels.join(', ') : '-'}
                          </TableCell>
                          <TableCell className="text-center text-lg text-red-400">{abnormalLabels.length ? '●' : ''}</TableCell>
                          <TableCell className="text-center">{mockHasAnyComment(r) ? 'あり' : 'なし'}</TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              disabled={!canToggle}
                              checked={r.supervisorConfirmed}
                              onCheckedChange={async (checked) => {
                                if (abnormalLabels.length > 0 && !window.confirm('この記録には異常があります。確認済みにしますか？')) {
                                  return
                                }
                                await mockPatchConfirm(r.id, !!checked)
                                setConfirmVersion((v) => v + 1)
                              }}
                              className="mx-auto data-[state=checked]:bg-gray-900 data-[state=checked]:text-white"
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-gray-500">ログイン中: {userRole === 'hq_admin' ? '本社管理者' : '支店管理者'}</div>

        {/* 詳細ダイアログ */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="sm:max-w-[760px] rounded-2xl bg-white">
            <DialogHeader>
              <DialogTitle>詳細</DialogTitle>
              <DialogDescription>
                従業員が入力した「異常項目ごとのコメント」をカテゴリ辞書に従って表示します。
              </DialogDescription>
            </DialogHeader>

            {!detail ? (
              <div className="py-8 text-sm text-gray-500">読み込み中…</div>
            ) : (
              <div className="space-y-6 text-sm">
                <div className="flex justify-between">
                  <div>
                    <div className="text-gray-900 font-medium">{detail.employeeName}</div>
                    <div className="text-gray-500">{detail.officeName}</div>
                  </div>
                  <div>{new Date(detail.date).toLocaleDateString('ja-JP')}</div>
                </div>

                <Separator />

                

                {/* 異常項目 × コメント（セクション別） */}
                <div>
                  <div className="font-medium mb-2">異常項目とコメント：</div>
                  {detail.items?.filter(it => !it.is_normal).length ? (
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      <div className="grid grid-cols-3 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        <div>セクション</div>
                        <div>項目</div>
                        <div>コメント（従業員）</div>
                      </div>
                      <div className="divide-y">
                        {detail.items.filter(it => !it.is_normal).map((it, i) => (
                          <div key={i} className="grid grid-cols-3 px-3 py-2">
                            <div className="text-gray-900">{it.section || '—'}</div>
                            <div className="text-gray-900">{it.label}</div>
                            <div className="text-gray-700">{it.value || '—'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500">異常はありません</div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
