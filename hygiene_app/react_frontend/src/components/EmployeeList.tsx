'use client'

import { useMemo, useState } from 'react'
import { Search, Plus, Edit, Trash2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
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

/* ---------- モック→UIアダプタ ---------- */
const toPositionLabel = (pos: MockEmployee['position']): Position => {
  switch (pos) {
    case 'general':
      return '一般'
    case 'branch_admin':
      return '所長' // = 営業所管理者（必要なら表記変更OK）
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
const officeOptions = [
  { value: 'all', label: '全営業所' },
  ...officeNames.map((n) => ({ value: n, label: n })),
] as const

// 役職フィルター（“副所長”は任意で残してある）
const positionOptions: Array<{ value: 'all' | Position; label: string }> = [
  { value: 'all', label: '全役職' },
  { value: '一般', label: '一般' },
  { value: '副所長', label: '副所長' },
  { value: '所長', label: '所長' },
  { value: '本部', label: '本部' },
]

/* ---------- 本体 ---------- */
export function EmployeeList({ onBack }: EmployeeListProps) {
  const [employees, setEmployees] = useState<EmployeeRow[]>(initialEmployees)

  const [selectedOffice, setSelectedOffice] = useState<'all' | string>('all')
  const [selectedPosition, setSelectedPosition] = useState<'all' | Position>('all')

  // 検索入力は分離（氏名 / 個人コード）
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
      本部: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
      所長: 'bg-red-100 text-red-800 hover:bg-red-100',
      副所長: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
      一般: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
    }
    return (
      <Badge variant="secondary" className={variants[position]}>
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
              <span>ダッシュボードに戻る</span>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">従業員一覧</h1>
              <p className="mt-1 text-sm text-gray-600">全営業所</p>
            </div>
          </div>

          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>新規登録</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>新規従業員登録</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="add-name">氏名</Label>
                  <Input
                    id="add-name"
                    placeholder="従業員名を入力"
                    value={newEmployee.name || ''}
                    onChange={(e) => setNewEmployee((p) => ({ ...p, name: e.target.value }))}
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-office">営業所</Label>
                  <Select value={newEmployee.office || ''} onValueChange={(v) => setNewEmployee((p) => ({ ...p, office: v }))}>
                    <SelectTrigger id="add-office">
                      <SelectValue placeholder="営業所を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {officeOptions
                        .filter((o) => o.value !== 'all')
                        .map((o) => (
                          <SelectItem key={o.value} value={o.value}>
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
                    <SelectTrigger id="add-position">
                      <SelectValue placeholder="役職を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {positionOptions
                        .filter((p) => p.value !== 'all')
                        .map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleAddEmployee}>登録</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>フィルター＆検索</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>営業所フィルター</Label>
                <Select
                    value={selectedOffice}
                    onValueChange={(v) => setSelectedOffice(v)} >
                  <SelectTrigger>
                    <SelectValue placeholder="営業所を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {officeOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>役職フィルター</Label>
                <Select
                    value={selectedPosition}
                    onValueChange={(v) => setSelectedPosition(v as Position | 'all')}>
                  <SelectTrigger>
                    <SelectValue placeholder="役職を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {positionOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name-search">氏名検索</Label>
                <div className="relative">
                  <Input
                    id="name-search"
                    placeholder="氏名で検索"
                    value={nameQuery}
                    onChange={(e) => setNameQuery(e.target.value)}
                    className="pl-10"
                  />
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="code-search">個人コード検索</Label>
                <div className="relative">
                  <Input
                    id="code-search"
                    placeholder="個人コードで検索"
                    value={codeQuery}
                    onChange={(e) => setCodeQuery(e.target.value)}
                    className="pl-10"
                  />
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results summary */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{filteredEmployees.length}件の従業員が見つかりました</span>
          <span>最終更新: {new Date().toLocaleString('ja-JP')}</span>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="table-fixed">
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="w-[16ch] font-semibold">氏名</TableHead>
                    <TableHead className="w-[12ch] font-semibold">個人コード</TableHead>
                    <TableHead className="w-[16ch] font-semibold">営業所名</TableHead>
                    <TableHead className="w-[10ch] font-semibold">役職</TableHead>
                    <TableHead className="w-[14ch] text-center font-semibold">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr]:hover:bg-gray-50">
                  {filteredEmployees.map((row) => (
                    <TableRow key={row.id} className="border-b border-gray-100">
                      <TableCell className="font-medium truncate" title={row.name}>
                        <span className="inline-block max-w-[24ch] truncate">{row.name}</span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{row.personalCode}</TableCell>
                      <TableCell className="truncate" title={row.office}>
                        <span className="inline-block max-w-[24ch] truncate">{row.office}</span>
                      </TableCell>
                      <TableCell>{getPositionBadge(row.position)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditEmployee(row)}
                            className="flex items-center gap-1"
                          >
                            <Edit className="h-3 w-3" />
                            <span>編集</span>
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="flex items-center gap-1 text-red-600 hover:text-red-700">
                                <Trash2 className="h-3 w-3" />
                                <span>削除</span>
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
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>従業員情報編集</DialogTitle>
            </DialogHeader>
            {editingEmployee && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">氏名</Label>
                  <Input
                    id="edit-name"
                    value={editingEmployee.name}
                    onChange={(e) =>
                      setEditingEmployee((prev) => (prev ? { ...prev, name: e.target.value } : null))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-code">個人コード</Label>
                  <Input
                    id="edit-code"
                    value={editingEmployee.personalCode}
                    onChange={(e) =>
                      setEditingEmployee((prev) =>
                        prev ? { ...prev, personalCode: e.target.value } : null
                      )
                    }
                    maxLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-office">営業所</Label>
                  <Select
                    value={editingEmployee.office}
                    onValueChange={(v) =>
                      setEditingEmployee((prev) => (prev ? { ...prev, office: v } : null))
                    }
                  >
                    <SelectTrigger id="edit-office">
                      <SelectValue placeholder="営業所を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {officeOptions
                        .filter((o) => o.value !== 'all')
                        .map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-position">役職</Label>
                  <Select
                    value={editingEmployee.position}
                    onValueChange={(v) =>
                      setEditingEmployee((prev) => (prev ? { ...prev, position: v as Position } : null))
                    }
                  >
                    <SelectTrigger id="edit-position">
                      <SelectValue placeholder="役職を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {positionOptions
                        .filter((p) => p.value !== 'all')
                        .map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                キャンセル
              </Button>
              <Button onClick={handleUpdateEmployee}>更新</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
