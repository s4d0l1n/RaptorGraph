/**
 * File Upload Component
 * Handles CSV file uploads with drag & drop support
 */

import { useCallback, useState } from 'react'
import { Upload, FileText, X } from 'lucide-react'
import { parseCSV, validateCSV } from '../utils/csvParser'
import { useCSVStore } from '../stores/csvStore'
import { useUIStore } from '../stores/uiStore'
import type { CSVFile, ColumnMapping } from '../types'

export function FileUpload() {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  const { addCSVFile, setCurrentFile } = useCSVStore()
  const { openPanel, setError, setSuccess } = useUIStore()

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return

      setUploading(true)

      try {
        // Process all files
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          if (!file) continue

          // Check file type
          if (!file.name.endsWith('.csv')) {
            setError(`${file.name} is not a CSV file`)
            continue
          }

          // Read file content
          const content = await readFileContent(file)

          // Parse CSV
          const { data, error } = await parseCSV(content)

          if (error) {
            setError(`Error parsing ${file.name}: ${error}`)
            continue
          }

          // Validate CSV
          const validation = validateCSV(data)
          if (!validation.valid) {
            setError(`Invalid CSV ${file.name}: ${validation.error}`)
            continue
          }

          // Create initial column mappings (all set to 'ignore' initially)
          const initialMappings: ColumnMapping[] = data.headers.map(
            (header, index) => ({
              columnName: header,
              role: index === 0 ? 'node_id' : 'ignore', // First column defaults to node_id
            })
          )

          // Create CSV file object
          const csvFile: CSVFile = {
            name: file.name,
            rawData: content,
            mapping: initialMappings,
            rowCount: data.rowCount,
            uploadedAt: new Date().toISOString(),
          }

          // Add to store
          addCSVFile(csvFile)

          // Set as current file for mapping
          setCurrentFile(csvFile)

          setSuccess(`Uploaded ${file.name} (${data.rowCount} rows)`)
        }

        // Open column mapper
        openPanel('columnMapper')
      } catch (error) {
        setError(
          `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      } finally {
        setUploading(false)
      }
    },
    [addCSVFile, setCurrentFile, openPanel, setError, setSuccess]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
  }, [])

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files)
      e.target.value = '' // Reset input
    },
    [handleFiles]
  )

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
        dragging
          ? 'border-cyber-500 bg-cyber-50 dark:bg-cyber-900/20'
          : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <div className="flex flex-col items-center justify-center space-y-4">
        <div
          className={`p-4 rounded-full ${
            dragging
              ? 'bg-cyber-100 dark:bg-cyber-800'
              : 'bg-gray-100 dark:bg-gray-700'
          }`}
        >
          {uploading ? (
            <div className="animate-spin">
              <Upload className="w-12 h-12 text-cyber-600 dark:text-cyber-400" />
            </div>
          ) : (
            <FileText className="w-12 h-12 text-gray-600 dark:text-gray-400" />
          )}
        </div>

        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {uploading ? 'Uploading...' : 'Upload CSV Files'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Drag & drop CSV files here, or click to browse
          </p>
        </div>

        <label className="cursor-pointer">
          <input
            type="file"
            multiple
            accept=".csv"
            onChange={onFileInputChange}
            className="hidden"
            disabled={uploading}
          />
          <div className="px-4 py-2 bg-cyber-600 hover:bg-cyber-700 text-white rounded-lg transition-colors font-medium">
            Browse Files
          </div>
        </label>

        <p className="text-xs text-gray-400 dark:text-gray-500">
          Supports multiple CSV files • 100% client-side processing
        </p>
      </div>
    </div>
  )
}

function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string)
      } else {
        reject(new Error('Failed to read file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

/**
 * CSV Files List Component
 * Shows uploaded files with options to view/delete
 */
export function CSVFilesList() {
  const { csvFiles, removeCSVFile, setCurrentFile } = useCSVStore()
  const { openPanel } = useUIStore()

  if (csvFiles.length === 0) {
    return null
  }

  return (
    <div className="mt-4 space-y-2">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        Uploaded Files ({csvFiles.length})
      </h3>
      {csvFiles.map((file) => (
        <div
          key={file.name}
          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center space-x-3">
            <FileText className="w-5 h-5 text-cyber-600 dark:text-cyber-400" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {file.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {file.rowCount} rows • {file.mapping.filter((m) => m.role !== 'ignore').length}{' '}
                mapped columns
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setCurrentFile(file)
                openPanel('columnMapper')
              }}
              className="px-3 py-1 text-xs font-medium text-cyber-600 dark:text-cyber-400 hover:bg-cyber-50 dark:hover:bg-cyber-900/20 rounded transition-colors"
            >
              Edit Mapping
            </button>
            <button
              onClick={() => removeCSVFile(file.name)}
              className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              title="Remove file"
            >
              <X className="w-4 h-4 text-red-600 dark:text-red-400" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
