import { useCallback } from 'react'
import { useCSVStore } from '@/stores/csvStore'
import { useGraphStore } from '@/stores/graphStore'
import { useUIStore } from '@/stores/uiStore'
import { processCSVFile, mergeGraphNodes, mergeGraphEdges } from '@/lib/dataProcessor'
import { toast } from '@/components/ui/Toast'

/**
 * Hook for processing CSV files and generating graph data
 */
export function useDataProcessor() {
  const csvStore = useCSVStore()
  const { nodes, edges, setNodes, setEdges } = useGraphStore()
  const { setLoading } = useUIStore()

  const processAllFiles = useCallback(() => {
    setLoading(true, 'Processing CSV files...')

    try {
      // Get fresh files directly from store to avoid stale closure
      const files = useCSVStore.getState().files
      let allNodes = [...nodes]
      let allEdges = [...edges]

      // Process each CSV file
      const processedFiles = files.filter((f) => f.processed)

      for (const file of processedFiles) {
        try {
          const result = processCSVFile(file)

          // Merge with existing data
          allNodes = mergeGraphNodes(allNodes, result.nodes)
          allEdges = mergeGraphEdges(allEdges, result.edges)
        } catch (error) {
          console.error(`Error processing ${file.name}:`, error)
          toast.error(`Failed to process ${file.name}`)
        }
      }

      // Update stores
      setNodes(allNodes)
      setEdges(allEdges)

      const stubCount = allNodes.filter((n) => n.isStub).length
      toast.success(
        `Generated ${allNodes.length} nodes (${stubCount} stubs) and ${allEdges.length} edges`
      )
    } catch (error) {
      console.error('Error processing files:', error)
      toast.error('Failed to process files')
    } finally {
      setLoading(false)
    }
  }, [csvStore, nodes, edges, setNodes, setEdges, setLoading])

  return {
    processAllFiles,
  }
}
