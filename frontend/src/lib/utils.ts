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
