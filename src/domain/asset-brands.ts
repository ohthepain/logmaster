export type AssetBrand = {
  id: string
  name: string
  aliases: string[]
  logo: string
}

// Keep logos in public/brands and record their official sources in its README.
// Aliases also recognize older assets whose names include the manufacturer.
export const ASSET_BRANDS: AssetBrand[] = [
  { id: 'garmin', name: 'Garmin', aliases: [], logo: '/brands/garmin.svg' },
  {
    id: 'quark-elec',
    name: 'Quark-Elec',
    aliases: ['Quark Elec', 'QuarkElec'],
    logo: '/brands/quark-elec.png',
  },
  {
    id: 'victron-energy',
    name: 'Victron Energy',
    aliases: ['Victron'],
    logo: '/brands/victron-energy.svg',
  },
  {
    id: 'raymarine',
    name: 'Raymarine',
    aliases: ['Ray Marine'],
    logo: '/brands/raymarine.svg',
  },
]

const brandKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

export function findAssetBrand(value: string | null | undefined) {
  if (!value?.trim()) return undefined
  return ASSET_BRANDS.find((brand) =>
    [brand.id, brand.name, ...brand.aliases].some(
      (alias) => brandKey(alias) === brandKey(value),
    ),
  )
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

function stripBrand(value: string, brand: string | null) {
  if (!brand) return value.trim()
  const known = findAssetBrand(brand)
  for (const alias of known ? [known.name, ...known.aliases] : [brand]) {
    const stripped = value.trim().replace(prefixPattern(alias), '')
    if (stripped !== value.trim()) return stripped.trim()
  }
  return value.trim()
}

export type AssetIdentityInput = {
  name: string
  brand?: string | null
  modelNumber?: string | null
  description?: string | null
}

export function getAssetIdentity(asset: AssetIdentityInput) {
  const inferred = ASSET_BRANDS.find((brand) =>
    [brand.name, ...brand.aliases].some((alias) =>
      [asset.name, asset.modelNumber ?? ''].some((text) =>
        prefixPattern(alias).test(text.trim()),
      ),
    ),
  )
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
