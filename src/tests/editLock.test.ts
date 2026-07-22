// src/tests/editLock.test.ts
// ─────────────────────────────────────────────────────────────
// Tests for the Edit Lock ("child lock") store slice:
//   - default state, toggle action
//   - initialOverrides seeding (what GridStoreProvider's initialState prop relies on)
//   - persistence round-trip (loadPersistedState / write shape)
// ─────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest'
import { createGridStore } from '../store/gridStore'
import type { GridStoreInstance } from '../store/gridStore'
import { loadPersistedState } from '../hooks/useGridPersistence'

const STORAGE_KEY = 'rf-edit-lock-test'

beforeEach(() => {
  localStorage.clear()
})

describe('editLocked store slice', () => {
  it('defaults to unlocked', () => {
    const store = createGridStore()
    expect(store.getState().editLocked).toBe(false)
  })

  it('setEditLocked toggles the flag', () => {
    const store = createGridStore()
    store.getState().setEditLocked(true)
    expect(store.getState().editLocked).toBe(true)
    store.getState().setEditLocked(false)
    expect(store.getState().editLocked).toBe(false)
  })

  it('can be seeded locked via initialOverrides (what GridStoreProvider uses)', () => {
    const store = createGridStore({ editLocked: true })
    expect(store.getState().editLocked).toBe(true)
  })

  it('never widens — locking never touches unrelated store state', () => {
    const store: GridStoreInstance = createGridStore()
    store.getState().setRows([{ id: '1', _id: '_1', _draft: null }])
    store.getState().setEditLocked(true)
    expect(store.getState().rows).toHaveLength(1)
    expect(store.getState().selectedIds.size).toBe(0)
  })
})

describe('editLocked persistence round-trip', () => {
  it('loadPersistedState restores a saved locked value', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 3,
        columnWidths: {},
        hiddenColumns: [],
        pinnedColumns: [],
        columnOrder: [],
        activeFilters: {},
        aggregations: {},
        cfRules: [],
        editLocked: true,
      }),
    )
    const store = createGridStore()
    loadPersistedState(STORAGE_KEY, store)
    expect(store.getState().editLocked).toBe(true)
  })

  it('leaves the default (unlocked) when nothing is persisted yet', () => {
    const store = createGridStore()
    loadPersistedState(STORAGE_KEY, store)
    expect(store.getState().editLocked).toBe(false)
  })

  it('discards a stale-version payload instead of applying it', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 2, editLocked: true }),
    )
    const store = createGridStore()
    loadPersistedState(STORAGE_KEY, store)
    // version mismatch → treated as absent → default stands
    expect(store.getState().editLocked).toBe(false)
  })
})
