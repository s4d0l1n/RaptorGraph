import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StyleRule } from '@/types'

/**
 * Style rules management store
 * Handles conditional styling rules with ordering
 * Persists to localStorage to survive page refreshes
 */

interface RulesState {
  // Style rules
  styleRules: StyleRule[]

  // Actions
  addRule: (rule: StyleRule) => void
  updateRule: (ruleId: string, updates: Partial<StyleRule>) => void
  removeRule: (ruleId: string) => void
  toggleRuleEnabled: (ruleId: string) => void
  reorderRules: (newOrder: StyleRule[]) => void
  getRuleById: (ruleId: string) => StyleRule | undefined
  getEnabledRules: () => StyleRule[]
  clearAllRules: () => void
}

export const useRulesStore = create<RulesState>()(
  persist(
    (set, get) => ({
  // Initial state
  styleRules: [],

  // Actions
  addRule: (rule) =>
    set((state) => ({
      styleRules: [...state.styleRules, rule],
    })),

  updateRule: (ruleId, updates) =>
    set((state) => ({
      styleRules: state.styleRules.map((r) =>
        r.id === ruleId ? { ...r, ...updates } : r
      ),
    })),

  removeRule: (ruleId) =>
    set((state) => ({
      styleRules: state.styleRules.filter((r) => r.id !== ruleId),
    })),

  toggleRuleEnabled: (ruleId) =>
    set((state) => ({
      styleRules: state.styleRules.map((r) =>
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      ),
    })),

  reorderRules: (newOrder) =>
    set({
      styleRules: newOrder.map((rule, index) => ({
        ...rule,
        order: index,
      })),
    }),

  getRuleById: (ruleId) =>
    get().styleRules.find((r) => r.id === ruleId),

  getEnabledRules: () =>
    get().styleRules.filter((r) => r.enabled).sort((a, b) => a.order - b.order),

  clearAllRules: () =>
    set({ styleRules: [] }),
    }),
    {
      name: 'raptorgraph-rules-storage',
      version: 1,
    }
  )
)
