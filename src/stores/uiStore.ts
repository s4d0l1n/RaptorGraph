import { create } from 'zustand'

/**
 * UI state management store
 * Handles sidebar, panels, selected nodes, and UI preferences
 */

interface UIState {
  // Sidebar state
  sidebarCollapsed: boolean
  activePanel: string | null

  // Selection state
  selectedNodeId: string | null
  selectedEdgeIds: string[]

  // Filter state
  filteredNodeIds: Set<string> | null

  // Dark mode
  darkMode: boolean

  // Loading states
  isLoading: boolean
  loadingMessage: string

  // Actions
  toggleSidebar: () => void
  setActivePanel: (panelId: string | null) => void
  setSelectedNodeId: (nodeId: string | null) => void
  setSelectedEdgeIds: (edgeIds: string[]) => void
  setFilteredNodeIds: (nodeIds: Set<string> | null) => void
  toggleDarkMode: () => void
  setLoading: (isLoading: boolean, message?: string) => void
  clearSelection: () => void
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  sidebarCollapsed: false,
  activePanel: null,
  selectedNodeId: null,
  selectedEdgeIds: [],
  filteredNodeIds: null,
  darkMode: true,
  isLoading: false,
  loadingMessage: '',

  // Actions
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setActivePanel: (panelId) =>
    set({ activePanel: panelId }),

  setSelectedNodeId: (nodeId) =>
    set({ selectedNodeId: nodeId }),

  setSelectedEdgeIds: (edgeIds) =>
    set({ selectedEdgeIds: edgeIds }),

  setFilteredNodeIds: (nodeIds) =>
    set({ filteredNodeIds: nodeIds }),

  toggleDarkMode: () =>
    set((state) => ({ darkMode: !state.darkMode })),

  setLoading: (isLoading, message = '') =>
    set({ isLoading, loadingMessage: message }),

  clearSelection: () =>
    set({ selectedNodeId: null, selectedEdgeIds: [] }),
}))
