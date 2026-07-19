import * as React from 'react'

const MOBILE_BREAKPOINT = 768
const DESKTOP_BREAKPOINT = 1024

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean>(
    () => window.innerWidth < MOBILE_BREAKPOINT,
  )

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = (): void => setIsMobile(mql.matches)
    mql.addEventListener('change', onChange)
    setIsMobile(mql.matches)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = React.useState<boolean>(
    () => window.innerWidth >= DESKTOP_BREAKPOINT,
  )

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`)
    const onChange = (): void => setIsDesktop(mql.matches)
    mql.addEventListener('change', onChange)
    setIsDesktop(mql.matches)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isDesktop
}
