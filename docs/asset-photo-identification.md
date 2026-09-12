# Asset photo identification

Add asset offers the device camera in Capacitor and a file picker on the web.
Photos are decoded, rotated, resized to at most 2400 pixels and stripped of EXIF
metadata on the server. The resulting JPEG is attached when the asset is saved.
The photo, asset record and confirmed connections are committed together; a
failed database transaction removes the staged photo from S3.

All model use goes through TanStack AI in `src/server/asset-intelligence.ts`.
The OpenAI adapter uses `gpt-5-mini` for vision and web research. Configure
`OPENAI_API_KEY` on the server, alongside the existing database and photo bucket
configuration. For deployed environments, store the key in SSM and run
`./scripts/set-openai-secrets.sh staging` (see `terraform/README.md`). Never
expose this key through a `VITE_` environment variable.
The integration follows TanStack's [multimodal content](https://tanstack.com/ai/latest/docs/advanced/multimodal-content)
and [structured output with tools](https://tanstack.com/ai/latest/docs/structured-outputs/with-tools) APIs.

The user must confirm or correct a detected model number, or select **No model
number**. Research works from a description even without a model. Identification
and research failures allow manual entry with the photo preserved. Editing the
identity during creation discards old research results and confirmations.

Suggestions remain on the saved asset until downloaded or dismissed. Download
and attach stores actual PDF or JPEG/PNG/WebP bytes, not a link. Downloads only
allow public HTTPS destinations, validate every redirect, pin resolved DNS
addresses, impose a 25 MB limit, and check file signatures. A suggestion attaches
only once even if multiple requests race. Photos use the Photos category;
manuals, instructions and diagrams use Instructions and the `manual` purpose;
warranties use Warranties. Other files use Miscellaneous. HTML landing pages and
unsupported files remain as suggestions with an error and a source link.

Asset categories are independent from document categories. Existing assets are
initially Uncategorized and can be assigned using Edit. The Assets filters
include all eleven categories and Uncategorized.

Connection suggestions are unchecked by default. Only selected confirmations
are persisted, with the confirming user and time. Connections are shown on both
assets, can be removed, and inform future research. The server checks both ends
belong to the same boat. Inferred connections are not wiring or installation
verification.

Apply `pnpm db:migrate:deploy` when deploying the server. Run `pnpm cap:sync`
before building native apps so the camera plugin and iOS usage descriptions are
included. Android camera capture does not save to the gallery or require broad
storage permissions.

Validation: `pnpm typecheck`, `pnpm test`, and `pnpm build`. Real camera capture,
photo identification and web research additionally require device testing and a
configured API key. The unit tests mock model responses and network downloads.
