import { useCallback, useState } from 'react'
import { Upload, File, X, AlertCircle, Settings } from 'lucide-react'
import Papa from 'papaparse'
import { v4 as uuidv4 } from 'uuid'
import { cn } from '@/lib/utils'
import { useCSVStore } from '@/stores/csvStore'
import { useUIStore } from '@/stores/uiStore'
import { toast } from './Toast'
import type { CSVFile, ParsedCSV } from '@/types'

/**
 * Drag and drop file upload zone for CSV files
 * Supports multiple file uploads with parsing
 */
export function FileUploadZone() {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const { addFile, files } = useCSVStore()

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      setIsProcessing(true)

      try {
        const csvFiles = Array.from(fileList).filter(
          (file) => file.name.endsWith('.csv') || file.type === 'text/csv'
        )

        if (csvFiles.length === 0) {
          toast.error('Please upload CSV files only')
          setIsProcessing(false)
          return
        }

        for (const file of csvFiles) {
          try {
            const rawData = await file.text()

            // Parse CSV using PapaParse
            Papa.parse(rawData, {
              header: true,
              skipEmptyLines: true,
              complete: (results) => {
                if (results.errors.length > 0) {
                  console.error('CSV parsing errors:', results.errors)
                  toast.error(`Error parsing ${file.name}: ${results.errors[0].message}`)
                  return
                }

                const parsed: ParsedCSV = {
                  headers: results.meta.fields || [],
                  rows: results.data as Record<string, string>[],
                  rowCount: results.data.length,
                }

                // Create initial column mapping (all ignored by default)
                const mapping = parsed.headers.map((header) => ({
                  columnName: header,
                  role: 'ignore' as const,
                }))

                const csvFile: CSVFile = {
                  id: uuidv4(),
                  name: file.name,
                  size: file.size,
                  rawData,
                  parsed,
                  mapping,
                  uploadedAt: Date.now(),
                  processed: false,
                }

                addFile(csvFile)
                toast.success(`${file.name} uploaded successfully (${parsed.rowCount} rows)`)
              },
              error: (error: Error) => {
                console.error('CSV parsing error:', error)
                toast.error(`Failed to parse ${file.name}: ${error.message}`)
              },
            })
          } catch (error) {
            console.error('File reading error:', error)
            toast.error(`Failed to read ${file.name}`)
          }
        }
      } finally {
        setIsProcessing(false)
      }
    },
    [addFile]
  )

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const { files } = e.dataTransfer
      if (files && files.length > 0) {
        handleFiles(files)
      }
    },
    [handleFiles]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { files } = e.target
      if (files && files.length > 0) {
        handleFiles(files)
      }
      // Reset input value to allow uploading the same file again
      e.target.value = ''
    },
    [handleFiles]
  )

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
          isDragging
            ? 'border-cyber-500 bg-cyber-500/10'
            : 'border-slate-700 hover:border-slate-600 bg-dark-secondary'
        )}
      >
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="flex flex-col items-center gap-4">
            <div
              className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center transition-colors',
                isDragging ? 'bg-cyber-500/20' : 'bg-dark-tertiary'
              )}
            >
              {isProcessing ? (
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyber-500 border-t-transparent" />
              ) : (
                <Upload
                  className={cn('w-8 h-8', isDragging ? 'text-cyber-400' : 'text-slate-400')}
                />
              )}
            </div>

            <div>
              <p className="text-lg font-medium text-slate-200 mb-1">
                {isProcessing ? 'Processing files...' : 'Drop CSV files here'}
              </p>
              <p className="text-sm text-slate-500">or click to browse</p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <AlertCircle className="w-4 h-4" />
              <span>Supports multiple CSV files</span>
            </div>
          </div>
        </label>

        <input
          id="file-upload"
          type="file"
          accept=".csv,text/csv"
          multiple
          onChange={handleFileInput}
          className="hidden"
          disabled={isProcessing}
        />
      </div>

      {/* Uploaded Files List */}
      {files.length > 0 && <UploadedFilesList />}
    </div>
  )
}

/**
 * List of uploaded CSV files
 */
function UploadedFilesList() {
  const { files, removeFile, setFileForMapping } = useCSVStore()
  const { setActivePanel } = useUIStore()

  const handleConfigureMapping = (fileId: string) => {
    setFileForMapping(fileId)
    setActivePanel('column-mapper')
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-slate-400">Uploaded Files ({files.length})</h3>
      <div className="space-y-2">
        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between p-3 bg-dark-secondary rounded-lg border border-dark"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <File className="w-5 h-5 text-cyber-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {file.parsed.rowCount} rows • {file.parsed.headers.length} columns
                  {file.processed && ' • Mapped'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleConfigureMapping(file.id)}
                className="p-1.5 rounded hover:bg-cyber-500/20 text-slate-400 hover:text-cyber-400 transition-colors"
                title={file.processed ? 'Reconfigure mapping' : 'Configure mapping'}
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  removeFile(file.id)
                  toast.info(`${file.name} removed`)
                }}
                className="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
