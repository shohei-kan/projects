'use client'

import { useMemo, useState } from 'react'
import { Search, Plus, Edit, Trash2, ArrowLeft,X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,DialogClose } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'

// モック & 型（data/index.ts のバレル経由）
import { mockEmployees, mockBranches } from '@/data'
import type { Employee as MockEmployee } from '@/data'


/* =========================
   UI 用 共通クラス（サイズ統一）
   ========================= */
const fieldBase =
  "w-full h-10 rounded-lg border border-gray-200 bg-gray-100 text-gray-700 text-sm leading-none focus-visible:outline-none";
const inputPlainClass = `${fieldBase} placeholder:text-gray-400 px-3 focus-visible:ring-2 focus-visible:ring-blue-200`;
const triggerClass    = `${fieldBase} justify-between px-3 focus-visible:ring-2 focus-visible:ring-blue-200`;
const contentClass    = "rounded-xl bg-white ring-1 ring-gray-200 shadow-xl p-1 min-w-[var(--radix-select-trigger-width)]";
const itemClass       = "rounded-md px-3 py-2 text-[14px] outline-none cursor-pointer data-[highlighted]:bg-gray-100 data-[state=checked]:bg-gray-100 data-[state=checked]:font-medium";
const inputClass = `${fieldBase} placeholder:text-gray-400 pl-10` // ← 検索アイコン分の左padding
const rowClass =
  "border-b border-gray-100 transition-colors hover:!bg-gray-50 focus-within:bg-gray-50";
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

/* =========================
   モック → UI 変換
   ========================= */
const toPositionLabel = (pos: MockEmployee['position']): Position => {
  switch (pos) {
    case 'general':
      return '一般'
    case 'branch_admin':
      return '所長' // = 営業所管理者（表記変更OK）
    case 'manager':
      return '本部'
  }
}

const branchNameFromCode = (code: string) => {
  const b = mockBranches.find((x) => x.code === code)
  return b ? b.name : code
}

const initialEmployees: EmployeeRow[] = mockEmployees.map((m) => ({
  id: `emp-${m.code}`,
  name: m.name,
  personalCode: m.code,
  office: branchNameFromCode(m.branchCode),
  position: toPositionLabel(m.position),
}))

// 重複名を除去した営業所オプション
const officeNames = Array.from(new Set(mockBranches.map((b) => b.name)))
const officeOptions = [{ value: 'all', label: '全営業所' }, ...officeNames.map((n) => ({ value: n, label: n }))] as const

// 役職フィルター（“副所長”は任意で残してある）
const positionOptions: Array<{ value: 'all' | Position; label: string }> = [
  { value: 'all', label: '全役職' },
  { value: '一般', label: '一般' },
  { value: '副所長', label: '副所長' },
  { value: '所長', label: '所長' },
  { value: '本部', label: '本部' },
]

/* =========================
   本体
   ========================= */
