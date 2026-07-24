import { useEffect, useCallback, useRef } from 'react'
import type { Virtualizer } from '@tanstack/react-virtual'
import { useGridStore, useGridActions } from '../store'
import { getNearestScrollLeft } from '../utils'
import type { ColumnDef, Row } from '../types'

type UseKeyboardNavOptions<TData> = {
  visCols: ColumnDef<TData>[]
  visibleRows: Row<TData>[]
  enabled?: boolean
  onActivateCell: (rowId: string, colKey: string) => void
  onOpenPanel: (rowId: string) => void

  // ── Auto-scroll inputs ──────────────────────────────────────
  scrollRef: React.RefObject<HTMLDivElement>
  virtualizer: Virtualizer<HTMLDivElement, Element>
  getRowIndex: (rowId: string) => number
  colLeftOffsets: number[]
  columnWidths: Record<string, number>
  pinOffsets: Record<string, number>
  totalPinnedWidth: number
}

export function useKeyboardNav<TData = Record<string, unknown>>({
  visCols,
  visibleRows,
  enabled = true,
  onActivateCell,
  onOpenPanel,
  scrollRef,
  virtualizer,
  getRowIndex,
  colLeftOffsets,
  columnWidths,
  pinOffsets,
  totalPinnedWidth,
}: UseKeyboardNavOptions<TData>) {
  const kbFocusRowId  = useGridStore((s) => s.kbFocusRowId)
  const kbFocusColIdx = useGridStore((s) => s.kbFocusColIdx)
  const actions       = useGridActions()

  // Ref-mirrors so setFocus stays referentially stable across
  // resize/pin/reorder churn — it's passed straight through as a prop into
  // React.memo(GridRow), and an unstable identity would defeat that memo
  // for every row on every keystroke.
  const visColsRef = useRef(visCols)
  visColsRef.current = visCols
  const colLeftOffsetsRef = useRef(colLeftOffsets)
  colLeftOffsetsRef.current = colLeftOffsets
  const columnWidthsRef = useRef(columnWidths)
  columnWidthsRef.current = columnWidths
  const pinOffsetsRef = useRef(pinOffsets)
  pinOffsetsRef.current = pinOffsets
  const totalPinnedWidthRef = useRef(totalPinnedWidth)
  totalPinnedWidthRef.current = totalPinnedWidth
  const virtualizerRef = useRef(virtualizer)
  virtualizerRef.current = virtualizer
  const getRowIndexRef = useRef(getRowIndex)
  getRowIndexRef.current = getRowIndex

  const setFocus = useCallback(
    (rowId: string | null, colIdx: number | null) => {
      actions.setKbFocus(rowId, colIdx)
      if (rowId === null) return

      // ── Horizontal — pure arithmetic, no DOM reads/writes on a no-op.
      const scrollEl = scrollRef.current
      if (scrollEl && colIdx !== null) {
        const col = visColsRef.current[colIdx]
        const colKey = col?.key as string | undefined
        if (col && colKey) {
          const nextScrollLeft = getNearestScrollLeft({
            scrollLeft: scrollEl.scrollLeft,
            clientWidth: scrollEl.clientWidth,
            colLeft: colLeftOffsetsRef.current[colIdx] ?? 0,
            colWidth: columnWidthsRef.current[colKey] ?? col.width ?? 150,
            totalPinnedWidth: totalPinnedWidthRef.current,
            isPinned: pinOffsetsRef.current[colKey] !== undefined,
          })
          if (nextScrollLeft !== null) {
            scrollEl.scrollTo({ left: nextScrollLeft, behavior: 'auto' })
          }
        }
      }

      // ── Vertical — delegate to the row virtualizer's own "nearest" API.
      // scrollPaddingStart/End (thead/tfoot heights) are already baked
      // into its options, so this accounts for the sticky header/footer
      // safe zones and no-ops when already fully visible.
      const rowIndex = getRowIndexRef.current(rowId)
      if (rowIndex !== -1) {
        virtualizerRef.current.scrollToIndex(rowIndex, { align: 'auto', behavior: 'auto' })
      }
    },
    [actions, scrollRef]
  )

  const clearFocus = useCallback(() => {
    actions.setKbFocus(null, null)
  }, [actions])

  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      // Skip when typing in inputs — includes contentEditable surfaces
      // (e.g. the richtext popover's Tiptap/ProseMirror editor), which
      // never match a plain tagName check since they're a <div>.
      const target = e.target as HTMLElement
      const tag = target?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || target?.isContentEditable) return

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
