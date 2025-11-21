/**
 * Column Mapping Wizard
 * Allows users to manually map CSV columns to roles (Node ID, Label, Attribute, Tag, Link, Ignore)
 */

import { useState, useMemo } from 'react'
import { X, Check } from 'lucide-react'
import { useCSVStore } from '../stores/csvStore'
import { useGraphStore } from '../stores/graphStore'
import { useUIStore } from '../stores/uiStore'
import { parseCSV } from '../utils/csvParser'
import { processCSVData, mergeNodes, mergeEdges } from '../utils/dataProcessor'
import type { ColumnMapping, ColumnRole } from '../types'

const ROLE_OPTIONS: { value: ColumnRole; label: string; description: string }[] = [
  {
    value: 'node_id',
    label: 'Node ID',
    description: 'Unique identifier (can only select once)',
  },
  {
    value: 'label',
    label: 'Label',
    description: 'Display label for the node',
  },
  {
    value: 'attribute',
    label: 'Attribute',
    description: 'Store as node attribute (specify name)',
  },
  {
    value: 'tag',
    label: 'Tag',
    description: 'Add as node tag(s)',
  },
  {
    value: 'link_to_attribute',
    label: 'Link → Attribute',
    description: 'Create edges by matching attribute values',
  },
  {
    value: 'ignore',
    label: 'Ignore',
    description: 'Skip this column',
  },
]

