'use client'

import { useState, useMemo,useEffect } from 'react'
import { CalendarIcon, Download, Filter, Search, User, Calendar, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Listbox } from '@headlessui/react'
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/20/solid'

interface OfficeOption {
  value: string
  label: string
}

interface HygieneRecord {
  id: string
  employeeName: string
  date: string
  abnormalItems: string[]
  hasComment: boolean
  status: '出勤入力済' | '退勤入力済' | '未入力'
  comment?: string
  temperature?: number
  supervisorConfirmed: boolean
}

// Generate mock data for specific date (all employees) - now used for 'individual' mode
const generateDailyData = (targetDate: string, officeName: string): HygieneRecord[] => {
  const employees = [
    '田中太郎', '佐藤花子', '山田次郎', '鈴木一郎', '高橋美咲',
    '伊藤健太', '渡辺裕子', '小林直樹', '加藤まり子', '吉田智宏'
  ]
  
  return employees.map((employeeName, index) => {
    // Use a consistent seed for reproducible random data
    const seed = employeeName.length + targetDate.length + officeName.length + index
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000
      return x - Math.floor(x)
    }
    
    const randomStatus = seededRandom(seed)
    let status: '出勤入力済' | '退勤入力済' | '未入力'
    
    if (randomStatus < 0.6) status = '退勤入力済'
    else if (randomStatus < 0.85) status = '出勤入力済' 
    else status = '未入力'
    
    const hasAbnormal = seededRandom(seed + 1) < 0.15
    const abnormalItems = hasAbnormal ? ['体温異常', '体調不良'] : []
    const hasComment = seededRandom(seed + 2) < 0.3 || hasAbnormal
    
    return {
      id: `${targetDate}-${employeeName}`,
      employeeName,
      date: targetDate,
      abnormalItems,
      hasComment,
      status,
      comment: hasComment ? (hasAbnormal ? '軽微な体調不良のため' : '定期健康診断予定') : undefined,
      temperature: hasAbnormal ? 37.2 : 36.5,
      supervisorConfirmed: seededRandom(seed + 3) < 0.7 // 70% chance of being confirmed
    }
  })
}

// Generate mock data for one month (individual employee) - now used for 'daily' mode
const generateMonthData = (employeeName: string): HygieneRecord[] => {
  const records: HygieneRecord[] = []
  const today = new Date()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  
  // Generate data for current month
  for (let day = 1; day <= 31; day++) {
    const date = new Date(currentYear, currentMonth, day)
    if (date.getMonth() !== currentMonth) break // Skip dates that overflow to next month
    
    const dateString = date.toISOString().split('T')[0]
    
    // Use a consistent seed for reproducible random data
    const seed = employeeName.length + day
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000
      return x - Math.floor(x)
    }
    
    const randomStatus = seededRandom(seed)
    let status: '出勤入力済' | '退勤入力済' | '未入力'
    
    if (randomStatus < 0.6) status = '退勤入力済'
    else if (randomStatus < 0.85) status = '出勤入力済' 
    else status = '未入力'
    
    const hasAbnormal = seededRandom(seed + 1) < 0.15
    const abnormalItems = hasAbnormal ? ['体温異常', '体調不良'] : []
    const hasComment = seededRandom(seed + 2) < 0.3 || hasAbnormal
    
    records.push({
      id: `${employeeName}-${day}`,
      employeeName,
      date: dateString,
      abnormalItems,
      hasComment,
      status,
      comment: hasComment ? (hasAbnormal ? '軽微な体調不良のため' : '定期健康診断予定') : undefined,
      temperature: hasAbnormal ? 37.2 : 36.5,
      supervisorConfirmed: seededRandom(seed + 3) < 0.8 // 80% chance of being confirmed
    })
  }
  
  return records.reverse() // Show most recent first
}

const allEmployees = [
  '田中太郎',
  '佐藤花子', 
  '山田次郎',
  '鈴木一郎',
  '高橋美咲'
]

interface HygieneManagementProps {
  onEmployeeListClick: () => void
  onBackToDashboard: () => void
}

export default function HygieneManagement({ onEmployeeListClick, onBackToDashboard }: HygieneManagementProps) {
  // Now 'individual' = daily office view, 'daily' = individual monthly view
  const [viewMode, setViewMode] = useState<'individual' | 'daily'>('individual')
  const [selectedOffice, setSelectedOffice] = useState('all')
  const [selectedEmployee, setSelectedEmployee] = useState('all')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showAbnormalOnly, setShowAbnormalOnly] = useState(false)
  const [showCommentOnly, setShowCommentOnly] = useState(false)
  const [showUnsubmittedOnly, setShowUnsubmittedOnly] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  
  // State to manage supervisor confirmations
  const [supervisorConfirmations, setSupervisorConfirmations] = useState<Record<string, boolean>>({})

  // Mock user role - can be 'branch_manager' or 'hq_admin'
 const [userRole, setUserRole] = useState<'hq_admin' | 'branch_manager'>('hq_admin')

