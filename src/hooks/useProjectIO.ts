import { useCallback } from 'react'
import { useCSVStore } from '@/stores/csvStore'
import { useGraphStore } from '@/stores/graphStore'
import { useTemplateStore } from '@/stores/templateStore'
import { useRulesStore } from '@/stores/rulesStore'
import { useProjectStore } from '@/stores/projectStore'
import { exportProject, importProject, createProjectSnapshot } from '@/lib/projectIO'
import { toast } from '@/components/ui/Toast'
import type { ProjectState } from '@/types'

/**
 * Hook for project save/load operations
 */
export function useProjectIO() {
  const csvStore = useCSVStore()
  const graphStore = useGraphStore()
  const templateStore = useTemplateStore()
  const rulesStore = useRulesStore()
  const projectStore = useProjectStore()

  const saveProject = useCallback(() => {
    try {
      const snapshot = createProjectSnapshot({
        projectName: projectStore.projectName,
        description: projectStore.description,
        version: projectStore.version,
        createdAt: projectStore.createdAt,
        modifiedAt: projectStore.modifiedAt,
        csvFiles: csvStore.files,
        nodes: graphStore.nodes,
        edges: graphStore.edges,
        cardTemplates: templateStore.cardTemplates,
        edgeTemplates: templateStore.edgeTemplates,
        fontTemplates: templateStore.fontTemplates,
        styleRules: rulesStore.styleRules,
        layoutConfig: projectStore.layoutConfig,
      })

      exportProject(snapshot)
      toast.success('Project exported successfully')
    } catch (error) {
      console.error('Error saving project:', error)
      toast.error('Failed to save project')
    }
  }, [csvStore, graphStore, templateStore, rulesStore, projectStore])

  const loadProject = useCallback(async (file: File) => {
    try {
      const state: ProjectState = await importProject(file)

      // Restore all stores
      projectStore.setProjectName(state.name)
      projectStore.setDescription(state.description || '')

      // Clear existing data
      csvStore.clearAllFiles()
      graphStore.clearGraph()
      templateStore.clearAllTemplates()
      rulesStore.clearAllRules()

      // Restore CSV files
      state.csvFiles.forEach((csvFile) => {
        csvStore.addFile(csvFile)
      })

      // Restore graph data
      graphStore.setNodes(state.nodes)
      graphStore.setEdges(state.edges)

      // Restore templates
      state.cardTemplates.forEach((template) => {
        templateStore.addCardTemplate(template)
      })
      state.edgeTemplates.forEach((template) => {
        templateStore.addEdgeTemplate(template)
      })
      if (state.fontTemplates) {
        state.fontTemplates.forEach((template) => {
          templateStore.addFontTemplate(template)
        })
      }

      // Restore style rules
      state.styleRules.forEach((rule) => {
        rulesStore.addRule(rule)
      })

      // Restore layout config
      if (state.layoutConfig) {
        projectStore.setLayoutConfig(state.layoutConfig)
      }

      toast.success(`Project "${state.name}" loaded successfully`)
    } catch (error) {
      console.error('Error loading project:', error)
      toast.error('Failed to load project')
    }
  }, [csvStore, graphStore, templateStore, rulesStore, projectStore])

  const handleLoadFile = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.raptorjson,.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        loadProject(file)
      }
    }
    input.click()
  }, [loadProject])

  const clearProject = useCallback(() => {
    const hasData = graphStore.nodes.length > 0 || csvStore.files.length > 0

    if (hasData) {
      const confirmed = window.confirm(
        'Are you sure you want to create a new project? All unsaved changes will be lost.'
      )
      if (!confirmed) {
        return
      }
    }

    // Clear all stores
    csvStore.clearAllFiles()
    graphStore.clearGraph()
    templateStore.clearAllTemplates()
    rulesStore.clearAllRules()
    projectStore.resetProject()

    toast.success('New project created')
  }, [csvStore, graphStore, templateStore, rulesStore, projectStore])

  return {
    saveProject,
    loadProject,
    handleLoadFile,
    clearProject,
  }
}
