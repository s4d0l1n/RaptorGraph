/**
 * Project I/O
 * Handles saving and loading .protojson project files
 */

import type { ProjectState } from '../types'

const PROJECT_VERSION = '1.0'

/**
 * Export project state to .protojson format
 */
export function exportProject(state: ProjectState): string {
  const projectData: ProjectState = {
    ...state,
    version: PROJECT_VERSION,
    metadata: {
      ...state.metadata,
      modifiedAt: new Date().toISOString(),
    },
  }

  return JSON.stringify(projectData, null, 2)
}

/**
 * Import project state from .protojson format
 */
export function importProject(jsonString: string): {
  project: ProjectState | null
  error?: string
} {
  try {
    const parsed = JSON.parse(jsonString) as ProjectState

    // Validate version
    if (!parsed.version) {
      return {
        project: null,
        error: 'Invalid project file: missing version',
      }
    }

    // Basic structure validation
    if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
      return {
        project: null,
        error: 'Invalid project file: missing or invalid nodes',
      }
    }

    if (!parsed.edges || !Array.isArray(parsed.edges)) {
      return {
        project: null,
        error: 'Invalid project file: missing or invalid edges',
      }
    }

    return { project: parsed }
  } catch (error) {
    return {
      project: null,
      error: error instanceof Error ? error.message : 'Failed to parse project file',
    }
  }
}

/**
 * Download a file to the user's computer
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'application/json') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Read a file from user's computer
 */
export function readFile(file: File): Promise<string> {
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
