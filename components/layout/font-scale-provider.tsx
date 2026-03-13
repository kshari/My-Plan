'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type FontScale = '1' | '1.125' | '1.25' | '1.375' | '1.5'

interface FontScaleContextValue {
  fontScale: FontScale
  setFontScale: (scale: FontScale) => void
}

const DEFAULT_FONT_SCALE: FontScale = '1.125'

const FontScaleContext = createContext<FontScaleContextValue>({
  fontScale: DEFAULT_FONT_SCALE,
  setFontScale: () => {},
})

export function FontScaleProvider({ children }: { children: React.ReactNode }) {
  const [fontScale, setFontScaleState] = useState<FontScale>(DEFAULT_FONT_SCALE)

  useEffect(() => {
    const stored = localStorage.getItem('font-scale') as FontScale | null
    const initial = stored && ['1', '1.125', '1.25', '1.375', '1.5'].includes(stored) ? stored : DEFAULT_FONT_SCALE
    setFontScaleState(initial)
    document.documentElement.style.setProperty('--font-scale', initial)
  }, [])

  function setFontScale(scale: FontScale) {
    setFontScaleState(scale)
    document.documentElement.style.setProperty('--font-scale', scale)
    localStorage.setItem('font-scale', scale)
  }

  return (
    <FontScaleContext.Provider value={{ fontScale, setFontScale }}>
      {children}
    </FontScaleContext.Provider>
  )
}

export function useFontScale() {
  return useContext(FontScaleContext)
}
