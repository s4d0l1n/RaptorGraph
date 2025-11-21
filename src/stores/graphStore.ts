/**
 * Graph Store - Manages nodes and edges
 * Central state for all graph data
 */

import { create } from 'zustand'
import type { NodeData, EdgeData } from '../types'

interface GraphStore {
  // State
  nodes: NodeData[]
  edges: EdgeData[]

  // Node operations
  addNode: (node: NodeData) => void
  addNodes: (nodes: NodeData[]) => void
  updateNode: (id: string, updates: Partial<NodeData>) => void
  removeNode: (id: string) => void
  getNode: (id: string) => NodeData | undefined
  clearNodes: () => void

  // Edge operations
  addEdge: (edge: EdgeData) => void
  addEdges: (edges: EdgeData[]) => void
  removeEdge: (id: string) => void
  removeEdgesBetween: (sourceId: string, targetId: string) => void
  getEdgesForNode: (nodeId: string) => EdgeData[]
  clearEdges: () => void

  // Bulk operations
  clearGraph: () => void
  setGraphData: (nodes: NodeData[], edges: EdgeData[]) => void

  // Queries
  getNodeByAttribute: (attribute: string, value: string) => NodeData[]
  getAllAttributeNames: () => string[]
  getAllAttributeValues: (attribute: string) => string[]
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  // Initial state
  nodes: [],
  edges: [],

  // Node operations
  addNode: (node) => {
    set((state) => {
      // Check if node already exists
      const exists = state.nodes.some((n) => n.id === node.id)
      if (exists) {
        // Merge with existing node
        return {
          nodes: state.nodes.map((n) =>
            n.id === node.id
              ? {
                  ...n,
                  ...node,
                  // Merge attributes
                  attributes: { ...n.attributes, ...node.attributes },
                  // Merge tags (deduplicate)
                  tags: Array.from(new Set([...n.tags, ...node.tags])),
                  // Merge sources
                  _sources: Array.from(
                    new Set([...(n._sources || []), ...(node._sources || [])])
                  ),
                }
              : n
          ),
        }
      }
      return { nodes: [...state.nodes, node] }
    })
  },

  addNodes: (nodes) => {
    nodes.forEach((node) => get().addNode(node))
  },

  updateNode: (id, updates) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, ...updates } : node
      ),
    }))
  },

  removeNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== id),
      // Also remove edges connected to this node
      edges: state.edges.filter(
        (edge) => edge.source !== id && edge.target !== id
      ),
    }))
  },

  getNode: (id) => {
    return get().nodes.find((node) => node.id === id)
  },

  clearNodes: () => {
    set({ nodes: [] })
  },

  // Edge operations
  addEdge: (edge) => {
    set((state) => {
      // Generate ID if not provided
      const edgeWithId = {
        ...edge,
        id: edge.id || `${edge.source}-${edge.target}-${Date.now()}`,
      }

      // Check for duplicate
      const duplicate = state.edges.some(
        (e) => e.source === edge.source && e.target === edge.target
      )

      if (duplicate) {
        return state
      }

      return { edges: [...state.edges, edgeWithId] }
    })
  },

  addEdges: (edges) => {
    edges.forEach((edge) => get().addEdge(edge))
  },

  removeEdge: (id) => {
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== id),
    }))
  },

  removeEdgesBetween: (sourceId, targetId) => {
    set((state) => ({
      edges: state.edges.filter(
        (edge) =>
          !(edge.source === sourceId && edge.target === targetId) &&
          !(edge.source === targetId && edge.target === sourceId)
      ),
    }))
  },

  getEdgesForNode: (nodeId) => {
    return get().edges.filter(
      (edge) => edge.source === nodeId || edge.target === nodeId
    )
  },

  clearEdges: () => {
    set({ edges: [] })
  },

  // Bulk operations
  clearGraph: () => {
    set({ nodes: [], edges: [] })
  },

  setGraphData: (nodes, edges) => {
    set({ nodes, edges })
  },

  // Queries
  getNodeByAttribute: (attribute, value) => {
    return get().nodes.filter((node) => {
      const attrValue = node.attributes[attribute]
      if (!attrValue) return false

      if (Array.isArray(attrValue)) {
        return attrValue.some(
          (v) => v.toLowerCase() === value.toLowerCase()
        )
      }

      return attrValue.toLowerCase() === value.toLowerCase()
    })
  },

  getAllAttributeNames: () => {
    const allAttributes = new Set<string>()
    get().nodes.forEach((node) => {
      Object.keys(node.attributes).forEach((key) => allAttributes.add(key))
    })
    return Array.from(allAttributes).sort()
  },

  getAllAttributeValues: (attribute) => {
    const values = new Set<string>()
    get().nodes.forEach((node) => {
      const attrValue = node.attributes[attribute]
      if (attrValue) {
        if (Array.isArray(attrValue)) {
          attrValue.forEach((v) => values.add(v))
        } else {
          values.add(attrValue)
        }
      }
    })
    return Array.from(values).sort()
  },
}))
