export function getStored<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // quota exceeded or private browsing — silently ignore
  }
}

export function removeStored(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {}
}
