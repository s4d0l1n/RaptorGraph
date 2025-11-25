import { create } from 'zustand'
import type { CSVFile } from '@/types'

/**
 * CSV file management store
 * Handles uploaded CSV files, parsing, and column mapping
 */

interface CSVState {
  // CSV files
  files: CSVFile[]

  // Actions
  addFile: (file: CSVFile) => void
  removeFile: (fileId: string) => void
  updateFileMapping: (fileId: string, mapping: CSVFile['mapping']) => void
  markFileAsProcessed: (fileId: string) => void
  clearAllFiles: () => void
  getFileById: (fileId: string) => CSVFile | undefined
}

export const useCSVStore = create<CSVState>((set, get) => ({
  // Initial state
  files: [],

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
    set({ files: [] }),

  getFileById: (fileId) =>
    get().files.find((f) => f.id === fileId),
}))
