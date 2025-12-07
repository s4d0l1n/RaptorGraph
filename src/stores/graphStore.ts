import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GraphNode, GraphEdge, MetaNode } from '@/types'

/**
 * Graph data store
 * Manages nodes, edges, and meta-nodes for the visualization
 * Persists to localStorage to survive page refreshes
 */

export interface PhysicsModifiers {
  edgeLength: number
  springStrength: number
  centerGravity: number
}

interface GraphState {
  // Graph data
  nodes: GraphNode[]
  edges: GraphEdge[]
  metaNodes: MetaNode[]
  physicsModifiers: PhysicsModifiers

  // Actions
  setPhysicsModifiers: (modifiers: Partial<PhysicsModifiers>) => void
  setNodes: (nodes: GraphNode[]) => void
  setEdges: (edges: GraphEdge[]) => void
  addNode: (node: GraphNode) => void
  addEdge: (edge: GraphEdge) => void
  updateNode: (nodeId: string, updates: Partial<GraphNode>) => void
  updateEdge: (edgeId: string, updates: Partial<GraphEdge>) => void
  removeNode: (nodeId: string) => void
  removeEdge: (edgeId: string) => void
  clearGraph: () => void
  getNodeById: (nodeId: string) => GraphNode | undefined
  getEdgeById: (edgeId: string) => GraphEdge | undefined
  getConnectedEdges: (nodeId: string) => GraphEdge[]
  mergeNodes: (nodes: GraphNode[]) => void
  mergeEdges: (edges: GraphEdge[]) => void

  // Meta-node actions
  setMetaNodes: (metaNodes: MetaNode[]) => void
  toggleMetaNodeCollapse: (metaNodeId: string) => void
  getMetaNodeById: (metaNodeId: string) => MetaNode | undefined
}

export const useGraphStore = create<GraphState>()(
  persist(
    (set, get) => ({
  // Initial state
  nodes: [],
  edges: [],
  metaNodes: [],
  physicsModifiers: {
    edgeLength: 0,
    springStrength: 0,
    centerGravity: 0,
  },

  // Actions
  setPhysicsModifiers: (modifiers) =>
    set((state) => ({
      physicsModifiers: { ...state.physicsModifiers, ...modifiers },
    })),
  setNodes: (nodes) =>
    set({ nodes }),

  setEdges: (edges) =>
    set({ edges }),

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
    })),

  addEdge: (edge) =>
    set((state) => ({
      edges: [...state.edges, edge],
    })),

  updateNode: (nodeId, updates) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, ...updates } : n
      ),
    })),

  updateEdge: (edgeId, updates) =>
    set((state) => ({
      edges: state.edges.map((e) =>
        e.id === edgeId ? { ...e, ...updates } : e
      ),
    })),

  removeNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    })),

  removeEdge: (edgeId) =>
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== edgeId),
    })),

  clearGraph: () =>
    set({ nodes: [], edges: [], metaNodes: [] }),

  getNodeById: (nodeId) =>
    get().nodes.find((n) => n.id === nodeId),

  getEdgeById: (edgeId) =>
    get().edges.find((e) => e.id === edgeId),

  getConnectedEdges: (nodeId) =>
    get().edges.filter((e) => e.source === nodeId || e.target === nodeId),

  mergeNodes: (newNodes) =>
    set((state) => {
      const existingIds = new Set(state.nodes.map((n) => n.id))
      const nodesToAdd = newNodes.filter((n) => !existingIds.has(n.id))
      const nodesToUpdate = newNodes.filter((n) => existingIds.has(n.id))

      const updatedNodes = state.nodes.map((existing) => {
        const update = nodesToUpdate.find((n) => n.id === existing.id)
        if (update) {
          // Merge attributes and promote stub nodes
          return {
            ...existing,
            ...update,
            attributes: { ...existing.attributes, ...update.attributes },
            tags: Array.from(new Set([...existing.tags, ...update.tags])),
            sourceFiles: Array.from(new Set([...existing.sourceFiles, ...update.sourceFiles])),
            isStub: update.isStub === false ? false : existing.isStub,
          }
        }
        return existing
      })

      return {
        nodes: [...updatedNodes, ...nodesToAdd],
      }
    }),

  mergeEdges: (newEdges) =>
    set((state) => {
      const existingIds = new Set(state.edges.map((e) => e.id))
      const edgesToAdd = newEdges.filter((e) => !existingIds.has(e.id))
      return {
        edges: [...state.edges, ...edgesToAdd],
      }
    }),

  // Meta-node actions
  setMetaNodes: (metaNodes) =>
    set({ metaNodes }),

  toggleMetaNodeCollapse: (metaNodeId) =>
    set((state) => ({
      metaNodes: state.metaNodes.map((mn) =>
        mn.id === metaNodeId ? { ...mn, collapsed: !mn.collapsed } : mn
      ),
    })),

  getMetaNodeById: (metaNodeId) =>
    get().metaNodes.find((mn) => mn.id === metaNodeId),
    }),
    {
      name: 'raptorgraph-graph-storage',
      version: 1,
    }
  )
)
