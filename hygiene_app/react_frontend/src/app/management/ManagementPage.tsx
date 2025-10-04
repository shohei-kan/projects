'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { UsersRound, Home, Calendar as CalendarIcon, Search, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import { TODAY_STR } from '@/data/mockDate'
import { loadSession } from '@/lib/session'

import {
  getDailyRows,
  getOfficeNames,
  getEmployeesForOffice,
  getBranchNameByCode,
  canConfirmRow,
  getRecordDetail,
  patchSupervisorConfirm,
  filterRowsByOffice,
  getMonthRowsByEmployeeId,
  type HygieneRecordRow,
  type EmployeeLite,
} from '@/lib/hygieneAdminAdapter'

type DetailItem = { category: string; label: string; section: string; is_normal: boolean; value: string | null }
type DetailState = (HygieneRecordRow & { comment: string; items: DetailItem[] }) | null

const fieldBase = 'h-10 w-full rounded-xl border text-sm leading-none focus-visible:outline-none focus-visible:ring-2'
const fieldMuted = 'bg-gray-50 border-gray-200 text-gray-700 focus-visible:ring-blue-200'
const triggerClass = `${fieldBase} ${fieldMuted} px-3 justify-between`
const inputWithIcon = `${fieldBase} ${fieldMuted} pl-10`

const chipOff = 'h-9 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
const chipOn = 'h-9 rounded-full bg-gray-400 text-white hover:bg-gray-300 border border-gray-900'

