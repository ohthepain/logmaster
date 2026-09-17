import { useEffect, useId, useState } from 'react'
import { Pencil } from 'lucide-react'
import { findAssetBrand } from '../domain/asset-brands'
import {
  findCatalogBrands,
  findCatalogModels,
} from '../lib/product-catalog-api'
import { AssetBrandLogo } from './AssetBrandLogo'
import { useTranslation } from '../lib/i18n'

function IdentityField({
  label,
  value,
  onChange,
  options,
  committed,
  onEditStart,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  committed?: React.ReactNode
  onEditStart?: () => void
}) {
  const id = useId()
  const [editing, setEditing] = useState(false)
  const [active, setActive] = useState(-1)
  const expanded = editing && options.length > 0
  return (
    <div className="relative min-w-0">
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-[var(--sea-ink-soft)]"
      >
        {label}
      </label>
      {value && !editing ? (
        <button
          id={id}
          type="button"
          aria-label={`Edit ${label}`}
          onClick={() => {
            onEditStart?.()
            setEditing(true)
          }}
          className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left text-2xl font-bold"
        >
          <span className="min-w-0 break-words">{committed ?? value}</span>
          <Pencil className="size-4 shrink-0 text-[var(--sea-ink-soft)]" />
        </button>
      ) : (
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? `${id}-options` : undefined}
          aria-activedescendant={
            expanded && active >= 0 ? `${id}-${active}` : undefined
          }
          autoFocus={editing}
          autoComplete="off"
          value={value}
          maxLength={label === 'Brand' ? 100 : 200}
          onFocus={() => {
            onEditStart?.()
            setEditing(true)
          }}
          onBlur={() => {
            setEditing(false)
            setActive(-1)
            onChange(value.trim())
          }}
          onChange={(event) => {
            setActive(-1)
            onChange(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              setActive((current) =>
                options.length
                  ? (current +
                      (event.key === 'ArrowDown' ? 1 : -1) +
                      options.length) %
                    options.length
                  : -1,
              )
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              onChange(
                active >= 0 && options[active] ? options[active] : value.trim(),
              )
              setEditing(false)
            }
            if (event.key === 'Escape') {
              event.stopPropagation()
              setEditing(false)
              event.currentTarget.blur()
            }
          }}
          className="min-h-14 w-full rounded-2xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 text-base outline-none focus:border-[var(--sea-ink)] focus:ring-2 focus:ring-[var(--line)]"
        />
      )}
      {expanded && (
        <ul
          id={`${id}-options`}
          role="listbox"
          aria-label={label}
          className="absolute inset-x-0 top-full z-10 m-0 mt-2 max-h-48 list-none overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-1 shadow-xl"
        >
          {options.map((option, index) => (
            <li
              key={option}
              id={`${id}-${index}`}
              role="option"
              aria-selected={index === active}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option)
                setEditing(false)
                setActive(-1)
              }}
              className={`cursor-pointer rounded-xl px-4 py-3 text-base hover:bg-[var(--chip-bg)] ${index === active ? 'bg-[var(--chip-bg)]' : ''}`}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function EquipmentIdentityFields({
  brand,
  model,
  onBrand,
  onModel,
  noModel,
}: {
  brand: string
  model: string
  onBrand: (value: string) => void
  onModel: (value: string) => void
  noModel: boolean
}) {
  const { t } = useTranslation()
  const [brands, setBrands] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([])
  const [modelQuery, setModelQuery] = useState(model)
  const catalogBrand = findAssetBrand(brand)?.name ?? brand.trim()
  useEffect(() => {
    setModelQuery(model)
  }, [model])
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void findCatalogBrands(brand, controller.signal)
        .then((items) => {
          if (!controller.signal.aborted)
            setBrands(items.map((item) => item.name))
        })
        .catch(() => {})
    }, 180)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [brand])
  useEffect(() => {
    setModels([])
    if (!catalogBrand || noModel) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void findCatalogModels(catalogBrand, modelQuery, controller.signal)
        .then((items) => {
          if (!controller.signal.aborted) setModels(items)
        })
        .catch(() => {})
    }, 180)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [catalogBrand, modelQuery, noModel])
  return (
    <div className="space-y-5">
      <IdentityField
        label={t('equipmentBrand')}
        value={brand}
        onChange={onBrand}
        options={brands}
        committed={<AssetBrandLogo brand={brand} prominent />}
      />
      {!noModel && (
        <IdentityField
          label={t('equipmentModel')}
          value={model}
          onEditStart={() => setModelQuery('')}
          onChange={(value) => {
            setModelQuery(value)
            onModel(value)
          }}
          options={models}
        />
      )}
    </div>
  )
}