export function ColumnMapper() {
  const { currentFile, updateMapping } = useCSVStore()
  const { closePanel, setError, setSuccess, setLoading } = useUIStore()
  const { nodes, edges, setGraphData } = useGraphStore()
  const [mappings, setMappings] = useState<ColumnMapping[]>(
    currentFile?.mapping || []
  )

  if (!currentFile) {
    return null
  }

  const handleRoleChange = (columnName: string, role: ColumnRole) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.columnName === columnName
          ? {
              ...m,
              role,
              // Clear role-specific fields when changing role
              attributeName: role === 'attribute' || role === 'tag' ? m.attributeName : undefined,
              linkSourceAttr: undefined,
              linkTargetAttr: undefined,
            }
          : m
      )
    )
  }

  const handleAttributeNameChange = (columnName: string, attributeName: string) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.columnName === columnName ? { ...m, attributeName } : m
      )
    )
  }

  const handleLinkAttributeChange = (
    columnName: string,
    type: 'source' | 'target',
    value: string
  ) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.columnName === columnName
          ? {
              ...m,
              [type === 'source' ? 'linkSourceAttr' : 'linkTargetAttr']: value,
            }
          : m
      )
    )
  }

  const handleProcess = async () => {
    try {
      setLoading(true)

      // Validate mappings
      const nodeIdCount = mappings.filter((m) => m.role === 'node_id').length
      if (nodeIdCount === 0) {
        setError('Please select a Node ID column')
        return
      }
      if (nodeIdCount > 1) {
        setError('Only one Node ID column is allowed')
        return
      }

      // Validate attribute names
      for (const mapping of mappings) {
        if ((mapping.role === 'attribute' || mapping.role === 'tag') && !mapping.attributeName) {
          setError(`Please specify a name for the ${mapping.role} column: ${mapping.columnName}`)
          return
        }

        if (mapping.role === 'link_to_attribute') {
          if (!mapping.linkSourceAttr || !mapping.linkTargetAttr) {
            setError(`Please specify both source and target attributes for link column: ${mapping.columnName}`)
            return
          }
        }
      }

      // Save mappings
      updateMapping(currentFile.name, mappings)

      // Parse and process CSV
      const { data, error } = await parseCSV(currentFile.rawData)
      if (error) {
        setError(`Error parsing CSV: ${error}`)
        return
      }

      // Process data
      const result = processCSVData(data, mappings, currentFile.name)

      // Merge with existing graph data
      const mergedNodes = mergeNodes(nodes, result.nodes)
      const mergedEdges = mergeEdges(edges, result.edges)

      // Update graph
      setGraphData(mergedNodes, mergedEdges)

      setSuccess(
        `Processed ${currentFile.name}: ${result.nodes.length} nodes, ${result.edges.length} edges` +
          (result.stubsCreated > 0 ? `, ${result.stubsCreated} stubs created` : '')
      )

      // Close panel
      closePanel('columnMapper')
    } catch (error) {
      setError(
        `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    } finally {
      setLoading(false)
    }
  }

  // Check if node_id already selected
  const nodeIdSelected = mappings.some((m) => m.role === 'node_id')

  // Get all attribute names for link mapping dropdowns
  const _allAttributeNames = useMemo(() => {
    const attrs = new Set<string>()
    mappings.forEach((m) => {
      if (m.role === 'attribute' && m.attributeName) {
        attrs.add(m.attributeName)
      }
    })
    return Array.from(attrs).sort()
  }, [mappings])

  return (
    <div className="fixed inset-y-0 right-0 w-2/3 bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col border-l border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Column Mapping
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {currentFile.name} • {currentFile.rowCount} rows
          </p>
        </div>
        <button
          onClick={() => closePanel('columnMapper')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Instructions */}
      <div className="p-4 bg-cyber-50 dark:bg-cyber-900/20 border-b border-gray-200 dark:border-gray-800">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <strong>Instructions:</strong> Assign a role to each column. At least one column must be
          set as <strong>Node ID</strong>.
        </p>
      </div>

      {/* Mappings Table */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {mappings.map((mapping) => (
            <ColumnMappingRow
              key={mapping.columnName}
              mapping={mapping}
              roleOptions={ROLE_OPTIONS}
              nodeIdSelected={nodeIdSelected}
              allAttributeNames={_allAttributeNames}
              onRoleChange={handleRoleChange}
              onAttributeNameChange={handleAttributeNameChange}
              onLinkAttributeChange={handleLinkAttributeChange}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <button
            onClick={() => closePanel('columnMapper')}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleProcess}
            className="px-6 py-2 bg-cyber-600 hover:bg-cyber-700 text-white rounded-lg transition-colors font-medium flex items-center space-x-2"
          >
            <Check className="w-4 h-4" />
            <span>Process & Add to Graph</span>
          </button>
        </div>
      </div>
    </div>
  )
}

interface ColumnMappingRowProps {
  mapping: ColumnMapping
  roleOptions: { value: ColumnRole; label: string; description: string }[]
  nodeIdSelected: boolean
  allAttributeNames: string[]
  onRoleChange: (columnName: string, role: ColumnRole) => void
  onAttributeNameChange: (columnName: string, name: string) => void
  onLinkAttributeChange: (columnName: string, type: 'source' | 'target', value: string) => void
}

function ColumnMappingRow({
  mapping,
  roleOptions,
  nodeIdSelected,
  allAttributeNames: _allAttributeNames,
  onRoleChange,
  onAttributeNameChange,
  onLinkAttributeChange,
}: ColumnMappingRowProps) {
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="grid grid-cols-12 gap-4 items-start">
        {/* Column Name */}
        <div className="col-span-3">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Column
          </label>
          <div className="font-mono text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 p-2 rounded border border-gray-300 dark:border-gray-600">
            {mapping.columnName}
          </div>
        </div>

        {/* Role Selector */}
        <div className="col-span-3">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Role
          </label>
          <select
            value={mapping.role}
            onChange={(e) => onRoleChange(mapping.columnName, e.target.value as ColumnRole)}
            className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-cyber-500 focus:border-transparent"
          >
            {roleOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.value === 'node_id' && nodeIdSelected && mapping.role !== 'node_id'}
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Role-Specific Fields */}
        <div className="col-span-6">
          {(mapping.role === 'attribute' || mapping.role === 'tag') && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {mapping.role === 'attribute' ? 'Attribute Name' : 'Tag Name'}
              </label>
              <input
                type="text"
                value={mapping.attributeName || ''}
                onChange={(e) => onAttributeNameChange(mapping.columnName, e.target.value)}
                placeholder={`Enter ${mapping.role} name...`}
                className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-cyber-500 focus:border-transparent"
              />
            </div>
          )}

          {mapping.role === 'link_to_attribute' && (
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Match MY attribute
                </label>
                <input
                  type="text"
                  value={mapping.linkSourceAttr || ''}
                  onChange={(e) =>
                    onLinkAttributeChange(mapping.columnName, 'source', e.target.value)
                  }
                  placeholder="e.g., gateway"
                  className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-cyber-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  TO OTHER NODES' attribute
                </label>
                <input
                  type="text"
                  value={mapping.linkTargetAttr || ''}
                  onChange={(e) =>
                    onLinkAttributeChange(mapping.columnName, 'target', e.target.value)
                  }
                  placeholder="e.g., ip"
                  className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-cyber-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {mapping.role === 'node_id' && (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-2">
              This column will be used as the unique identifier for nodes
            </p>
          )}

          {mapping.role === 'label' && (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-2">
              This column will be displayed as the node label
            </p>
          )}

          {mapping.role === 'ignore' && (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-2">
              This column will be skipped during processing
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
