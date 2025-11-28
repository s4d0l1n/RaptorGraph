import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CSVFile } from '@/types'

/**
 * CSV file management store
 * Handles uploaded CSV files, parsing, and column mapping
 * Persists to localStorage to survive page refreshes
 */

interface CSVState {
  // CSV files
  files: CSVFile[]

  // Currently mapping file ID
  currentMappingFileId: string | null

  // Actions
  addFile: (file: CSVFile) => void
  removeFile: (fileId: string) => void
  updateFileMapping: (fileId: string, mapping: CSVFile['mapping']) => void
  markFileAsProcessed: (fileId: string) => void
  clearAllFiles: () => void
  getFileById: (fileId: string) => CSVFile | undefined
  setFileForMapping: (fileId: string) => void
  clearCurrentMappingFile: () => void
}

export const useCSVStore = create<CSVState>()(
  persist(
    (set, get) => ({
  // Initial state
  files: [],
  currentMappingFileId: null,

  // Actions
  addFile: (file) =>
    set((state) => ({
      files: [...state.files, file],
    })),

  removeFile: (fileId) =>
    set((state) => ({
      files: state.files.filter((f) => f.id !== fileId),
    })),

  updateFileMapping: (fileId, mapping) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === fileId ? { ...f, mapping } : f
      ),
    })),

  markFileAsProcessed: (fileId) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === fileId ? { ...f, processed: true } : f
      ),
    })),

  clearAllFiles: () =>
    set({ files: [], currentMappingFileId: null }),

  getFileById: (fileId) =>
    get().files.find((f) => f.id === fileId),

  setFileForMapping: (fileId) =>
    set({ currentMappingFileId: fileId }),

  clearCurrentMappingFile: () =>
    set({ currentMappingFileId: null }),
    }),
    {
      name: 'raptorgraph-csv-storage',
      version: 1,
    }
  )
)
