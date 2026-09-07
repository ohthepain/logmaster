import { useState } from 'react'
import { toast } from 'sonner'
import type { BoatDocumentCategory } from '../domain/boat'
import { createBoatDocumentCategory } from '../lib/boat-documents-api'

const ADD_CATEGORY_VALUE = '__add_category__'

type BoatDocumentCategoryFieldProps = {
  categories: Array<{ id: string; name: string }>
  value: string
  onChange: (categoryId: string) => void
  onCategoryCreated: (category: BoatDocumentCategory) => void
  boatId: string
  busy: boolean
  setBusy: (busy: boolean) => void
}

export function BoatDocumentCategoryField({
  categories,
  value,
  onChange,
  onCategoryCreated,
  boatId,
  busy,
  setBusy,
}: BoatDocumentCategoryFieldProps) {
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim()
    if (!name) return
    setBusy(true)
    try {
      const category = await createBoatDocumentCategory(boatId, name)
      onCategoryCreated(category)
      onChange(category.id)
      setNewCategoryName('')
      setAddingCategory(false)
      toast.success('Category added')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add category')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
          Category
        </span>
        <select
          value={addingCategory ? ADD_CATEGORY_VALUE : value}
          disabled={busy}
          onChange={(e) => {
            if (e.target.value === ADD_CATEGORY_VALUE) {
              setAddingCategory(true)
              return
            }
            setAddingCategory(false)
            onChange(e.target.value)
          }}
          className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20 disabled:opacity-60"
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
          <option value={ADD_CATEGORY_VALUE}>Add category…</option>
        </select>
      </label>

      {addingCategory ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[12rem] flex-1">
            <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
              New category
            </span>
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Registration"
              autoFocus
              className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
            />
          </label>
          <button
            type="button"
            disabled={busy || !newCategoryName.trim()}
            onClick={() => void handleCreateCategory()}
            className="rounded-full bg-[var(--btn-bg)] px-4 py-3 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
          >
            Add
          </button>
        </div>
      ) : null}
    </div>
  )
}
