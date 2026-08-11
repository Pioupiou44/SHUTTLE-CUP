import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Fusionne les classes Tailwind en résolvant les conflits
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// Formate une date ISO en date lisible française
export function formatDate(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(isoDate))
  } catch {
    return isoDate
  }
}

// Tronque un texte avec ellipsis
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 1) + '…'
}
