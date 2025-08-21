'use client'

import { useMemo, useState } from 'react'
import { Search, Plus, Edit, Trash2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

// セッション
import { loadSession } from '@/lib/session'

// モック & 型
import { mockEmployees, mockBranches } from '@/data'
import type { Employee as MockEmployee } from '@/data'

/* =========================
   UI 共通クラス
   ========================= */
const CONTROL_H = '!h-8 !min-h-8'
const TEXT = 'text-[15px] leading-[1.25rem]'
const base = `w-full ${CONTROL_H} ${TEXT} rounded-xl border border-gray-200 bg-gray-100 focus-visible:outline-none`
export const inputPlain = `${base} px-3 py-0 placeholder:text-gray-400`
export const inputWithIcon = `${base} pl-11 pr-10 py-0 placeholder:text-gray-400`
export const selectTrigger = `${base} px-3 py-0 flex items-center justify-between data-[placeholder]:text-gray-400`
export const contentClass = 'z-[70] rounded-xl bg-white ring-1 ring-gray-200 shadow-xl p-1 min-w-[var(--radix-select-trigger-width)]'
export const itemClass = 'rounded-md px-3 py-2 text-[14px] outline-none cursor-pointer data-[highlighted]:bg-gray-100 data-[state=checked]:bg-gray-100 data-[state=checked]:font-medium'
const panelClass =
  'rounded-2xl border border-gray-200 bg-white/80 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.04)] backdrop-blur supports-[backdrop-filter]:bg-white/60'

/* =========================
   型
   ========================= */
type Position = '一般' | '所長' | '副所長' | '本部'
type EmployeeRow = {
  id: string
  name: string
  personalCode: string
  office: string
  position: Position
}
export interface EmployeeListProps {
  onBack: () => void
}
type Option = { value: string; label: string };

/* =========================
   変換ユーティリティ
   ========================= */
const toPositionLabel = (pos: MockEmployee['position']): Position => {
  switch (pos) {
    case 'general': return '一般'
    case 'branch_admin': return '所長'
    case 'manager': return '本部'
  }
}

/* =========================
   本体
   ========================= */
export function EmployeeList({ onBack }: EmployeeListProps) {
  const session = loadSession()
  const isHQ = session?.user.role === 'hq_admin'
  const myBranchCode = isHQ ? '' : (session?.user.branchCode ?? '')
  const myOfficeName = useMemo(() => {
    const b = mockBranches.find((x) => x.code === myBranchCode)
    return b ? b.name : ''
  }, [myBranchCode])

  // 初期データ：本部=全社 / 営業所管理者=自所のみ
  const initialEmployees: EmployeeRow[] = useMemo(() => {
    const src = isHQ ? mockEmployees : mockEmployees.filter(e => e.branchCode === myBranchCode)
    const branchNameFromCode = (code: string) => mockBranches.find((x) => x.code === code)?.name ?? code
    return src.map((m) => ({
      id: `emp-${m.code}`,
      name: m.name,
      personalCode: m.code,
      office: branchNameFromCode(m.branchCode),
      position: toPositionLabel(m.position),
    }))
  }, [isHQ, myBranchCode])

  const [employees, setEmployees] = useState<EmployeeRow[]>(initialEmployees)

  // 営業所フィルター選択肢：本部=全社 / 営業所=自所のみ
  const officeOptions = useMemo<Option[]>(() => {
  if (isHQ) {
    const officeNames = Array.from(new Set(mockBranches.map((b) => b.name)));
    return [{ value: 'all', label: '全営業所' }, ...officeNames.map((n) => ({ value: n, label: n }))];
  }
  // 営業所管理者は自所のみ／なければ空配列（any禁止）
  return myOfficeName ? [{ value: myOfficeName, label: myOfficeName }] : [];
}, [isHQ, myOfficeName]);


  const [selectedOffice, setSelectedOffice] = useState<'all' | string>(isHQ ? 'all' : (myOfficeName || 'all'))
  const [selectedPosition, setSelectedPosition] = useState<'all' | Position>('all')

  // 検索
  const [nameQuery, setNameQuery] = useState('')
  const [codeQuery, setCodeQuery] = useState('')

  // モーダル
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRow | null>(null)
  const [newEmployee, setNewEmployee] = useState<Partial<EmployeeRow>>({
    name: '',
    personalCode: '',
    office: isHQ ? '' : myOfficeName,
    position: '一般',
  })

  // バリデーション
  type AddErrors = { name?: string; personalCode?: string; office?: string; position?: string }
  const validateNewEmployee = (e: Partial<EmployeeRow>, existing: EmployeeRow[]): AddErrors => {
    const errors: AddErrors = {}
    if (!e.name || !e.name.trim()) errors.name = '氏名は必須です'
    else if (e.name.trim().length < 2) errors.name = '2文字以上で入力してください'
    const code = (e.personalCode ?? '').trim()
    if (!code) errors.personalCode = '個人コードは必須です'
    else if (!/^\d{6}$/.test(code)) errors.personalCode = '6桁の数字で入力してください'
    else if (existing.some((emp) => emp.personalCode === code)) errors.personalCode = 'この個人コードは既に使われています'
    if (!e.office) errors.office = '営業所を選択してください'
    if (!e.position) errors.position = '役職を選択してください'
    return errors
  }
  type EditErrors = { name?: string; personalCode?: string; office?: string; position?: string }
  const validateEditEmployee = (e: EmployeeRow | null, existing: EmployeeRow[]): EditErrors => {
    const errors: EditErrors = {}
    if (!e) return errors
    if (!e.name || !e.name.trim()) errors.name = '氏名は必須です'
    else if (e.name.trim().length < 2) errors.name = '2文字以上で入力してください'
    const code = (e.personalCode ?? '').trim()
    if (!/^\d{6}$/.test(code)) errors.personalCode = '6桁の数字で入力してください'
    else if (existing.some((emp) => emp.personalCode === code && emp.id !== e.id)) errors.personalCode = 'この個人コードは既に使われています'
    if (!e.office) errors.office = '営業所を選択してください'
    if (!e.position) errors.position = '役職を選択してください'
    return errors
  }

  const addErrors = useMemo(() => validateNewEmployee(newEmployee, employees), [newEmployee, employees])
  const canSubmitAdd = Object.keys(addErrors).length === 0
  const editErrors = useMemo(() => validateEditEmployee(editingEmployee, employees), [editingEmployee, employees])
  const canSubmitEdit = !!editingEmployee && Object.keys(editErrors).length === 0

  // 絞り込み
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (selectedOffice !== 'all' && e.office !== selectedOffice) return false
      if (selectedPosition !== 'all' && e.position !== selectedPosition) return false
      if (nameQuery && !e.name.includes(nameQuery)) return false
      if (codeQuery && !e.personalCode.includes(codeQuery)) return false
      return true
    })
  }, [employees, selectedOffice, selectedPosition, nameQuery, codeQuery])

  const getPositionBadge = (position: Position) => {
    const variants: Record<Position, string> = {
      本部: 'bg-violet-50 text-violet-700 border border-violet-200',
      所長: 'bg-rose-50 text-rose-700 border border-rose-200',
      副所長: 'bg-amber-50 text-amber-700 border border-amber-200',
      一般: 'bg-slate-50 text-slate-700 border border-slate-200',
    }
    return (
      <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[position]}`}>
        {position}
      </Badge>
    )
  }

  /* ---------- CRUD ---------- */
  const handleAddEmployee = () => {
    const errors = validateNewEmployee(newEmployee, employees)
    if (Object.keys(errors).length > 0) return

    const row: EmployeeRow = {
      id: `emp-${Date.now()}`,
      name: newEmployee.name!.trim(),
      personalCode: newEmployee.personalCode!.trim(),
      // 営業所管理者は自所で固定
      office: isHQ ? newEmployee.office! : myOfficeName,
      position: (newEmployee.position ?? '一般') as Position,
    }
    setEmployees((prev) => [...prev, row])
    setNewEmployee({ name: '', personalCode: '', office: isHQ ? '' : myOfficeName, position: '一般' })
    setIsAddModalOpen(false)
  }

  const handleEditEmployee = (row: EmployeeRow) => {
    setEditingEmployee(row)
    setIsEditModalOpen(true)
  }

  const handleUpdateEmployee = () => {
    if (!editingEmployee) return
    const errs = validateEditEmployee(editingEmployee, employees)
    if (Object.keys(errs).length > 0) return

    const updated: EmployeeRow = {
      ...editingEmployee,
      name: editingEmployee.name.trim(),
      personalCode: editingEmployee.personalCode.trim(),
      // 営業所管理者は自所で固定
      office: isHQ ? editingEmployee.office : myOfficeName,
    }
    setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    setEditingEmployee(null)
    setIsEditModalOpen(false)
  }

  const handleDeleteEmployee = (employeeId: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== employeeId))
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={onBack} className="flex items-center rounded-xl gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span>戻る</span>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">従業員一覧</h1>
              <p className="mt-1 text-sm text-gray-600">{isHQ ? '全営業所' : (myOfficeName || '（営業所未設定）')}</p>
            </div>
          </div>

          <Dialog
            open={isAddModalOpen}
            onOpenChange={(open) => {
              setIsAddModalOpen(open)
              if (!open) setNewEmployee({ name: '', personalCode: '', office: isHQ ? '' : myOfficeName, position: '一般' })
            }}
          >
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="h-10 rounded-xl border-gray-300 text-white bg-blue-500 hover:bg-blue-400 gap-2"
              >
                <Plus className="h-4 w-4" />
                新規登録
              </Button>
            </DialogTrigger>

            <DialogContent
              aria-describedby={undefined}
              className="z-[60] sm:max-w-md rounded-2xl border border-gray-200 shadow-2xl p-0 bg-white"
            >
              <DialogHeader className="px-6 pt-5 pb-3">
                <DialogTitle className="text-lg font-semibold text-gray-800">新規従業員登録</DialogTitle>
                <DialogDescription className="sr-only">従業員情報を入力して登録します。</DialogDescription>
              </DialogHeader>

              <div className="px-6 pb-4 space-y-4">
                {/* 氏名 */}
                <div className="space-y-2">
                  <Label htmlFor="add-name">氏名</Label>
                  <Input
                    id="add-name"
                    placeholder="従業員名を入力"
                    value={newEmployee.name || ''}
                    onChange={(e) => setNewEmployee((p) => ({ ...p, name: e.target.value }))}
                    className={inputPlain + (addErrors.name ? ' border-red-300 focus-visible:ring-red-200' : '')}
                  />
                  {addErrors.name && <p className="mt-1 text-xs text-red-600">{addErrors.name}</p>}
                </div>

                {/* 個人コード */}
                <div className="space-y-2">
                  <Label htmlFor="add-code">個人コード</Label>
                  <Input
                    id="add-code"
                    placeholder="6桁の個人コード"
                    value={newEmployee.personalCode || ''}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
                      setNewEmployee((p) => ({ ...p, personalCode: digits }))
                    }}
                    maxLength={6}
                    className={inputPlain + (addErrors.personalCode ? ' border-red-300 focus-visible:ring-red-200' : '')}
                  />
                  {addErrors.personalCode && <p className="mt-1 text-xs text-red-600">{addErrors.personalCode}</p>}
                </div>

                {/* 営業所 */}
                <div className="space-y-2">
                  <Label htmlFor="add-office">営業所</Label>
                  <Select
                    value={newEmployee.office || ''}
                    onValueChange={(v) => setNewEmployee((p) => ({ ...p, office: v }))}
                    disabled={!isHQ}
                  >
                    <SelectTrigger className={selectTrigger + (addErrors.office ? ' border-red-300' : '')}>
                      <SelectValue placeholder="営業所を選択" />
                    </SelectTrigger>
                    <SelectContent position="popper" className={contentClass}>
                      {officeOptions
                        .filter((o) => o.value !== 'all')
                        .map((o) => (
                          <SelectItem key={o.value} value={o.value} className={itemClass}>
                            {o.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {addErrors.office && <p className="mt-1 text-xs text-red-600">{addErrors.office}</p>}
                </div>

                {/* 役職 */}
                <div className="space-y-2">
                  <Label htmlFor="add-position">役職</Label>
                  <Select
                    value={(newEmployee.position as Position) || '一般'}
                    onValueChange={(v) => setNewEmployee((p) => ({ ...p, position: v as Position }))}
                  >
                    <SelectTrigger className={selectTrigger + (addErrors.position ? ' border-red-300' : '')}>
                      <SelectValue placeholder="役職を選択" />
                    </SelectTrigger>
                    <SelectContent position="popper" className={contentClass}>
                      {(['一般','副所長','所長','本部'] as Position[])
                        .map((p) => (
                          <SelectItem key={p} value={p} className={itemClass}>
                            {p}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {addErrors.position && <p className="mt-1 text-xs text-red-600">{addErrors.position}</p>}
                </div>
              </div>

              <div className="flex justify-end gap-2 px-6 pb-6">
                <Button
                  variant="outline"
                  onClick={() => setIsAddModalOpen(false)}
                  className="h-9 rounded-lg border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                >
                  キャンセル
                </Button>
                <Button
                  onClick={handleAddEmployee}
                  disabled={!canSubmitAdd}
                  className="h-9 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  登録
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card className={panelClass}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-800">フィルター＆検索</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {/* 営業所フィルター */}
              <div className="space-y-2 min-w-0">
                <Label>営業所フィルター</Label>
                <Select value={selectedOffice} onValueChange={(v) => setSelectedOffice(v)} disabled={!isHQ}>
                  <SelectTrigger className={selectTrigger}>
                    <SelectValue placeholder="全営業所" />
                  </SelectTrigger>
                  <SelectContent position="popper" className={contentClass}>
                    {officeOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value} className={itemClass}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 役職フィルター */}
              <div className="space-y-2 min-w-0">
                <Label>役職フィルター</Label>
                <Select value={selectedPosition} onValueChange={(v) => setSelectedPosition(v as 'all' | Position)}>
                  <SelectTrigger className={selectTrigger}>
                    <SelectValue placeholder="全役職" />
                  </SelectTrigger>
                  <SelectContent position="popper" className={contentClass}>
                    {(['all','一般','副所長','所長','本部'] as Array<'all'|Position>).map((p) => (
                      <SelectItem key={p} value={p} className={itemClass}>
                        {p === 'all' ? '全役職' : p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 氏名検索 */}
              <div className="space-y-2 min-w-0">
                <Label htmlFor="name-search">氏名検索</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="name-search"
                    placeholder="氏名で検索"
                    value={nameQuery}
                    onChange={(e) => setNameQuery(e.target.value)}
                    className={inputWithIcon}
                  />
                </div>
              </div>

              {/* 個人コード検索 */}
              <div className="space-y-2 min-w-0">
                <Label htmlFor="code-search">個人コード検索</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="code-search"
                    placeholder="個人コードで検索"
                    value={codeQuery}
                    onChange={(e) => setCodeQuery(e.target.value)}
                    className={inputWithIcon}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results summary */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{filteredEmployees.length}件の従業員が見つかりました</span>
          <span className="text-xs text-gray-400">最終更新: {new Date().toLocaleString('ja-JP')}</span>
        </div>

        {/* Table */}
        <Card className={panelClass}>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="table-fixed text-[14px]">
                <TableHeader className="sticky top-0 z-10 bg-white/92 backdrop-blur supports-[backdrop-filter]:bg-white/75 border-b border-gray-200">
                  <TableRow className="[&>th]:py-3 [&>th]:text-gray-600 [&>th]:text-[13px] [&>th]:tracking-wide bg-transparent">
                    <TableHead className="w-[18ch] font-semibold">氏名</TableHead>
                    <TableHead className="w-[12ch] font-semibold">個人コード</TableHead>
                    <TableHead className="w-[24ch] font-semibold">営業所名</TableHead>
                    <TableHead className="w-[10ch] font-semibold">役職</TableHead>
                    <TableHead className="w-[16ch] text-center font-semibold">操作</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody
                  className="
                    [&_tr]:border-b [&_tr]:border-gray-100
                    [&_tr]:transition-colors
                    [&_tr:hover]:!bg-slate-50
                    [&_tr:nth-child(even)]:bg-slate-50/30
                  "
                >
                  {filteredEmployees.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium truncate" title={row.name}>
                        <span className="inline-block max-w-[24ch] truncate">{row.name}</span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{row.personalCode}</TableCell>
                      <TableCell className="truncate" title={row.office}>
                        <span className="inline-block max-w-[24ch] truncate">{row.office}</span>
                      </TableCell>
                      <TableCell>{getPositionBadge(row.position)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditEmployee(row)}
                            className="h-8 px-2 text-gray-600 hover:bg-gray-100"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            編集
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 px-2 text-red-600 hover:bg-red-50">
                                <Trash2 className="h-4 w-4 mr-1" />
                                削除
                              </Button>
                            </AlertDialogTrigger>

                            <AlertDialogContent
                              aria-describedby={undefined}
                              className="z-[70] w-[90vw] max-w-md rounded-2xl border border-gray-200 bg-white p-0 shadow-2xl"
                            >
                              <AlertDialogHeader className="px-6 pt-5 pb-3">
                                <AlertDialogTitle className="text-lg font-semibold text-gray-800">
                                  従業員を削除しますか？
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-gray-500">
                                  <span className="font-medium text-gray-700">{row.name}</span> さんを削除します。 この操作は取り消せません。
                                </AlertDialogDescription>
                              </AlertDialogHeader>

                              <div className="px-6 pb-6 flex justify-end gap-2">
                                <AlertDialogCancel
                                  autoFocus
                                  className="h-9 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-gray-300"
                                >
                                  キャンセル
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteEmployee(row.id)}
                                  className="h-9 rounded-lg bg-red-600 text-white hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-300"
                                >
                                  削除
                                </AlertDialogAction>
                              </div>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredEmployees.length === 0 && (
              <div className="py-12 text-center text-gray-500">
                <p>条件に一致する従業員が見つかりませんでした</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent
            aria-describedby={undefined}
            className="sm:max-w-md rounded-2xl border border-gray-200 shadow-2xl p-0 bg-white z-[60]"
          >
            <DialogHeader className="px-6 pt-5 pb-3">
              <DialogTitle className="text-lg font-semibold text-gray-800">従業員情報編集</DialogTitle>
              <DialogDescription className="sr-only">従業員の情報を編集します。</DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-4 space-y-4">
              {/* 氏名 */}
              <div className="space-y-2">
                <Label htmlFor="edit-name">氏名</Label>
                <Input
                  id="edit-name"
                  value={editingEmployee?.name ?? ''}
                  onChange={(e) => setEditingEmployee((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                  className={inputPlain + (editErrors.name ? ' border-red-300 focus-visible:ring-red-200' : '')}
                />
                {editErrors.name && <p className="mt-1 text-xs text-red-600">{editErrors.name}</p>}
              </div>

              {/* 個人コード */}
              <div className="space-y-2">
                <Label htmlFor="edit-code">個人コード</Label>
                <Input
                  id="edit-code"
                  value={editingEmployee?.personalCode ?? ''}
                  onChange={(e) =>
                    setEditingEmployee((prev) =>
                      prev ? { ...prev, personalCode: e.target.value.replace(/\D/g, '').slice(0, 6) } : prev
                    )
                  }
                  maxLength={6}
                  className={inputPlain + (editErrors.personalCode ? ' border-red-300 focus-visible:ring-red-200' : '')}
                />
                {editErrors.personalCode && <p className="mt-1 text-xs text-red-600">{editErrors.personalCode}</p>}
              </div>

              {/* 営業所 */}
              <div className="space-y-2">
                <Label htmlFor="edit-office">営業所</Label>
                <Select
                  value={editingEmployee?.office ?? ''}
                  onValueChange={(v) => setEditingEmployee((prev) => (prev ? { ...prev, office: v } : prev))}
                  disabled={!isHQ}
                >
                  <SelectTrigger
                    id="edit-office"
                    className={selectTrigger + (editErrors.office ? ' border-red-300 focus-visible:ring-red-200' : '')}
                  >
                    <SelectValue placeholder="営業所を選択" />
                  </SelectTrigger>
                  <SelectContent position="popper" className={contentClass}>
                    {officeOptions
                      .filter((o) => o.value !== 'all')
                      .map((o) => (
                        <SelectItem key={o.value} value={o.value} className={itemClass}>
                          {o.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {editErrors.office && <p className="mt-1 text-xs text-red-600">{editErrors.office}</p>}
              </div>

              {/* 役職 */}
              <div className="space-y-2">
                <Label htmlFor="edit-position">役職</Label>
                <Select
                  value={editingEmployee?.position ?? '一般'}
                  onValueChange={(v) => setEditingEmployee((prev) => (prev ? { ...prev, position: v as Position } : prev))}
                >
                  <SelectTrigger
                    id="edit-position"
                    className={selectTrigger + (editErrors.position ? ' border-red-300 focus-visible:ring-red-200' : '')}
                  >
                    <SelectValue placeholder="役職を選択" />
                  </SelectTrigger>
                  <SelectContent position="popper" className={contentClass}>
                    {(['一般','副所長','所長','本部'] as Position[])
                      .map((p) => (
                        <SelectItem key={p} value={p} className={itemClass}>
                          {p}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {editErrors.position && <p className="mt-1 text-xs text-red-600">{editErrors.position}</p>}
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 pb-6">
              <Button
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                className="h-9 rounded-lg border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleUpdateEmployee}
                disabled={!canSubmitEdit}
                className="h-9 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                更新
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
