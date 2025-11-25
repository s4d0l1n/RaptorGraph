import { create } from 'zustand'
import type { CardTemplate, EdgeTemplate } from '@/types'

/**
 * Template management store
 * Handles card templates and edge templates
 */

interface TemplateState {
  // Templates
  cardTemplates: CardTemplate[]
  edgeTemplates: EdgeTemplate[]
  defaultCardTemplateId: string | null
  defaultEdgeTemplateId: string | null

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

  // General actions
  clearAllTemplates: () => void
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  // Initial state
  cardTemplates: [],
  edgeTemplates: [],
  defaultCardTemplateId: null,
  defaultEdgeTemplateId: null,

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

  // General actions
  clearAllTemplates: () =>
    set({
      cardTemplates: [],
      edgeTemplates: [],
      defaultCardTemplateId: null,
      defaultEdgeTemplateId: null,
    }),
}))
