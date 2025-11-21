/**
 * CSV Parsing Utilities
 * Handles CSV file parsing with PapaParse
 */

import Papa from 'papaparse'
import type { ParsedCSV, ValidationResult } from '../types'

/**
 * Parse a CSV file or string
 */
export function parseCSV(
  input: File | string
): Promise<{ data: ParsedCSV; error?: string }> {
  return new Promise((resolve) => {
    const config: Papa.ParseConfig<any, any> = {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false, // Keep everything as strings
      transformHeader: (header: string) => header.trim(),
      complete: (results: Papa.ParseResult<any>) => {
        if (results.errors.length > 0) {
          resolve({
            data: { headers: [], rows: [], rowCount: 0 },
            error: results.errors[0]?.message || 'Unknown parsing error',
          })
          return
        }

        const rows = results.data as Record<string, string>[]
        const headers = results.meta.fields || []

        resolve({
          data: {
            headers,
            rows,
            rowCount: rows.length,
          },
        })
      },
    }

    if (typeof input === 'string') {
      Papa.parse(input, config)
    } else {
      Papa.parse(input as any, config)
    }
  })
}

/**
 * Validate a CSV file before processing
 */
export function validateCSV(parsed: ParsedCSV): ValidationResult {
  if (parsed.headers.length === 0) {
    return { valid: false, error: 'No columns found in CSV' }
  }

  if (parsed.rowCount === 0) {
    return { valid: false, error: 'No data rows found in CSV' }
  }

  // Check for duplicate column names
  const uniqueHeaders = new Set(parsed.headers)
  if (uniqueHeaders.size !== parsed.headers.length) {
    return {
      valid: false,
      error: 'Duplicate column names found. Please ensure all columns have unique names.',
    }
  }

  return { valid: true }
}

/**
 * Export data to CSV format
 */
export function exportToCSV(
  headers: string[],
  rows: Record<string, string | string[]>[]
): string {
  // Convert multi-value arrays to JSON strings
  const cleanedRows = rows.map((row) => {
    const cleanedRow: Record<string, string> = {}
    Object.entries(row).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        cleanedRow[key] = JSON.stringify(value)
      } else {
        cleanedRow[key] = value
      }
    })
    return cleanedRow
  })

  return Papa.unparse({
    fields: headers,
    data: cleanedRows,
  })
}
