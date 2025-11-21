/**
 * Style Store - Manages conditional styling rules
 */

import { create } from 'zustand'
import type { StyleRule } from '../types'

interface StyleStore {
  // State
  styleRules: StyleRule[]

  // Operations
  addStyleRule: (rule: StyleRule) => void
  updateStyleRule: (id: string, updates: Partial<StyleRule>) => void
  removeStyleRule: (id: string) => void
  reorderStyleRules: (rules: StyleRule[]) => void
  toggleStyleRule: (id: string) => void
  clearStyleRules: () => void

  // Queries
  getEnabledRules: () => StyleRule[]
  getStyleRule: (id: string) => StyleRule | undefined
}

export const useStyleStore = create<StyleStore>((set, get) => ({
  // Initial state
  styleRules: [],

  // Operations
  addStyleRule: (rule) => {
    set((state) => ({
      styleRules: [...state.styleRules, rule],
    }))
  },

  updateStyleRule: (id, updates) => {
    set((state) => ({
      styleRules: state.styleRules.map((rule) =>
        rule.id === id ? { ...rule, ...updates } : rule
      ),
    }))
  },

  removeStyleRule: (id) => {
    set((state) => ({
      styleRules: state.styleRules.filter((rule) => rule.id !== id),
    }))
  },

  reorderStyleRules: (rules) => {
    // Update order property based on array position
    const reorderedRules = rules.map((rule, index) => ({
      ...rule,
      order: index,
    }))
    set({ styleRules: reorderedRules })
  },

  toggleStyleRule: (id) => {
    set((state) => ({
      styleRules: state.styleRules.map((rule) =>
        rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
      ),
    }))
  },

  clearStyleRules: () => {
    set({ styleRules: [] })
  },

  // Queries
  getEnabledRules: () => {
    return get()
      .styleRules.filter((rule) => rule.enabled)
      .sort((a, b) => a.order - b.order)
  },

  getStyleRule: (id) => {
    return get().styleRules.find((rule) => rule.id === id)
  },
}))
