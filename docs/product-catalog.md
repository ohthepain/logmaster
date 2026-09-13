# Shared product catalog

Adding an asset with a brand and model links it to a global product by default. Users can turn off the catalog link before saving. Existing assets remain unchanged. Product lookup requires an explicit selection; formatting differences match automatically, while meaningful variants such as `+`, voltage and regional models remain distinct. Administrators can add reviewed model aliases.

Only brand/model identity enters shared research. Asset names, descriptions, photos, serial numbers, documents and boat connections remain boat-scoped. Optional connection suggestions run separately. Identifying equipment in a new photo can still require AI; cached product research avoids repeating the subsequent product/document research.

## Research and languages

`CatalogProduct` stores language-independent identity. `ProductLocale` caches sourced information per language, with English as the common factual base. Database leases prevent simultaneous users/workers from researching the same product and language twice. Completed results are reused; failed attempts have a five-minute cooldown. Localized specification values, units and category come from the English base; only matching specification labels are translated.

Official localized PDFs are preferred, followed by multilingual, English and other available sources. Documents retain their actual language, revision, applicable model numbers and source URL. Unknown languages and unreviewed sources are labeled. Manuals are not machine translated. Localized descriptions may be machine translated; an unavailable language falls back visibly to English. Finding a previously uncached language can require one additional research run.

The new UI strings have English fallbacks in all existing languages and can be translated through the existing translation administration. Product content, translation catalogs, brand logos and product media are served by the web server/API. They are not packaged into the iOS app.

## Images, storage and deletion

Shared resources are fetched once on first use, validated through the existing SSRF-safe downloader, and stored under `products/<product>/<resource>/...` in the existing S3 bucket. Manufacturer images retain their original and receive an oriented, size-limited WebP display copy. This does not remove backgrounds or reconstruct markings. PDFs and photos must have the expected validated content type.

New user photo uploads retain the exact uploaded bytes in the private boat document, plus a separate JPEG preview. A phone camera may process the image before uploading it; the retained original is the uploaded file, not raw sensor data. Existing resized uploads cannot be restored retroactively. Deleting a private photo removes both S3 objects before removing its database record. User photos are never promoted or copied into the shared image path.

The asset list uses an approved canonical product photo when available, otherwise its private photo. The asset detail separates shared product information from personal documents and original photos.

## Review

Administrators use `/admin/products` to inspect candidates and manufacturer sources, edit localized names/descriptions, approve or reject products/resources, add exact model aliases and choose canonical images. Only explicitly approved images become canonical. Shared sources are read live from the catalog instead of copied into each asset's suggested downloads, so later rejection applies to linked assets. Files explicitly saved by users as personal documents remain their own copies.

Research candidates are visible with an unreviewed label. Human source review is required before marking them verified. The initial catalog is populated as users add equipment; this change does not bulk-seed products or automatically backfill existing assets.

## Release and validation

Deploy the server and worker with migration `20260913010000_shared_product_catalog`. The normal production migration command is `pnpm db:migrate:deploy`. Deploy the migration before the new application code handles traffic. Existing S3 bucket access and the server-side OpenAI API key are reused. No iOS app release is needed. No production migration, AI calls or S3 uploads were performed during local verification.

Validation commands:

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- `RUN_PRODUCT_DB_TESTS=1 PRODUCT_TEST_DATABASE_URL=<local PostgreSQL URL> pnpm test src/server/product-catalog.integration.test.ts`

The integration test creates and drops its own randomly named schema on a localhost database, applies this migration to minimal prerequisite tables, and checks actual PostgreSQL uniqueness/lease behavior. It never runs against a remote database. AI and S3 operations are mocked in tests.
