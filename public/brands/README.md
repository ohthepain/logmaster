# Asset brand catalog

The shared catalog in `src/domain/asset-brand-catalog.ts` contains 200 marine
and onboard equipment brands in alphabetical order. It is a practical shortlist
across propulsion, navigation, communications, electrical systems, plumbing,
comfort, deck hardware, safety, tenders, audio, and clothing—not a sales ranking.
Marine supplier directories, including [SVB](https://www.svb24.com/en/brands/index.html),
[Defender](https://defender.com/en_us/brands), and
[CH Marine](https://www.chmarine.com/brands/), informed the selection.

144 brands have reviewed local logos. The other 56 display their canonical names
as text until a suitable logo is verified. Users can still enter any unlisted
manufacturer. The same catalog powers brand suggestions and logos in asset
lists, details, and add/edit forms. There is no database migration or dependency
on a remote logo service.

## Maintenance

- Add the canonical name, stable ID, aliases, and local logo path to the catalog.
  Use `logo: null` when a suitable image is unavailable; do not substitute a
  product photo or the logo of a parent company.
- Keep entries alphabetically ordered. Aliases must not resolve to another brand.
  Legacy names such as Side-Power resolve to the current manufacturer.
- Set `inferFromName: false` for names that are also ordinary words. These brands
  are available through the Brand field without reinterpreting unbranded names.
- Record image provenance, website, equipment category, and retrieval date in
  `sources.json`. That file also lists brands awaiting logos. The four original
  marks retain their preparation notes there.
- Preserve original raster files. For SVGs, use self-contained artwork with no
  scripts, event handlers, embedded HTML, or external references.
- Use `whiteLogo: true` for transparent white artwork. CSS adapts it for light
  surfaces. Other logos retain their colors in light mode; dark mode uses
  grayscale inversion. Multiply/screen blending removes white image backgrounds
  without adding a surrounding box. Check both themes before adding a logo.

Logos identify the manufacturers of users' equipment. The trademarks remain the
property of their respective owners. Source files were collected from official
manufacturer sites, their parent-company brand directories, marine retailer SVB,
and Wikimedia; per-image attribution is in `sources.json`.

Run the catalog integrity, identity, and logo component tests after edits:

```sh
pnpm test src/domain/asset-brand-catalog.test.ts src/domain/asset-brands.test.ts src/components/AssetBrandLogo.test.tsx
```
