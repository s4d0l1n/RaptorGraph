import { useState, useMemo } from 'react'
import { X, Search as SearchIcon, Tag, GitBranch, Hash } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useGraphStore } from '@/stores/graphStore'

/**
 * Fuzzy search implementation
 * Returns true if pattern roughly matches text
 */
function fuzzyMatch(pattern: string, text: string): boolean {
  const patternLower = pattern.toLowerCase()
  const textLower = text.toLowerCase()

  // Exact substring match
  if (textLower.includes(patternLower)) return true

  // Fuzzy match: all pattern chars appear in order
  let patternIndex = 0
  for (let i = 0; i < textLower.length && patternIndex < patternLower.length; i++) {
    if (textLower[i] === patternLower[patternIndex]) {
      patternIndex++
    }
  }
  return patternIndex === patternLower.length
}

/**
 * Global search and filter panel
 */
export function SearchFilterPanel() {
  const { activePanel, setActivePanel, setFilteredNodeIds } = useUIStore()
  const { nodes, edges } = useGraphStore()

  const isOpen = activePanel === 'search'

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [minInDegree, setMinInDegree] = useState<string>('')
  const [maxInDegree, setMaxInDegree] = useState<string>('')
  const [minOutDegree, setMinOutDegree] = useState<string>('')
  const [maxOutDegree, setMaxOutDegree] = useState<string>('')
  const [minTotalDegree, setMinTotalDegree] = useState<string>('')
  const [maxTotalDegree, setMaxTotalDegree] = useState<string>('')
  const [attributeFilters, setAttributeFilters] = useState<Array<{ attribute: string; value: string }>>([])

  // Extract all available tags and attributes
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    nodes.forEach((node) => {
      node.tags.forEach((tag) => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [nodes])

  const allAttributes = useMemo(() => {
    const attrSet = new Set<string>()
    nodes.forEach((node) => {
      Object.keys(node.attributes).forEach((key) => attrSet.add(key))
    })
    return Array.from(attrSet).sort()
  }, [nodes])

  // Calculate degrees for each node
  const nodeDegrees = useMemo(() => {
    const degreeMap = new Map<string, { in: number; out: number; total: number }>()

    nodes.forEach((node) => {
      degreeMap.set(node.id, { in: 0, out: 0, total: 0 })
    })

    edges.forEach((edge) => {
      const sourceData = degreeMap.get(edge.source)
      const targetData = degreeMap.get(edge.target)

      if (sourceData) {
        sourceData.out++
        sourceData.total++
      }
      if (targetData) {
        targetData.in++
        targetData.total++
      }
    })

    return degreeMap
  }, [nodes, edges])

  // Apply filters
  const filteredNodes = useMemo(() => {
    let result = [...nodes]

    // Search query (fuzzy match on ID, label, and all attribute values)
    if (searchQuery.trim()) {
      result = result.filter((node) => {
        // Check ID and label
        if (fuzzyMatch(searchQuery, node.id)) return true
        if (fuzzyMatch(searchQuery, node.label)) return true

        // Check all attribute values
        for (const value of Object.values(node.attributes)) {
          if (Array.isArray(value)) {
            if (value.some((v) => fuzzyMatch(searchQuery, v))) return true
          } else if (fuzzyMatch(searchQuery, String(value))) {
            return true
          }
        }

        return false
      })
    }

    // Tag filters
    if (selectedTags.length > 0) {
      result = result.filter((node) =>
        selectedTags.some((tag) => node.tags.includes(tag))
      )
    }

    // Degree filters
    const minIn = minInDegree ? parseInt(minInDegree) : null
    const maxIn = maxInDegree ? parseInt(maxInDegree) : null
    const minOut = minOutDegree ? parseInt(minOutDegree) : null
    const maxOut = maxOutDegree ? parseInt(maxOutDegree) : null
    const minTotal = minTotalDegree ? parseInt(minTotalDegree) : null
    const maxTotal = maxTotalDegree ? parseInt(maxTotalDegree) : null

    if (minIn !== null || maxIn !== null || minOut !== null || maxOut !== null || minTotal !== null || maxTotal !== null) {
      result = result.filter((node) => {
        const degrees = nodeDegrees.get(node.id)
        if (!degrees) return false

        if (minIn !== null && degrees.in < minIn) return false
        if (maxIn !== null && degrees.in > maxIn) return false
        if (minOut !== null && degrees.out < minOut) return false
        if (maxOut !== null && degrees.out > maxOut) return false
        if (minTotal !== null && degrees.total < minTotal) return false
        if (maxTotal !== null && degrees.total > maxTotal) return false

        return true
      })
    }

    // Attribute filters
    if (attributeFilters.length > 0) {
      result = result.filter((node) =>
        attributeFilters.every((filter) => {
          const attrValue = node.attributes[filter.attribute]
          if (!attrValue) return false

          if (Array.isArray(attrValue)) {
            return attrValue.some((v) => fuzzyMatch(filter.value, v))
          }
          return fuzzyMatch(filter.value, String(attrValue))
        })
      )
    }

    return result
  }, [nodes, searchQuery, selectedTags, minInDegree, maxInDegree, minOutDegree, maxOutDegree, minTotalDegree, maxTotalDegree, attributeFilters, nodeDegrees])

  // Update filtered node IDs when filters change
  useMemo(() => {
    const filteredIds = new Set(filteredNodes.map((n) => n.id))
    setFilteredNodeIds(filteredIds)
  }, [filteredNodes, setFilteredNodeIds])

  if (!isOpen) return null

  const handleClose = () => {
    setActivePanel(null)
  }

  const handleClearFilters = () => {
    setSearchQuery('')
    setSelectedTags([])
    setMinInDegree('')
    setMaxInDegree('')
    setMinOutDegree('')
    setMaxOutDegree('')
    setMinTotalDegree('')
    setMaxTotalDegree('')
    setAttributeFilters([])
  }

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag))
    } else {
      setSelectedTags([...selectedTags, tag])
    }
  }

  const handleAddAttributeFilter = () => {
    if (allAttributes.length === 0) return
    setAttributeFilters([
      ...attributeFilters,
      { attribute: allAttributes[0], value: '' },
    ])
  }

  const handleRemoveAttributeFilter = (index: number) => {
    setAttributeFilters(attributeFilters.filter((_, i) => i !== index))
  }

  const handleUpdateAttributeFilter = (
    index: number,
    updates: Partial<{ attribute: string; value: string }>
  ) => {
    setAttributeFilters(
      attributeFilters.map((filter, i) =>
        i === index ? { ...filter, ...updates } : filter
      )
    )
  }

  const hasActiveFilters =
    searchQuery.trim() ||
    selectedTags.length > 0 ||
    minInDegree ||
    maxInDegree ||
    minOutDegree ||
    maxOutDegree ||
    minTotalDegree ||
    maxTotalDegree ||
    attributeFilters.length > 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
      <div className="bg-dark-secondary border border-dark rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Search & Filter</h2>
            <p className="text-sm text-slate-400 mt-1">
              Showing {filteredNodes.length} of {nodes.length} nodes
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-dark rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Search Query */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <SearchIcon className="w-5 h-5 text-slate-400" />
              <h3 className="text-lg font-semibold text-slate-100">Search</h3>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Fuzzy search across IDs, labels, and attributes..."
              className="w-full px-4 py-2 bg-dark border border-dark rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyber-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Try typing partial matches - e.g., "srv" matches "server-01"
            </p>
          </section>

          {/* Tag Filter */}
          {allTags.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-5 h-5 text-slate-400" />
                <h3 className="text-lg font-semibold text-slate-100">Tags</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleToggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-cyber-500 text-white'
                        : 'bg-dark text-slate-400 hover:bg-dark-tertiary'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Degree Filters */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <GitBranch className="w-5 h-5 text-slate-400" />
              <h3 className="text-lg font-semibold text-slate-100">Connection Degree</h3>
            </div>
            <div className="space-y-3">
              {/* In-Degree */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  In-Degree (incoming connections)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={minInDegree}
                    onChange={(e) => setMinInDegree(e.target.value)}
                    placeholder="Min"
                    min={0}
                    className="px-3 py-2 bg-dark border border-dark rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyber-500"
                  />
                  <input
                    type="number"
                    value={maxInDegree}
                    onChange={(e) => setMaxInDegree(e.target.value)}
                    placeholder="Max"
                    min={0}
                    className="px-3 py-2 bg-dark border border-dark rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyber-500"
                  />
                </div>
              </div>

              {/* Out-Degree */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Out-Degree (outgoing connections)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={minOutDegree}
                    onChange={(e) => setMinOutDegree(e.target.value)}
                    placeholder="Min"
                    min={0}
                    className="px-3 py-2 bg-dark border border-dark rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyber-500"
                  />
                  <input
                    type="number"
                    value={maxOutDegree}
                    onChange={(e) => setMaxOutDegree(e.target.value)}
                    placeholder="Max"
                    min={0}
                    className="px-3 py-2 bg-dark border border-dark rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyber-500"
                  />
                </div>
              </div>

              {/* Total Degree */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Total Degree (all connections)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={minTotalDegree}
                    onChange={(e) => setMinTotalDegree(e.target.value)}
                    placeholder="Min"
                    min={0}
                    className="px-3 py-2 bg-dark border border-dark rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyber-500"
                  />
                  <input
                    type="number"
                    value={maxTotalDegree}
                    onChange={(e) => setMaxTotalDegree(e.target.value)}
                    placeholder="Max"
                    min={0}
                    className="px-3 py-2 bg-dark border border-dark rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyber-500"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Attribute Filters */}
          {allAttributes.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Hash className="w-5 h-5 text-slate-400" />
                  <h3 className="text-lg font-semibold text-slate-100">Attribute Filters</h3>
                </div>
                <button
                  onClick={handleAddAttributeFilter}
                  className="px-3 py-1 bg-cyber-500 hover:bg-cyber-600 text-white rounded text-sm transition-colors"
                >
                  Add Filter
                </button>
              </div>
              <div className="space-y-2">
                {attributeFilters.map((filter, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      value={filter.attribute}
                      onChange={(e) =>
                        handleUpdateAttributeFilter(index, { attribute: e.target.value })
                      }
                      className="px-3 py-2 bg-dark border border-dark rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyber-500"
                    >
                      {allAttributes.map((attr) => (
                        <option key={attr} value={attr}>
                          {attr}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={filter.value}
                      onChange={(e) =>
                        handleUpdateAttributeFilter(index, { value: e.target.value })
                      }
                      placeholder="Value to match"
                      className="flex-1 px-3 py-2 bg-dark border border-dark rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyber-500"
                    />
                    <button
                      onClick={() => handleRemoveAttributeFilter(index)}
                      className="p-2 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                      aria-label="Remove filter"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-dark">
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 bg-dark hover:bg-dark-tertiary text-slate-300 rounded transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
          <div className="text-sm text-slate-400">
            {hasActiveFilters && (
              <span>
                {nodes.length - filteredNodes.length} node
                {nodes.length - filteredNodes.length !== 1 ? 's' : ''} hidden
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
