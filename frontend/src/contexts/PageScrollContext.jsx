import { createContext, useContext, useState } from 'react'

const PageScrollContext = createContext(null)

export function PageScrollProvider({ children }) {
  const [disableScroll, setDisableScroll] = useState(false)
  return (
    <PageScrollContext.Provider value={{ disableScroll, setDisableScroll }}>
      {children}
    </PageScrollContext.Provider>
  )
}

export function usePageScroll() {
  const ctx = useContext(PageScrollContext)
  if (!ctx) return { disableScroll: false, setDisableScroll: () => {} }
  return ctx
}
