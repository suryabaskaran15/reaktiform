import { useEffect, useCallback } from 'react'
import { useGridStore, useGridActions } from '../store'
import type { ColumnDef, Row } from '../types'

type UseKeyboardNavOptions<TData> = {
  columns: ColumnDef<TData>[]
  visibleRows: Row<TData>[]
  hiddenColumns: Set<string>
  enabled?: boolean
  onActivateCell: (rowId: string, colKey: string) => void
  onOpenPanel: (rowId: string) => void
}

export function useKeyboardNav<TData = Record<string, unknown>>({
  columns,
  visibleRows,
  hiddenColumns,
  enabled = true,
  onActivateCell,
  onOpenPanel,
}: UseKeyboardNavOptions<TData>) {
  const kbFocusRowId  = useGridStore((s) => s.kbFocusRowId)
  const kbFocusColIdx = useGridStore((s) => s.kbFocusColIdx)
  const actions       = useGridActions()

  // Visible columns only
  const visCols = columns.filter((c) => !hiddenColumns.has(c.key as string))

  const setFocus = useCallback(
    (rowId: string | null, colIdx: number | null) => {
      actions.setKbFocus(rowId, colIdx)
      if (rowId !== null) {
        // Scroll focused row into view
        requestAnimationFrame(() => {
          const tr = document.querySelector(`tr[data-row-id="${rowId}"]`)
          tr?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        })
      }
    },
    [actions]
  )

  const clearFocus = useCallback(() => {
    actions.setKbFocus(null, null)
  }, [actions])

  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      // Skip when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return

      // Skip when no focus — initialise on first arrow press
      if (!kbFocusRowId && !['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return

      if (!visibleRows.length) return

      const rowIdx = kbFocusRowId
        ? visibleRows.findIndex((r) => r._id === kbFocusRowId)
        : -1
      const colIdx = kbFocusColIdx ?? 0

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          const nextRow = visibleRows[Math.min(rowIdx + 1, visibleRows.length - 1)]
          if (nextRow) setFocus(nextRow._id, colIdx)
          else if (rowIdx === -1 && visibleRows[0]) setFocus(visibleRows[0]._id, 0)
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          const prevRow = visibleRows[Math.max(rowIdx - 1, 0)]
          if (prevRow) setFocus(prevRow._id, colIdx)
          break
        }
        case 'ArrowRight': {
          e.preventDefault()
          setFocus(kbFocusRowId, Math.min(colIdx + 1, visCols.length - 1))
          break
        }
        case 'ArrowLeft': {
          e.preventDefault()
          setFocus(kbFocusRowId, Math.max(colIdx - 1, 0))
          break
        }
        case 'Enter': {
          e.preventDefault()
          if (!kbFocusRowId) break
          const col = visCols[colIdx]
          if (col && !col.computed) onActivateCell(kbFocusRowId, col.key as string)
          break
        }
        case 'Tab': {
          e.preventDefault()
          if (!kbFocusRowId) break
          const dir = e.shiftKey ? -1 : 1
          const nextColIdx = colIdx + dir
          if (nextColIdx < 0 && rowIdx > 0) {
            // Wrap to end of previous row
            const prevRow = visibleRows[rowIdx - 1]
            if (prevRow) setFocus(prevRow._id, visCols.length - 1)
          } else if (nextColIdx >= visCols.length && rowIdx < visibleRows.length - 1) {
            // Wrap to start of next row
            const nextRow = visibleRows[rowIdx + 1]
            if (nextRow) setFocus(nextRow._id, 0)
          } else {
            setFocus(kbFocusRowId, Math.max(0, Math.min(nextColIdx, visCols.length - 1)))
          }
          break
        }
        case ' ': {
          e.preventDefault()
          if (kbFocusRowId) onOpenPanel(kbFocusRowId)
          break
        }
        case 'Escape': {
          clearFocus()
          break
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    enabled,
    kbFocusRowId,
    kbFocusColIdx,
    visibleRows,
    visCols,
    setFocus,
    clearFocus,
    onActivateCell,
    onOpenPanel,
  ])

  return {
    kbFocusRowId,
    kbFocusColIdx,
    setFocus,
    clearFocus,
    visCols,
  }
}
