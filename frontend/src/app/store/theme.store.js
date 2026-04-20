// frontend/src/app/store/theme.store.js
import { defineStore } from 'pinia'

const STORAGE_KEY = 'ot_theme'

function getInitialTheme() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

function applyTheme(mode) {
  const root = document.documentElement

  if (mode === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    mode: getInitialTheme(),
  }),

  getters: {
    isDark: (state) => state.mode === 'dark',
    isLight: (state) => state.mode === 'light',
  },

  actions: {
    init() {
      applyTheme(this.mode)
    },

    setMode(mode) {
      this.mode = mode === 'dark' ? 'dark' : 'light'
      localStorage.setItem(STORAGE_KEY, this.mode)
      applyTheme(this.mode)
    },

    toggle() {
      this.setMode(this.isDark ? 'light' : 'dark')
    },
  },
})