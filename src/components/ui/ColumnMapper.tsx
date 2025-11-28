import { useState, useEffect } from 'react'
import { X, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/uiStore'
import { useCSVStore } from '@/stores/csvStore'
import { useDataProcessor } from '@/hooks/useDataProcessor'
import { toast } from './Toast'
import type { ColumnMapping, ColumnRole } from '@/types'

/**
 * Column mapping wizard for configuring CSV import
 */
export function ColumnMapper() {
  const { activePanel, setActivePanel } = useUIStore()
  const { files, currentMappingFileId, updateFileMapping, markFileAsProcessed, clearCurrentMappingFile } = useCSVStore()
  const { processAllFiles } = useDataProcessor()

  // Get current file being mapped (either explicitly selected or first unprocessed)
  const currentFile = currentMappingFileId
    ? files.find((f) => f.id === currentMappingFileId)
    : files.find((f) => !f.processed)

  const [mappings, setMappings] = useState<ColumnMapping[]>([])

  useEffect(() => {
    if (currentFile) {
      // If file already has mapping, use it; otherwise initialize with auto-detection
      if (currentFile.mapping && currentFile.mapping.length > 0) {
        setMappings(currentFile.mapping)
      } else {
        // Initialize mappings with auto-detection
        const initialMappings = currentFile.parsed.headers.map((header) => {
          const lowerHeader = header.toLowerCase()

          // Auto-detect node_id columns
          if (
            lowerHeader === 'id' ||
            lowerHeader === 'node_id' ||
            lowerHeader === 'nodeid' ||
            lowerHeader === 'name' ||
            lowerHeader === 'hostname' ||
            lowerHeader === 'fqdn'
          ) {
            return {
              columnName: header,
              role: 'node_id' as ColumnRole,
            }
          }

          // Auto-detect timestamp columns
          if (
            lowerHeader.includes('time') ||
            lowerHeader.includes('date') ||
            lowerHeader === 'timestamp' ||
            lowerHeader === 'created' ||
            lowerHeader === 'modified'
          ) {
            return {
              columnName: header,
              role: 'timestamp' as ColumnRole,
              attributeName: header,
            }
          }

          // Default to attribute
          return {
            columnName: header,
            role: 'attribute' as ColumnRole,
            attributeName: header,
          }
        })

        setMappings(initialMappings)
      }
    }
  }, [currentFile])

  if (activePanel !== 'column-mapper' || !currentFile) return null

  const handleRoleChange = (columnName: string, role: ColumnRole) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.columnName === columnName
          ? {
              columnName,
              role,
              attributeName: role === 'attribute' ? columnName : undefined,
              linkTargetAttribute: undefined,
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

  const handleLinkTargetChange = (columnName: string, target: string) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.columnName === columnName ? { ...m, linkTargetAttribute: target } : m
      )
    )
  }

  const handleConfirm = () => {
    // Validate: must have at least one node_id
    const hasNodeId = mappings.some((m) => m.role === 'node_id')
    if (!hasNodeId) {
      toast.error('At least one column must be mapped as Node ID')
      return
    }

    // Validate: link_to mappings must have target
    const invalidLinks = mappings.filter(
      (m) => m.role === 'link_to' && !m.linkTargetAttribute
    )
    if (invalidLinks.length > 0) {
      toast.error('Link mappings must specify a target attribute')
      return
    }

    // Save mapping and mark as processed
    updateFileMapping(currentFile.id, mappings)
    markFileAsProcessed(currentFile.id)

    toast.success(`Mapping configured for ${currentFile.name}`)

    // Clear current mapping file
    clearCurrentMappingFile()

    // Close the mapper
    setActivePanel(null)

    // Process all files after a short delay to ensure state updates
    setTimeout(() => {
      processAllFiles()
    }, 100)
  }

  const previewRows = currentFile.parsed.rows.slice(0, 10)
  const nodeIdCount = mappings.filter((m) => m.role === 'node_id').length
  const attributeCount = mappings.filter((m) => m.role === 'attribute').length
  const linkCount = mappings.filter((m) => m.role === 'link_to').length

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-secondary border border-dark rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Column Mapping Wizard</h2>
            <p className="text-sm text-slate-400 mt-1">{currentFile.name}</p>
          </div>
          <button
            onClick={() => setActivePanel(null)}
            className="p-2 rounded-lg hover:bg-dark-tertiary text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Bar */}
        <div className="px-6 py-3 bg-dark/50 border-b border-dark flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyber-500" />
            <span className="text-slate-400">Node ID:</span>
            <span className="text-slate-200 font-medium">{nodeIdCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-slate-400">Attributes:</span>
            <span className="text-slate-200 font-medium">{attributeCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-slate-400">Links:</span>
            <span className="text-slate-200 font-medium">{linkCount}</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-dark-secondary z-10">
                <tr className="border-b border-dark">
                  <th className="text-left p-3 text-sm font-medium text-slate-400">Column</th>
                  <th className="text-left p-3 text-sm font-medium text-slate-400">Role</th>
                  <th className="text-left p-3 text-sm font-medium text-slate-400">Configuration</th>
                  <th className="text-left p-3 text-sm font-medium text-slate-400">Preview</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping) => (
                  <ColumnMappingRow
                    key={mapping.columnName}
                    mapping={mapping}
                    previewValues={previewRows.map((row) => row[mapping.columnName] || '')}
                    allColumns={mappings.map((m) => m.columnName)}
                    onRoleChange={handleRoleChange}
                    onAttributeNameChange={handleAttributeNameChange}
                    onLinkTargetChange={handleLinkTargetChange}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Validation Messages */}
          <div className="mt-6 space-y-2">
            {nodeIdCount === 0 && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>At least one column must be mapped as Node ID</span>
              </div>
            )}
            {nodeIdCount > 0 && (
              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-400">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>Configuration is valid</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-dark flex justify-between items-center">
          <p className="text-sm text-slate-400">
            Showing {previewRows.length} of {currentFile.parsed.rowCount} rows
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setActivePanel(null)}
              className="px-4 py-2 rounded-lg bg-dark-tertiary hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={nodeIdCount === 0}
              className={cn(
                'px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2',
                nodeIdCount > 0
                  ? 'bg-cyber-500 hover:bg-cyber-600 text-white'
                  : 'bg-dark-tertiary text-slate-600 cursor-not-allowed'
              )}
            >
              <span>Confirm Mapping</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ColumnMappingRowProps {
  mapping: ColumnMapping
  previewValues: string[]
  allColumns: string[]
  onRoleChange: (columnName: string, role: ColumnRole) => void
  onAttributeNameChange: (columnName: string, attributeName: string) => void
  onLinkTargetChange: (columnName: string, target: string) => void
}

function ColumnMappingRow({
  mapping,
  previewValues,
  allColumns,
  onRoleChange,
  onAttributeNameChange,
  onLinkTargetChange,
}: ColumnMappingRowProps) {
  const roles: { value: ColumnRole; label: string }[] = [
    { value: 'node_id', label: 'Node ID' },
    { value: 'attribute', label: 'Attribute' },
    { value: 'link_to', label: 'Link → Attribute' },
    { value: 'timestamp', label: 'Timestamp' },
    { value: 'ignore', label: 'Ignore' },
  ]

  return (
    <tr className="border-b border-dark/50 hover:bg-dark/30">
      <td className="p-3">
        <span className="text-sm font-medium text-slate-200">{mapping.columnName}</span>
      </td>
      <td className="p-3">
        <select
          value={mapping.role}
          onChange={(e) => onRoleChange(mapping.columnName, e.target.value as ColumnRole)}
          className="w-full px-3 py-2 bg-dark-tertiary border border-dark rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyber-500"
        >
          {roles.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
      </td>
      <td className="p-3">
        {mapping.role === 'attribute' && (
          <input
            type="text"
            value={mapping.attributeName || ''}
            onChange={(e) => onAttributeNameChange(mapping.columnName, e.target.value)}
            placeholder="Attribute name"
            className="w-full px-3 py-2 bg-dark-tertiary border border-dark rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyber-500"
          />
        )}
        {mapping.role === 'link_to' && (
          <select
            value={mapping.linkTargetAttribute || ''}
            onChange={(e) => onLinkTargetChange(mapping.columnName, e.target.value)}
            className="w-full px-3 py-2 bg-dark-tertiary border border-dark rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyber-500"
          >
            <option value="">Select target attribute...</option>
            {allColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        )}
        {mapping.role === 'timestamp' && (
          <input
            type="text"
            value={mapping.attributeName || ''}
            onChange={(e) => onAttributeNameChange(mapping.columnName, e.target.value)}
            placeholder="Attribute name"
            className="w-full px-3 py-2 bg-dark-tertiary border border-dark rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyber-500"
          />
        )}
      </td>
      <td className="p-3">
        <div className="text-xs text-slate-400 truncate max-w-xs">
          {previewValues.slice(0, 3).join(', ')}
        </div>
      </td>
    </tr>
  )
}