export function EmployeeList({ onBack }: EmployeeListProps) {
  const [employees, setEmployees] = useState<EmployeeRow[]>(initialEmployees)

  const [selectedOffice, setSelectedOffice] = useState<'all' | string>('all')
  const [selectedPosition, setSelectedPosition] = useState<'all' | Position>('all')

  // 検索入力（氏名 / 個人コード）
  const [nameQuery, setNameQuery] = useState('')
  const [codeQuery, setCodeQuery] = useState('')

  // 追加/編集モーダル
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRow | null>(null)
  const [newEmployee, setNewEmployee] = useState<Partial<EmployeeRow>>({
    name: '',
    personalCode: '',
    office: '',
    position: '一般',
  })

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
    本部:  'bg-violet-50 text-violet-700 border border-violet-200',
    所長:  'bg-rose-50 text-rose-700 border border-rose-200',
    副所長:'bg-amber-50 text-amber-700 border border-amber-200',
    一般:  'bg-slate-50 text-slate-700 border border-slate-200',
  }
  return (
    <Badge
      variant="outline"
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[position]}`}
    >
      {position}
    </Badge>
  )
}

  /* ---------- CRUD handlers ---------- */
  const handleAddEmployee = () => {
    if (!newEmployee.name || !newEmployee.personalCode || !newEmployee.office) return
    const row: EmployeeRow = {
      id: `emp-${Date.now()}`,
      name: newEmployee.name!,
      personalCode: newEmployee.personalCode!,
      office: newEmployee.office!,
      position: (newEmployee.position ?? '一般') as Position,
    }
    setEmployees((prev) => [...prev, row])
    setNewEmployee({ name: '', personalCode: '', office: '', position: '一般' })
    setIsAddModalOpen(false)
  }

  const handleEditEmployee = (row: EmployeeRow) => {
    setEditingEmployee(row)
    setIsEditModalOpen(true)
  }

  const handleUpdateEmployee = () => {
    if (!editingEmployee) return
    setEmployees((prev) => prev.map((e) => (e.id === editingEmployee.id ? editingEmployee : e)))
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
            <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span>戻る</span>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">従業員一覧</h1>
              <p className="mt-1 text-sm text-gray-600">全営業所</p>
            </div>
          </div>

          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
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
            
            className="sm:max-w-md rounded-2xl border border-gray-200 shadow-2xl p-0 bg-white">

            {/* ヘッダー */}
            <DialogHeader className="px-6 pt-5 pb-3">
              <DialogTitle className="text-lg font-semibold text-gray-800">
                新規従業員登録
              </DialogTitle>
              <DialogDescription className="sr-only">
                従業員情報を入力して登録します。
              </DialogDescription>
            </DialogHeader>
              <div className="px-6 pb-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="add-name">氏名</Label>
                  <Input
                    id="add-name"
                    placeholder="従業員名を入力"
                    value={newEmployee.name || ''}
                    onChange={(e) => setNewEmployee((p) => ({ ...p, name: e.target.value }))}
                    className={inputPlainClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-code">個人コード</Label>
                  <Input
                    id="add-code"
                    placeholder="6桁の個人コード"
                    value={newEmployee.personalCode || ''}
                    onChange={(e) => setNewEmployee((p) => ({ ...p, personalCode: e.target.value }))}
                    maxLength={6}
                    className={inputPlainClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-office">営業所</Label>
                  <Select value={newEmployee.office || ''} onValueChange={(v) => setNewEmployee((p) => ({ ...p, office: v }))}>
                    <SelectTrigger className={`${triggerClass} focus:outline-none focus-visible:outline-none`} >
                      <SelectValue placeholder="営業所を選択" />
                    </SelectTrigger>
                    <SelectContent className={`${contentClass} z-[70]`}>
                      {officeOptions
                        .filter((o) => o.value !== 'all')
                        .map((o) => (
                          <SelectItem key={o.value} value={o.value} className={itemClass}>
                            {o.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-position">役職</Label>
                  <Select
                    value={(newEmployee.position as Position) || '一般'}
                    onValueChange={(v) => setNewEmployee((p) => ({ ...p, position: v as Position }))}
                  >
                    <SelectTrigger className={`${triggerClass} focus:outline-none focus-visible:outline-none`} >
                      <SelectValue placeholder="役職を選択" />
                    </SelectTrigger>
                    <SelectContent className={`${contentClass} z-[70]`}>
                      {positionOptions
                        .filter((p) => p.value !== 'all')
                        .map((p) => (
                          <SelectItem key={p.value} value={p.value} className={itemClass}>
                            {p.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 pb-6">
                <Button variant="outline" onClick={() => setIsAddModalOpen(false)}
                  className="h-9 rounded-lg border-gray-300 text-gray-700 bg-white hover:bg-gray-50">
                  キャンセル
                </Button>
                <Button onClick={handleAddEmployee}
                  className="h-9 rounded-lg bg-gray-900 text-white hover:bg-gray-800">
                  登録
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card className="rounded-2xl border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-800">フィルター＆検索</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {/* 営業所フィルター */}
              <div className="space-y-2 min-w-0">
                <Label>営業所フィルター</Label>
                <Select value={selectedOffice} onValueChange={(v) => setSelectedOffice(v)}>
                  <SelectTrigger className={triggerClass}>
                    <SelectValue placeholder="全営業所" />
                  </SelectTrigger>
                  <SelectContent className={`${contentClass} z-[70]`}>
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
                  <SelectTrigger className={triggerClass}>
                    <SelectValue placeholder="全役職" />
                  </SelectTrigger>
                  <SelectContent className={`${contentClass} z-[70]`}>
                    {positionOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value} className={itemClass}>
                        {p.label}
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
                    className={inputClass}
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
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results summary */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{filteredEmployees.length}件の従業員が見つかりました</span>
          <span>最終更新: {new Date().toLocaleString('ja-JP')}</span>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="table-fixed text-[14px]">
                      <TableHeader className="sticky top-0 z-10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
                        <TableRow className="bg-gray-50 hover:bg-gray-50 [&>th]:py-3 [&>th]:text-gray-700">
                          <TableHead className="w-[18ch] font-semibold">氏名</TableHead>
                          <TableHead className="w-[12ch] font-semibold">個人コード</TableHead>
                          <TableHead className="w-[24ch] font-semibold">営業所名</TableHead>
                          <TableHead className="w-[10ch] font-semibold">役職</TableHead>
                          <TableHead className="w-[16ch] text-center font-semibold">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="
                          [&_tr]:border-b [&_tr]:border-gray-100
                          [&_tr]:transition-colors
                          [&_tr:hover]:!bg-gray-100
                          [&_tr:focus-within]:!bg-gray-100
                        ">
                        {filteredEmployees.map((row) => (
                          <TableRow key={row.id} >
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
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  削除
                                </Button>
                              </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>従業員を削除しますか？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {row.name}さんを削除します。この操作は取り消せません。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteEmployee(row.id)} className="bg-red-600 hover:bg-red-700">
                                  削除
                                </AlertDialogAction>
                              </AlertDialogFooter>
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
              <div className="space-y-2">
                <Label htmlFor="edit-name">氏名</Label>
                <Input
                  id="edit-name"
                  value={editingEmployee?.name ?? ""}
                  onChange={(e) => setEditingEmployee(prev => prev ? { ...prev, name: e.target.value } : prev)}
                  className={inputPlainClass}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-code">個人コード</Label>
                <Input
                  id="edit-code"
                  value={editingEmployee?.personalCode ?? ""}
                  onChange={(e) => setEditingEmployee(prev => prev ? { ...prev, personalCode: e.target.value } : prev)}
                  maxLength={6}
                  className={inputPlainClass}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-office">営業所</Label>
                <Select
                  value={editingEmployee?.office ?? ""}
                  onValueChange={(v) => setEditingEmployee(prev => prev ? { ...prev, office: v } : prev)}
                >
                  <SelectTrigger id="edit-office" className={triggerClass}>
                    <SelectValue placeholder="営業所を選択" />
                  </SelectTrigger>
                  <SelectContent position="popper" className={`${contentClass} z-[70]`}>
                    {officeOptions.filter(o => o.value !== "all").map(o => (
                      <SelectItem key={o.value} value={o.value} className={itemClass}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-position">役職</Label>
                <Select
                  value={editingEmployee?.position ?? "一般"}
                  onValueChange={(v) => setEditingEmployee(prev => prev ? { ...prev, position: v as Position } : prev)}
                >
                  <SelectTrigger id="edit-position" className={triggerClass}>
                    <SelectValue placeholder="役職を選択" />
                  </SelectTrigger>
                  <SelectContent position="popper" className={`${contentClass} z-[70]`}>
                    {positionOptions.filter(p => p.value !== "all").map(p => (
                      <SelectItem key={p.value} value={p.value} className={itemClass}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 pb-6">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}
                className="h-9 rounded-lg border-gray-300 text-gray-700 bg-white hover:bg-gray-50">
                キャンセル
              </Button>
              <Button onClick={handleUpdateEmployee} className="h-9 rounded-lg bg-gray-900 text-white hover:bg-gray-800">
                更新
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  )
}
