// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

type BreadcrumbNameContextValue = {
  name: string | null
  setName: (n: string | null) => void
}

const BreadcrumbNameContext = createContext<BreadcrumbNameContextValue>({
  name: null,
  setName: () => {},
})

export function BreadcrumbNameProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState<string | null>(null)
  return (
    <BreadcrumbNameContext.Provider value={{ name, setName }}>
      {children}
    </BreadcrumbNameContext.Provider>
  )
}

export function useBreadcrumbName(entityName: string | null | undefined) {
  const { setName } = useContext(BreadcrumbNameContext)
  useEffect(() => {
    if (entityName) setName(entityName)
    return () => setName(null)
  }, [entityName, setName])
}

export function useBreadcrumbNameValue(): string | null {
  return useContext(BreadcrumbNameContext).name
}
