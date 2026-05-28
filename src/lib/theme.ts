export interface AccentPreset {
  name: string
  color: string
}

export const ACCENTS: AccentPreset[] = [
  { name: 'Bitcoin', color: '#f7931a' },
  { name: 'Emerald', color: '#16c784' },
  { name: 'Azure', color: '#3b82f6' },
  { name: 'Violet', color: '#8b5cf6' },
  { name: 'Magenta', color: '#ec4899' },
  { name: 'Cyan', color: '#06b6d4' },
]

const KEY = 'gazewallet:accent:v1'

export function loadAccent(): string {
  return localStorage.getItem(KEY) ?? ACCENTS[0].color
}

export function applyAccent(color: string): void {
  document.documentElement.style.setProperty('--accent', color)
}

export function saveAccent(color: string): void {
  localStorage.setItem(KEY, color)
  applyAccent(color)
}
