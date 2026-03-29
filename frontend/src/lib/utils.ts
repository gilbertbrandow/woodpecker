import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { AuthUser } from './api'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function displayName(user: AuthUser): string {
  return user.nickname ?? user.username
}

export function formatNumber(n: number): string {
  return n.toLocaleString('sv-SE').replace(',', '.')
}

export function formatSolveTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
