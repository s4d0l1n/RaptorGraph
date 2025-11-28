import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LayoutConfig, GroupingConfig } from '@/types'

/**
 * Project metadata and configuration store
 * Handles project-level settings, layout, and grouping configuration
 * Persists to localStorage to survive page refreshes
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

  // Grouping configuration
  groupingConfig: GroupingConfig

  // Actions
  setProjectName: (name: string) => void
  setDescription: (description: string) => void
  updateModifiedAt: () => void
  setLayoutConfig: (config: LayoutConfig) => void
  setGroupingConfig: (config: GroupingConfig) => void
  resetProject: () => void
}

const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  type: 'fcose',
  options: {},
}

const DEFAULT_GROUPING_CONFIG: GroupingConfig = {
  enabled: false,
  autoCollapse: true,
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
  // Initial state
  projectName: 'Untitled Project',
  description: '',
  version: '1.0.0',
  createdAt: Date.now(),
  modifiedAt: Date.now(),
  layoutConfig: DEFAULT_LAYOUT_CONFIG,
  groupingConfig: DEFAULT_GROUPING_CONFIG,

  // Actions
  setProjectName: (name) =>
    set({ projectName: name, modifiedAt: Date.now() }),

  setDescription: (description) =>
    set({ description, modifiedAt: Date.now() }),

  updateModifiedAt: () =>
    set({ modifiedAt: Date.now() }),

  setLayoutConfig: (config) =>
    set({ layoutConfig: config, modifiedAt: Date.now() }),

  setGroupingConfig: (config) =>
    set({ groupingConfig: config, modifiedAt: Date.now() }),

  resetProject: () =>
    set({
      projectName: 'Untitled Project',
      description: '',
      version: '1.0.0',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      layoutConfig: DEFAULT_LAYOUT_CONFIG,
      groupingConfig: DEFAULT_GROUPING_CONFIG,
    }),
    }),
    {
      name: 'raptorgraph-project-storage',
      version: 1,
    }
  )
)
