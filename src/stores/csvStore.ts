/**
 * CSV Store - Manages uploaded CSV files and their mappings
 */

import { create } from 'zustand'
import type { CSVFile, ColumnMapping } from '../types'

interface CSVStore {
  // State
  csvFiles: CSVFile[]
  currentFile: CSVFile | null

  // Operations
  addCSVFile: (file: CSVFile) => void
  removeCSVFile: (filename: string) => void
  updateMapping: (filename: string, mapping: ColumnMapping[]) => void
  setCurrentFile: (file: CSVFile | null) => void
  clearAllCSVFiles: () => void
  getCSVFile: (filename: string) => CSVFile | undefined
}

export const useCSVStore = create<CSVStore>((set, get) => ({
  // Initial state
  csvFiles: [],
  currentFile: null,

  // Operations
  addCSVFile: (file) => {
    set((state) => {
      // Check if file with same name already exists
      const exists = state.csvFiles.some((f) => f.name === file.name)
      if (exists) {
        // Replace existing file
        return {
          csvFiles: state.csvFiles.map((f) =>
            f.name === file.name ? file : f
          ),
        }
      }
      return { csvFiles: [...state.csvFiles, file] }
    })
  },

  removeCSVFile: (filename) => {
    set((state) => ({
      csvFiles: state.csvFiles.filter((f) => f.name !== filename),
      currentFile:
        state.currentFile?.name === filename ? null : state.currentFile,
    }))
  },

  updateMapping: (filename, mapping) => {
    set((state) => ({
      csvFiles: state.csvFiles.map((f) =>
        f.name === filename ? { ...f, mapping } : f
      ),
    }))
  },

  setCurrentFile: (file) => {
    set({ currentFile: file })
  },

  clearAllCSVFiles: () => {
    set({ csvFiles: [], currentFile: null })
  },

  getCSVFile: (filename) => {
    return get().csvFiles.find((f) => f.name === filename)
  },
}))
