/**
 * Layout Store - Manages graph layout configuration and node positions
 */

import { create } from 'zustand'
import type { LayoutConfig, NodePosition, LayoutType } from '../types'

interface LayoutStore {
  // State
  layoutConfig: LayoutConfig
  nodePositions: NodePosition[]

  // Operations
  setLayoutType: (type: LayoutType) => void
  setLayoutConfig: (config: LayoutConfig) => void
  saveNodePositions: (positions: NodePosition[]) => void
  getNodePosition: (nodeId: string) => NodePosition | undefined
  clearPositions: () => void
}

export const useLayoutStore = create<LayoutStore>((set, get) => ({
  // Initial state
  layoutConfig: {
    type: 'cose-bilkent',
    options: {
      // cose-bilkent default options
      animate: true,
      animationDuration: 1000,
      fit: true,
      padding: 30,
      randomize: false,
      nodeRepulsion: 4500,
      idealEdgeLength: 100,
      edgeElasticity: 0.45,
      nestingFactor: 0.1,
      gravity: 0.25,
      numIter: 2500,
      tile: true,
      tilingPaddingVertical: 10,
      tilingPaddingHorizontal: 10,
    },
  },
  nodePositions: [],

  // Operations
  setLayoutType: (type) => {
    set((state) => ({
      layoutConfig: {
        ...state.layoutConfig,
        type,
      },
    }))
  },

  setLayoutConfig: (config) => {
    set({ layoutConfig: config })
  },

  saveNodePositions: (positions) => {
    set({ nodePositions: positions })
  },

  getNodePosition: (nodeId) => {
    return get().nodePositions.find((pos) => pos.id === nodeId)
  },

  clearPositions: () => {
    set({ nodePositions: [] })
  },
}))
