import { create } from 'zustand'
import type { LayoutConfig } from '@/types'

/**
 * Project metadata and configuration store
 * Handles project-level settings and layout configuration
 */

interface ProjectState {
  // Project metadata
  projectName: string
  description: string
  version: string
  createdAt: number
  modifiedAt: number

  // Layout configuration
  layoutConfig: LayoutConfig

  // Actions
  setProjectName: (name: string) => void
  setDescription: (description: string) => void
  updateModifiedAt: () => void
  setLayoutConfig: (config: LayoutConfig) => void
  resetProject: () => void
}

const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  type: 'fcose',
  options: {},
}

export const useProjectStore = create<ProjectState>((set) => ({
  // Initial state
  projectName: 'Untitled Project',
  description: '',
  version: '1.0.0',
  createdAt: Date.now(),
  modifiedAt: Date.now(),
  layoutConfig: DEFAULT_LAYOUT_CONFIG,

  // Actions
  setProjectName: (name) =>
    set({ projectName: name, modifiedAt: Date.now() }),

  setDescription: (description) =>
    set({ description, modifiedAt: Date.now() }),

  updateModifiedAt: () =>
    set({ modifiedAt: Date.now() }),

  setLayoutConfig: (config) =>
    set({ layoutConfig: config, modifiedAt: Date.now() }),

  resetProject: () =>
    set({
      projectName: 'Untitled Project',
      description: '',
      version: '1.0.0',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      layoutConfig: DEFAULT_LAYOUT_CONFIG,
    }),
}))