const statusBadge = (s: HygieneRecordRow['status']) => {
  const map: Record<HygieneRecordRow['status'], string> = {
    出勤入力済: 'bg-blue-50 text-blue-700 border border-blue-200',
    退勤入力済: 'bg-green-50 text-green-700 border border-green-200',
    未入力: 'bg-slate-50 text-slate-700 border border-slate-200',
  }
  return <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 ${map[s]}`}>{s}</Badge>
}

export interface HygieneManagementProps {
  onEmployeeListClick: () => void
  onBackToDashboard: () => void
}

export default function HygieneManagement({ onEmployeeListClick, onBackToDashboard }: HygieneManagementProps) {
  const session = loadSession()
  const isHQ = session?.user.role === 'hq_admin'
  const myBranchCode = isHQ ? '' : (session?.user.branchCode ?? '')

  const [mode, setMode] = useState<'daily' | 'monthly'>('daily')

  // 営業所
  const [officeNames, setOfficeNames] = useState<string[]>([])
  const [myOfficeName, setMyOfficeName] = useState<string>('')

  useEffect(() => {
    (async () => {
      const names = await getOfficeNames()
      setOfficeNames(names)
      if (!isHQ && myBranchCode) {
        const n = await getBranchNameByCode(myBranchCode)
        setMyOfficeName(n)
      }
    })()
  }, [isHQ, myBranchCode])

  const [selectedDate, setSelectedDate] = useState(new Date(TODAY_STR).toISOString().slice(0, 10))
  const ym = (selectedDate || TODAY_STR).slice(0, 7)

  const [selectedOffice, setSelectedOffice] = useState<string>(isHQ ? '' : '')
  useEffect(() => { if (!isHQ && myOfficeName) setSelectedOffice(myOfficeName) }, [isHQ, myOfficeName])

  // 従業員（構造化）
  const [employees, setEmployees] = useState<EmployeeLite[]>([])
  const [nameToId, setNameToId] = useState<Record<string, string>>({})
  const [idToName, setIdToName] = useState<Record<string, string>>({})
  const employeeOptions = useMemo(() => employees.map(e => e.name), [employees])

  useEffect(() => {
    (async () => {
      if (!selectedOffice) { setEmployees([]); setNameToId({}); setIdToName({}); return }
      const list = await getEmployeesForOffice(selectedOffice)
      setEmployees(list)
      const n2i: Record<string, string> = {}
      const i2n: Record<string, string> = {}
      for (const e of list) { n2i[e.name] = e.id; i2n[e.id] = e.name }
      setNameToId(n2i); setIdToName(i2n)
    })()
  }, [selectedOffice])

  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  useEffect(() => {
    if (mode === 'monthly' && !selectedEmployee && employees.length > 0) {
      setSelectedEmployee(employees[0].name)
    }
  }, [mode, employees, selectedEmployee])

  // 検索/フィルタ
  const [q, setQ] = useState('')
  const [abnormalOnly, setAbnormalOnly] = useState(false)
  const [commentOnly, setCommentOnly] = useState(false)
  const [unsubmittedOnly, setUnsubmittedOnly] = useState(false)

  // データ
  const [baseRows, setBaseRows] = useState<HygieneRecordRow[]>([])
  const [loading, setLoading] = useState(false)

  // 名前の補正（APIが employee=ID を返すだけの時に補う）
  const fixNames = (rows: HygieneRecordRow[]) =>
    rows.map((r) => {
      const eid = (r as any)._employeeId as string | undefined
      if (eid && /^\d+$/.test(r.employeeName) && idToName[eid]) {
        return { ...r, employeeName: idToName[eid] }
      }
      return r
    })

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        if (mode === 'daily') {
          if (!selectedOffice || !selectedDate) { setBaseRows([]); return }
          const raw = await getDailyRows(selectedOffice, selectedDate)
          const strict = await filterRowsByOffice(raw, selectedOffice)
          setBaseRows(fixNames(strict))
        } else {
          const empId = nameToId[selectedEmployee]
          if (!empId) { setBaseRows([]); return }
          const rows = await getMonthRowsByEmployeeId(empId, ym)
          setBaseRows(fixNames(rows))
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [mode, selectedOffice, selectedDate, selectedEmployee, ym, nameToId, idToName])

  const rows = baseRows

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (q && !r.employeeName.includes(q)) return false
      if (abnormalOnly && (r.abnormalItems?.length ?? 0) === 0) return false
      if (commentOnly && !r.hasAnyComment) return false
      if (unsubmittedOnly && r.status !== '未入力') return false
      return true
    })
  }, [rows, q, abnormalOnly, commentOnly, unsubmittedOnly])

  const abnormalUnconfirmedCount = filtered.filter(
    (r) => (r.abnormalItems?.length ?? 0) > 0 && !r.supervisorConfirmed
  ).length

  const userRole: 'hq_admin' | 'branch_manager' = isHQ ? 'hq_admin' : 'branch_manager'
  const userOffice = isHQ ? undefined : myOfficeName

  // 詳細
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<DetailState>(null)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">衛生チェック管理</h1>
            <p className="mt-1 text-sm text-gray-600">{isHQ ? '全営業所' : myOfficeName || '（営業所未設定）'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onEmployeeListClick} className="h-9 rounded-xl bg-blue-600 text-white hover:bg-blue-500 gap-2">
              <UsersRound className="h-4 w-4" />
              従業員一覧
            </Button>
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
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'daily' | 'monthly')}>
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
                      <Select value={selectedOffice} onValueChange={setSelectedOffice} disabled={!isHQ}>
                        <SelectTrigger className={triggerClass}>
                          <SelectValue placeholder="営業所を選択" />
                        </SelectTrigger>
                        <SelectContent className="z-[60] w-[220px] rounded-xl border bg-white border-gray-200 p-2 shadow-xl">
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
                        <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className={inputWithIcon} />
                      </div>
                    </div>

                    <div className="col-span-2 space-y-2 min-w-0">
                      <span className="text-sm font-medium">検索</span>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input placeholder="従業員名で検索" value={q} onChange={(e) => setQ(e.target.value)} className={inputWithIcon} />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* 月次 */}
                <TabsContent value="monthly" className="m-0">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-2 min-w-0">
                      <span className="text-sm font-medium">営業所</span>
                      <Select
                        value={selectedOffice}
                        onValueChange={(v) => { setSelectedOffice(v); setSelectedEmployee('') }}
                        disabled={!isHQ}
                      >
                        <SelectTrigger className={triggerClass}>
                          <SelectValue placeholder="営業所を選択" />
                        </SelectTrigger>
                        <SelectContent className="z-[60] w-[220px] bg-white rounded-xl border border-gray-200 p-1 shadow-xl">
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
                        <SelectContent className="z-[60] w-[240px] bg-white rounded-xl border border-gray-200 p-1 shadow-xl">
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
                        <Input placeholder="キーワード検索" value={q} onChange={(e) => setQ(e.target.value)} className={inputWithIcon} />
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            <Separator className="my-4" />

            {/* チップ */}
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => setAbnormalOnly(v => !v)} className={abnormalOnly ? chipOn : chipOff}>異常のみ</Button>
              <Button type="button" variant="outline" onClick={() => setCommentOnly(v => !v)} className={commentOnly ? chipOn : chipOff}>コメントあり</Button>
              <Button type="button" variant="outline" onClick={() => setUnsubmittedOnly(v => !v)} className={unsubmittedOnly ? chipOn : chipOff}>未入力のみ</Button>
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
          <span>最終更新: {new Date().toLocaleString('ja-JP')}</span>
        </div>

        {/* 異常未確認アラート */}
        {abnormalUnconfirmedCount > 0 && (
          <Alert variant="destructive" className="border-red-300 bg-red-50 text-red-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>異常あり</AlertTitle>
            <AlertDescription className="flex items-center gap-3">
              未確認の異常が {abnormalUnconfirmedCount} 件あります。
              <Button variant="outline" size="sm" onClick={() => setAbnormalOnly(true)}>異常のみ表示</Button>
            </AlertDescription>
          </Alert>
        )}

        {/* テーブル */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center text-gray-500">読み込み中…</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                {mode === 'daily' ? '営業所と日付を選択すると一覧が表示されます' : '従業員を選択すると一覧が表示されます'}
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
                      const canToggle = canConfirmRow({ role: isHQ ? 'hq_admin' : 'branch_manager', row: r, userOffice })
                      const canCheck = canToggle && r.status === '退勤入力済'
                      const abnormalLabels = r.abnormalItems ?? []
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">
                            <button
                              className="underline decoration-gray-300 hover:decoration-gray-700 underline-offset-2"
onClick={async () => {
    setDetail({ ...r, comment: '', items: [] })
    setDetailOpen(true)

    const d = await getRecordDetail(r.id) // ← admin 版

    const CATEGORY_LABELS: Record<string, {label: string; section: string}> = {
      temperature: { label: '体温', section: '体温・体調' },
      no_health_issues: { label: '体調異常なし', section: '体温・体調' },
      family_no_symptoms: { label: '同居者の症状なし', section: '体温・体調' },
      no_respiratory_symptoms: { label: '咳・喉の腫れなし', section: '呼吸器' },
      no_severe_hand_damage: { label: '手荒れ（重度）なし', section: '手指・爪' },
      no_mild_hand_damage: { label: '手荒れ（軽度）なし', section: '手指・爪' },
      nails_groomed: { label: '爪・ひげ整っている', section: '身だしなみ' },
      proper_uniform: { label: '服装が正しい', section: '身だしなみ' },
      no_work_illness: { label: '作業中の不調なし', section: '作業後' },
      proper_handwashing: { label: '手洗い実施', section: '作業後' },
    }

    const normalizeItems = (raw: any[]): DetailItem[] =>
      (Array.isArray(raw) ? raw : []).map((it: any) => {
        const cat = String(it?.category ?? it?.key ?? it?.code ?? '')
        const meta = CATEGORY_LABELS[cat] ?? { label: cat, section: '' }
        const isNormal = Boolean(it?.is_normal ?? it?.normal ?? it?.ok)
        const val = it?.comment ?? it?.value ?? null
        return {
          category: cat,
          label: meta.label,
          section: meta.section,
          is_normal: isNormal,
          value: val == null ? null : String(val),
        }
      })

    const items = normalizeItems((d as any)?.items ?? (d as any)?.record_items ?? [])
    const comment =
      items.filter(x => !x.is_normal && x.value)
           .map(x => `${x.label}: ${x.value}`)
           .join(' ／ ') || ''

    setDetail({ ...r, items, comment })
  }}
>
  {r.employeeName}
</button>                          </TableCell>
                          <TableCell className="text-gray-600">
                            {new Date(r.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                          </TableCell>
                          <TableCell className="text-gray-700">{abnormalLabels.length ? abnormalLabels.join(', ') : '-'}</TableCell>
                          <TableCell className="text-center text-lg text-red-400">{abnormalLabels.length ? '●' : ''}</TableCell>
                          <TableCell className="text-center">{r.hasAnyComment ? 'あり' : 'なし'}</TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              title={!canCheck ? '退勤入力済のみ確認できます' : undefined}
                              disabled={!canCheck}
                              checked={!!r.supervisorConfirmed}
                              onCheckedChange={async (checkedVal) => {
                                const checked = checkedVal === true
                                if (!canCheck) return
                                if (abnormalLabels.length > 0 && checked && !window.confirm('この記録には異常があります。確認済みにしますか？')) return
                                setBaseRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, supervisorConfirmed: checked } : x)))
                                try { await patchSupervisorConfirm(r.id, checked) }
                                catch {
                                  setBaseRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, supervisorConfirmed: !checked } : x)))
                                }
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

        <div className="text-center text-xs text-gray-500">ログイン中: {isHQ ? '本社管理者' : '支店管理者'}</div>

        {/* 詳細ダイアログ */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="sm:max-w-[760px] rounded-2xl bg-white">
            <DialogHeader>
              <DialogTitle>詳細</DialogTitle>
              <DialogDescription>従業員が入力した「異常項目ごとのコメント」をカテゴリ辞書に従って表示します。</DialogDescription>
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

                <div>
                  <div className="font-medium mb-2">異常項目とコメント：</div>
                  {detail.items?.filter((it) => !it.is_normal).length ? (
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      <div className="grid grid-cols-3 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        <div>セクション</div>
                        <div>項目</div>
                        <div>コメント（従業員）</div>
                      </div>
                      <div className="divide-y">
                        {detail.items.filter((it) => !it.is_normal).map((it: DetailItem, i: number) => (
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
