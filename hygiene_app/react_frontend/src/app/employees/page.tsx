'use client'

import { EmployeeList } from '@/components/EmployeeList'

export default function Page() {
  return <EmployeeList onBack={() => history.back()} />
}
