import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CardTemplate, EdgeTemplate, FontTemplate } from '@/types'

/**
 * Template management store
 * Handles card templates, edge templates, and font templates
 */

interface TemplateState {
  // Templates
  cardTemplates: CardTemplate[]
  edgeTemplates: EdgeTemplate[]
  fontTemplates: FontTemplate[]
  defaultCardTemplateId: string | null
  defaultEdgeTemplateId: string | null
  defaultFontTemplateId: string | null

  // Card template actions
  addCardTemplate: (template: CardTemplate) => void
  updateCardTemplate: (templateId: string, updates: Partial<CardTemplate>) => void
  removeCardTemplate: (templateId: string) => void
  setDefaultCardTemplate: (templateId: string) => void
  getCardTemplateById: (templateId: string) => CardTemplate | undefined
  getDefaultCardTemplate: () => CardTemplate | undefined

  // Edge template actions
  addEdgeTemplate: (template: EdgeTemplate) => void
  updateEdgeTemplate: (templateId: string, updates: Partial<EdgeTemplate>) => void
  removeEdgeTemplate: (templateId: string) => void
  setDefaultEdgeTemplate: (templateId: string) => void
  getEdgeTemplateById: (templateId: string) => EdgeTemplate | undefined
  getDefaultEdgeTemplate: () => EdgeTemplate | undefined

  // Font template actions
  addFontTemplate: (template: FontTemplate) => void
  updateFontTemplate: (templateId: string, updates: Partial<FontTemplate>) => void
  removeFontTemplate: (templateId: string) => void
  setDefaultFontTemplate: (templateId: string) => void
  getFontTemplateById: (templateId: string) => FontTemplate | undefined
  getDefaultFontTemplate: () => FontTemplate | undefined

  // General actions
  clearAllTemplates: () => void
}

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set, get) => ({
  // Initial state
  cardTemplates: [],
  edgeTemplates: [],
  fontTemplates: [],
  defaultCardTemplateId: null,
  defaultEdgeTemplateId: null,
  defaultFontTemplateId: null,

  // Card template actions
  addCardTemplate: (template) =>
    set((state) => ({
      cardTemplates: [...state.cardTemplates, template],
    })),

  updateCardTemplate: (templateId, updates) =>
    set((state) => ({
      cardTemplates: state.cardTemplates.map((t) =>
        t.id === templateId ? { ...t, ...updates } : t
      ),
    })),

  removeCardTemplate: (templateId) =>
    set((state) => ({
      cardTemplates: state.cardTemplates.filter((t) => t.id !== templateId),
      defaultCardTemplateId:
        state.defaultCardTemplateId === templateId
          ? null
          : state.defaultCardTemplateId,
    })),

  setDefaultCardTemplate: (templateId) =>
    set((state) => ({
      defaultCardTemplateId: templateId,
      cardTemplates: state.cardTemplates.map((t) => ({
        ...t,
        isDefault: t.id === templateId,
      })),
    })),

  getCardTemplateById: (templateId) =>
    get().cardTemplates.find((t) => t.id === templateId),

  getDefaultCardTemplate: () => {
    const state = get()
    if (state.defaultCardTemplateId) {
      return state.cardTemplates.find((t) => t.id === state.defaultCardTemplateId)
    }
    return state.cardTemplates.find((t) => t.isDefault)
  },

  // Edge template actions
  addEdgeTemplate: (template) =>
    set((state) => ({
      edgeTemplates: [...state.edgeTemplates, template],
    })),

  updateEdgeTemplate: (templateId, updates) =>
    set((state) => ({
      edgeTemplates: state.edgeTemplates.map((t) =>
        t.id === templateId ? { ...t, ...updates } : t
      ),
    })),

  removeEdgeTemplate: (templateId) =>
    set((state) => ({
      edgeTemplates: state.edgeTemplates.filter((t) => t.id !== templateId),
      defaultEdgeTemplateId:
        state.defaultEdgeTemplateId === templateId
          ? null
          : state.defaultEdgeTemplateId,
    })),

  setDefaultEdgeTemplate: (templateId) =>
    set((state) => ({
      defaultEdgeTemplateId: templateId,
      edgeTemplates: state.edgeTemplates.map((t) => ({
        ...t,
        isDefault: t.id === templateId,
      })),
    })),

  getEdgeTemplateById: (templateId) =>
    get().edgeTemplates.find((t) => t.id === templateId),

  getDefaultEdgeTemplate: () => {
    const state = get()
    if (state.defaultEdgeTemplateId) {
      return state.edgeTemplates.find((t) => t.id === state.defaultEdgeTemplateId)
    }
    return state.edgeTemplates.find((t) => t.isDefault)
  },

  // Font template actions
  addFontTemplate: (template) =>
    set((state) => ({
      fontTemplates: [...state.fontTemplates, template],
    })),

  updateFontTemplate: (templateId, updates) =>
    set((state) => ({
      fontTemplates: state.fontTemplates.map((t) =>
        t.id === templateId ? { ...t, ...updates } : t
      ),
    })),

  removeFontTemplate: (templateId) =>
    set((state) => ({
      fontTemplates: state.fontTemplates.filter((t) => t.id !== templateId),
      defaultFontTemplateId:
        state.defaultFontTemplateId === templateId
          ? null
          : state.defaultFontTemplateId,
    })),

  setDefaultFontTemplate: (templateId) =>
    set((state) => ({
      defaultFontTemplateId: templateId,
      fontTemplates: state.fontTemplates.map((t) => ({
        ...t,
        isDefault: t.id === templateId,
      })),
    })),

  getFontTemplateById: (templateId) =>
    get().fontTemplates.find((t) => t.id === templateId),

  getDefaultFontTemplate: () => {
    const state = get()
    if (state.defaultFontTemplateId) {
      return state.fontTemplates.find((t) => t.id === state.defaultFontTemplateId)
    }
    return state.fontTemplates.find((t) => t.isDefault)
  },

  // General actions
  clearAllTemplates: () =>
    set({
      cardTemplates: [],
      edgeTemplates: [],
      fontTemplates: [],
      defaultCardTemplateId: null,
      defaultEdgeTemplateId: null,
      defaultFontTemplateId: null,
    }),
    }),
    {
      name: 'raptorgraph-template-storage',
      version: 1,
    }
  )
)
