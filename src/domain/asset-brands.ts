import { ASSET_BRAND_CATALOG } from './asset-brand-catalog'

export type AssetBrand = {
  id: string
  name: string
  aliases: string[]
  logo: string | null
  // White artwork is rendered dark on light surfaces.
  whiteLogo?: boolean
  // Common words require an explicit brand instead of guessing from a name.
  inferFromName?: boolean
}

export const ASSET_BRANDS: AssetBrand[] = ASSET_BRAND_CATALOG

const brandKey = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

const brandsByAlias = new Map(
  ASSET_BRANDS.flatMap((brand) =>
    [brand.id, brand.name, ...brand.aliases].map(
      (alias) => [brandKey(alias), brand] as const,
    ),
  ),
)

export function findAssetBrand(value: string | null | undefined) {
  return value?.trim() ? brandsByAlias.get(brandKey(value)) : undefined
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Match only a complete leading name, never a substring such as Garminish.
function prefixPattern(value: string) {
  return new RegExp(
    `^${escapeRegex(value).replace(/[\s-]+/g, '[\\s-]*')}(?=$|[\\s:–—-])(?:[\\s:–—-]+)?`,
    'i',
  )
}

// Prefer the most specific alias (e.g. Mercury MerCruiser before Mercury).
// Compile once; asset lists can resolve hundreds of rows without rebuilding regexes.
const brandPrefixes = ASSET_BRANDS.flatMap((brand) =>
  [brand.name, ...brand.aliases].map((alias) => ({
    brand,
    alias,
    pattern: prefixPattern(alias),
  })),
).sort((a, b) => b.alias.length - a.alias.length)

function stripBrand(value: string, brand: string | null) {
  const text = value.trim()
  if (!brand) return text
  const known = findAssetBrand(brand)
  const match =
    known &&
    brandPrefixes.find(
      (entry) => entry.brand.id === known.id && entry.pattern.test(text),
    )
  return match
    ? text.replace(match.pattern, '').trim()
    : known
      ? text
      : text.replace(prefixPattern(brand), '').trim()
}

export type AssetIdentityInput = {
  name: string
  brand?: string | null
  modelNumber?: string | null
  description?: string | null
}

export function getAssetIdentity(asset: AssetIdentityInput) {
  const inferred =
    asset.brand?.trim() || asset.brand === ''
      ? undefined
      : brandPrefixes.find(
          ({ brand, pattern }) =>
            brand.inferFromName !== false &&
            [asset.name, asset.modelNumber ?? ''].some((text) =>
              pattern.test(text.trim()),
            ),
        )?.brand
  // An explicit empty string lets a user clear an inferred brand in the editor.
  const supplied =
    asset.brand === '' ? '' : asset.brand?.trim() || inferred?.name || ''
  const brand = findAssetBrand(supplied)?.name ?? (supplied || null)
  const modelNumber = stripBrand(asset.modelNumber ?? '', brand) || null
  const name = stripBrand(asset.name, brand)
  const productName = modelNumber
    ? name
        .replace(
          new RegExp(
            `^${escapeRegex(modelNumber)}(?=$|[\\s:–—])(?:[\\s:–—]+)?`,
            'i',
          ),
          '',
        )
        .trim()
    : name
  return {
    brand,
    modelNumber,
    productName,
    title: modelNumber || productName || brand || asset.name,
    subtitle: modelNumber ? productName : '',
  }
}
