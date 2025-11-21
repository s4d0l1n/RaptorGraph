/**
 * UI Store - Manages UI state, panels, and user interactions
 */

import { create } from 'zustand'
import type { SelectedNode, UIPanelState } from '../types'

interface UIStore {
  // State
  panels: UIPanelState
  selectedNode: SelectedNode | null
  darkMode: boolean
  loading: boolean
  error: string | null
  success: string | null

  // Panel operations
  togglePanel: (panel: keyof UIPanelState) => void
  openPanel: (panel: keyof UIPanelState) => void
  closePanel: (panel: keyof UIPanelState) => void
  closeAllPanels: () => void

  // Selection
  selectNode: (node: SelectedNode | null) => void
  clearSelection: () => void

  // Theme
  toggleDarkMode: () => void
  setDarkMode: (enabled: boolean) => void

  // Messages
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setSuccess: (success: string | null) => void
  clearMessages: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  // Initial state
  panels: {
    uploadWizard: false,
    columnMapper: false,
    stylePanel: false,
    detailPanel: false,
    layoutPanel: false,
  },
  selectedNode: null,
  darkMode: true, // Default to dark mode
  loading: false,
  error: null,
  success: null,

  // Panel operations
  togglePanel: (panel) => {
    set((state) => ({
      panels: {
        ...state.panels,
        [panel]: !state.panels[panel],
      },
    }))
  },

  openPanel: (panel) => {
    set((state) => ({
      panels: {
        ...state.panels,
        [panel]: true,
      },
    }))
  },

  closePanel: (panel) => {
    set((state) => ({
      panels: {
        ...state.panels,
        [panel]: false,
      },
    }))
  },

  closeAllPanels: () => {
    set({
      panels: {
        uploadWizard: false,
        columnMapper: false,
        stylePanel: false,
        detailPanel: false,
        layoutPanel: false,
      },
    })
  },

  // Selection
  selectNode: (node) => {
    set({ selectedNode: node })
    if (node) {
      set((state) => ({
        panels: { ...state.panels, detailPanel: true },
      }))
    }
  },

  clearSelection: () => {
    set({ selectedNode: null })
  },

  // Theme
  toggleDarkMode: () => {
    set((state) => {
      const newDarkMode = !state.darkMode
      // Update document class
      if (newDarkMode) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      return { darkMode: newDarkMode }
    })
  },

  setDarkMode: (enabled) => {
    set({ darkMode: enabled })
    if (enabled) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  },

  // Messages
  setLoading: (loading) => {
    set({ loading })
  },

  setError: (error) => {
    set({ error, success: null })
    // Auto-clear after 5 seconds
    if (error) {
      setTimeout(() => {
        set((state) => (state.error === error ? { error: null } : {}))
      }, 5000)
    }
  },

  setSuccess: (success) => {
    set({ success, error: null })
    // Auto-clear after 3 seconds
    if (success) {
      setTimeout(() => {
        set((state) => (state.success === success ? { success: null } : {}))
      }, 3000)
    }
  },

  clearMessages: () => {
    set({ error: null, success: null })
  },
}))
