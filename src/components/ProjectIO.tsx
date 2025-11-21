/**
 * Project I/O Component
 * Handles saving and loading .protojson files
 */

import { Save, FolderOpen } from 'lucide-react'
import { useGraphStore } from '../stores/graphStore'
import { useCSVStore } from '../stores/csvStore'
import { useStyleStore } from '../stores/styleStore'
import { useLayoutStore } from '../stores/layoutStore'
import { useUIStore } from '../stores/uiStore'
import { exportProject, importProject, downloadFile, readFile } from '../utils/projectIO'
import type { ProjectState } from '../types'

export function ProjectIOButtons() {
  const { nodes, edges, setGraphData } = useGraphStore()
  const { csvFiles, clearAllCSVFiles } = useCSVStore()
  const { styleRules } = useStyleStore()
  const { layoutConfig, nodePositions } = useLayoutStore()
  const { setError, setSuccess, setLoading } = useUIStore()

  const handleSave = () => {
    try {
      const projectState: ProjectState = {
        version: '1.0',
        metadata: {
          name: 'Protoceratop Project',
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
        },
        csvFiles,
        nodes,
        edges,
        styleRules,
        layoutConfig,
        nodePositions,
      }

      const jsonContent = exportProject(projectState)
      const filename = `protoceratop-${Date.now()}.protojson`

      downloadFile(jsonContent, filename, 'application/json')
      setSuccess('Project saved successfully!')
    } catch (error) {
      setError(`Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleLoad = async () => {
    try {
      // Create file input
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.protojson,.json'

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return

        setLoading(true)

        try {
          const content = await readFile(file)
          const { project, error } = importProject(content)

          if (error || !project) {
            setError(error || 'Failed to load project')
            return
          }

          // Load data into stores
          clearAllCSVFiles()
          project.csvFiles?.forEach((csvFile) => {
            useCSVStore.getState().addCSVFile(csvFile)
          })

          setGraphData(project.nodes, project.edges)

          if (project.styleRules) {
            useStyleStore.getState().styleRules = project.styleRules
          }

          if (project.layoutConfig) {
            useLayoutStore.getState().setLayoutConfig(project.layoutConfig)
          }

          if (project.nodePositions) {
            useLayoutStore.getState().saveNodePositions(project.nodePositions)
          }

          setSuccess(`Project loaded: ${file.name}`)
        } catch (error) {
          setError(`Load failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
          setLoading(false)
        }
      }

      input.click()
    } catch (error) {
      setError(`Load failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={handleSave}
        disabled={nodes.length === 0}
        className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
        title="Save project as .protojson"
      >
        <Save className="w-4 h-4" />
        <span>Save Project</span>
      </button>

      <button
        onClick={handleLoad}
        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
        title="Load project from .protojson"
      >
        <FolderOpen className="w-4 h-4" />
        <span>Load Project</span>
      </button>
    </div>
  )
}