useEffect(() => {
  const rawRole = localStorage.getItem('userRole')
  if (rawRole === 'branch_manager') {
    setUserRole('branch_manager')
  }
}, [])


  const userOffice = '東京本社'

  const offices = userRole === 'branch_manager' 
    ? [{ value: userOffice, label: userOffice }]
    : [
        { value: 'all', label: '全営業所' },
        { value: '東京本社', label: '東京本社' },
        { value: '大阪支社', label: '大阪支社' },
        { value: '名古屋支社', label: '名古屋支社' },
        { value: '福岡支社', label: '福岡支社' }
      ]

  // Memoize data generation to prevent regeneration on checkbox changes
  const currentData = useMemo(() => {
    if (viewMode === 'individual' && selectedOffice && selectedOffice !== 'all') {
      // individual now shows daily office data
      return generateDailyData(selectedDate, selectedOffice)
    } else if (viewMode === 'daily' && selectedEmployee && selectedEmployee !== 'all') {
      // daily now shows individual monthly data
      return generateMonthData(selectedEmployee)
    }
    return []
  }, [viewMode, selectedOffice, selectedDate, selectedEmployee])

  // Apply supervisor confirmations from local state
  const dataWithConfirmations = useMemo(() => {
    return currentData.map(record => ({
      ...record,
      supervisorConfirmed: supervisorConfirmations[record.id] !== undefined 
        ? supervisorConfirmations[record.id] 
        : record.supervisorConfirmed
    }))
  }, [currentData, supervisorConfirmations])

  const filteredData = useMemo(() => {
    return dataWithConfirmations.filter(record => {
      if (searchTerm && !record.employeeName.includes(searchTerm)) return false
      if (showAbnormalOnly && record.abnormalItems.length === 0) return false
      if (showCommentOnly && !record.hasComment) return false
      if (showUnsubmittedOnly && record.status !== '未入力') return false
      return true
    })
  }, [dataWithConfirmations, searchTerm, showAbnormalOnly, showCommentOnly, showUnsubmittedOnly])

  const handleSupervisorConfirmationChange = (recordId: string, confirmed: boolean) => {
    setSupervisorConfirmations(prev => ({
      ...prev,
      [recordId]: confirmed
    }))
    console.log(`Record ${recordId} supervisor confirmation: ${confirmed}`)
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      '出勤入力済': 'bg-blue-100 text-blue-800 hover:bg-blue-100',
      '退勤入力済': 'bg-green-100 text-green-800 hover:bg-green-100', 
      '未入力': 'bg-gray-100 text-gray-800 hover:bg-gray-100'
    }
    return (
      <Badge variant="secondary" className={variants[status as keyof typeof variants]}>
        {status}
      </Badge>
    )
  }

  const getAbnormalDisplay = (abnormalItems: string[]) => {
    if (abnormalItems.length === 0) return ''
    if (abnormalItems.some(item => item.includes('体温') || item.includes('発熱'))) return '🔴'
    return '⚠️'
  }

  const getViewModeDescription = () => {
    if (viewMode === 'individual') {
      // individual now shows daily office data
      return selectedOffice && selectedOffice !== 'all'
        ? `${selectedOffice} ${new Date(selectedDate).toLocaleDateString('ja-JP')}の記録: ${filteredData.length}件`
        : '営業所を選択してください'
    } else {
      // daily now shows individual monthly data
      return selectedEmployee && selectedEmployee !== 'all' 
        ? `${selectedEmployee}の今月の記録: ${filteredData.length}件`
        : '従業員を選択してください'
    }
  }

  const shouldShowEmptyState = () => {
    if (viewMode === 'individual') {
      // individual now shows daily office data
      return !selectedOffice || selectedOffice === 'all'
    } else {
      // daily now shows individual monthly data
      return !selectedEmployee || selectedEmployee === 'all'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">衛生チェック管理</h1>
            <p className="text-sm text-gray-600 mt-1">従業員の健康状態記録を管理</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button 
              onClick={onEmployeeListClick}
              className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600"
            >
              <User className="h-4 w-4" />
              <span>従業員一覧</span>
            </Button>
            <Button variant="outline" className="flex items-center space-x-2">
              <Download className="h-4 w-4" />
              <span>Excel出力</span>
            </Button>
            <Button variant="outline" className="flex items-center space-x-2">
              <Download className="h-4 w-4" />
              <span>PDF出力</span>
            </Button>
            <Button 
              variant="outline" 
              onClick={onBackToDashboard}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>ダッシュボードに戻る</span>
            </Button>
          </div>
        </div>

        {/* View Mode Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="h-4 w-4" />
              <span>表示設定</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
<Tabs
  value={viewMode}
  onValueChange={(value) => {
    if (value === 'individual' || value === 'daily') {
      setViewMode(value)
    }
  }}
>
  <TabsList className="grid w-full grid-cols-2">
    <TabsTrigger value="individual" className="flex items-center space-x-2">
      <Calendar className="h-4 w-4" />
      <span>日次営業所表示</span>
    </TabsTrigger>
    <TabsTrigger value="daily" className="flex items-center space-x-2">
      <User className="h-4 w-4" />
      <span>個人月次表示</span>
    </TabsTrigger>
  </TabsList>

  <div className="mt-6">
    {viewMode === 'individual' && (
      <div key="individual">
        {/* 日次営業所表示 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <span className="text-sm font-medium">営業所</span>

            {/* Radix UI Select（旧） */}
            {/*
            <Select value={selectedOffice} onValueChange={setSelectedOffice}>
              <SelectTrigger className="bg-green-50 border-green-200">
                <SelectValue placeholder="営業所を選択" />
              </SelectTrigger>
              <SelectContent>
                {offices.filter(office => office.value !== 'all').map(office => (
                  <SelectItem key={office.value} value={office.value}>
                    {office.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            */}

            {/* Headless UI Listbox（新） */}
            <Listbox value={selectedOffice} onChange={setSelectedOffice}>
              <div className="relative mt-1">
                <Listbox.Button className="relative w-full cursor-default rounded-md bg-green-50 py-2 pl-3 pr-10 text-left border border-green-200 shadow-sm focus:outline-none focus:ring-1 focus:ring-green-400 text-sm">
                  <span className="block truncate">
                    {offices.find(o => o.value === selectedOffice)?.label || '営業所を選択'}
                  </span>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
                  </span>
                </Listbox.Button>
                <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none text-sm">
                  {offices.filter(o => o.value !== 'all').map((office) => (
                    <Listbox.Option
                      key={office.value}
                      value={office.value}
                      className={({ active }) =>
                        `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                          active ? 'bg-green-100 text-green-900' : 'text-gray-900'
                        }`
                      }
                    >
                      {({ selected }) => (
                        <>
                          <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                            {office.label}
                          </span>
                          {selected && (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-green-600">
                              <CheckIcon className="h-5 w-5" />
                            </span>
                          )}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </div>
            </Listbox>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">表示日</span>
            <div className="relative">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-10 bg-green-50 border-green-200"
              />
              <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">検索</span>
            <div className="relative">
              <Input
                placeholder="従業員名で検索"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>
      </div>
    )}

    {viewMode === 'daily' && (
      <div key="daily">
        {/* 個人月次表示 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <span className="text-sm font-medium">営業所</span>
            {/* Radix版 Select（旧） */}
            {/*
            <Select value={selectedOffice} onValueChange={setSelectedOffice}>
              <SelectTrigger>
                <SelectValue placeholder="営業所を選択" />
              </SelectTrigger>
              <SelectContent>
                {offices.map(office => (
                  <SelectItem key={office.value} value={office.value}>
                    {office.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            */}

            {/* Headless UI版 Listbox */}
            <Listbox value={selectedOffice} onChange={setSelectedOffice}>
              <div className="relative mt-1">
                <Listbox.Button className="relative w-full cursor-default rounded-md bg-white py-2 pl-3 pr-10 text-left border border-gray-300 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm">
                  <span className="block truncate">
                    {offices.find(o => o.value === selectedOffice)?.label || '営業所を選択'}
                  </span>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
                  </span>
                </Listbox.Button>
                <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none text-sm">
                  {offices.map((office) => (
                    <Listbox.Option
                      key={office.value}
                      value={office.value}
                      className={({ active }) =>
                        `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                          active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                        }`
                      }
                    >
                      {({ selected }) => (
                        <>
                          <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                            {office.label}
                          </span>
                          {selected && (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                              <CheckIcon className="h-5 w-5" />
                            </span>
                          )}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </div>
            </Listbox>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">従業員名</span>
            {/* Radix版 */}
            {/*
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="bg-blue-50 border-blue-200">
                <SelectValue placeholder="従業員を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全員</SelectItem>
                {allEmployees.map(employee => (
                  <SelectItem key={employee} value={employee}>
                    {employee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            */}

            {/* Headless UI版 Listbox */}
            <Listbox value={selectedEmployee} onChange={setSelectedEmployee}>
    <div className="relative mt-1">
      <Listbox.Button className="relative w-full cursor-default rounded-md bg-blue-50 py-2 pl-3 pr-10 text-left border border-blue-200 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400 text-sm">
        <span className="block truncate">
          {selectedEmployee === 'all'
            ? '全員'
            : allEmployees.find(e => e === selectedEmployee) || '従業員を選択'}
        </span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
        </span>
      </Listbox.Button>

      <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none text-sm">
        {/* 全員 option */}
        <Listbox.Option value="all">
          {({ selected, active }) => (
            <div
              className={`relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
              }`}
            >
              <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                全員
              </span>
              {selected && (
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                  <CheckIcon className="h-5 w-5" />
                </span>
              )}
            </div>
          )}
        </Listbox.Option>

        {/* 各従業員 option */}
        {allEmployees.map((employee) => (
          <Listbox.Option key={employee} value={employee}>
            {({ selected, active }) => (
              <div
                className={`relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                  active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                }`}
              >
                <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                  {employee}
                </span>
                {selected && (
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                    <CheckIcon className="h-5 w-5" />
                  </span>
                )}
              </div>
            )}
          </Listbox.Option>
        ))}
      </Listbox.Options>
    </div>
  </Listbox>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">検索</span>
            <div className="relative">
              <Input
                placeholder="キーワード検索"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
</Tabs>


              <Separator className="my-4" />

              {/* Toggle filters */}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant={showAbnormalOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowAbnormalOnly(!showAbnormalOnly)}
                  className="flex items-center space-x-2"
                >
                  <span>🔴</span>
                  <span>異常のみ</span>
                </Button>
                
                <Button
                  variant={showCommentOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowCommentOnly(!showCommentOnly)}
                  className="flex items-center space-x-2"
                >
                  <span>💬</span>
                  <span>コメントあり</span>
                </Button>
                
                <Button
                  variant={showUnsubmittedOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowUnsubmittedOnly(!showUnsubmittedOnly)}
                  className="flex items-center space-x-2"
                >
                  <span>⏳</span>
                  <span>未入力のみ</span>
                </Button>
              </div>
            
          </CardContent>
        </Card>

        {/* Results summary */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{getViewModeDescription()}</span>
          <span>最終更新: {new Date().toLocaleString('ja-JP')}</span>
        </div>

        {/* Data Table */}
        <Card>
          <CardContent className="p-0">
            {shouldShowEmptyState() ? (
              <div className="text-center py-12 text-gray-500">
                <p>
                  {viewMode === 'individual' 
                    ? '営業所を選択すると、選択した日付の全従業員データが表示されます' 
                    : '従業員を選択すると、1ヶ月分のデータが表示されます'
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">従業員名</TableHead>
                      <TableHead className="font-semibold">記録日</TableHead>
                      <TableHead className="font-semibold text-center">異常項目</TableHead>
                      <TableHead className="font-semibold text-center">異常</TableHead>
                      <TableHead className="font-semibold text-center">コメント</TableHead>
                      <TableHead className="font-semibold">ステータス</TableHead>
                      <TableHead className="font-semibold text-center">責任者確認</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((record) => (
                      <TableRow key={record.id} className="hover:bg-gray-50 border-b border-gray-100">
                        <TableCell className="font-medium">{record.employeeName}</TableCell>
                        <TableCell className="text-gray-600">
                          {new Date(record.date).toLocaleDateString('ja-JP', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </TableCell>
                        <TableCell className="text-center">
                          {record.abnormalItems.length > 0 ? (
                            <div className="text-xs text-red-600">
                              {record.abnormalItems.join(', ')}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-lg">
                            {getAbnormalDisplay(record.abnormalItems)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm text-gray-600">
                            {record.hasComment ? 'あり' : 'なし'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(record.status)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={record.supervisorConfirmed}
                            onCheckedChange={(checked) => 
                              handleSupervisorConfirmationChange(record.id, !!checked)
                            }
                            className="mx-auto"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            
            {!shouldShowEmptyState() && filteredData.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>条件に一致する記録が見つかりませんでした</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Access control info */}
        <div className="text-xs text-gray-500 text-center">
          ログイン中: {userRole === 'hq_admin' ? '本社管理者' : '支店管理者'} 
          {userRole === 'branch_manager' && ` (${userOffice})`}
        </div>
      </div>
    </div>
  )
}