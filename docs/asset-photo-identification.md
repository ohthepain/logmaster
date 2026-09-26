# Asset photo identification

Add Equipment is a guided flow: find model, confirm the product, choose document
research, review documents, choose connection research, then review/add connections.
Each step occupies the full screen below 640px and a centered popup on desktop.
The action bar stays visible; the content scrolls independently.

The camera button opens the system photo picker (`Camera.chooseFromGallery`), which
includes a take-photo entry on supported platforms, or an image file picker on the web. Selecting a photo immediately starts identification.
An optimized, metadata-stripped image is used for AI; the original photo and a
display preview are attached privately when the asset is saved.
The photo, asset record and confirmed connections are committed together; a
failed database transaction removes the staged photo from S3.

All model use goes through TanStack AI in `src/server/asset-intelligence.ts`.
The OpenAI adapter uses `gpt-5.4-mini` for vision and web research. Configure
`OPENAI_API_KEY` on the server, alongside the existing database and photo bucket
configuration. For deployed environments, store the key in SSM and run
`./scripts/set-openai-secrets.sh staging` (see `terraform/README.md`). Never
expose this key through a `VITE_` environment variable.
The integration follows TanStack's [multimodal content](https://tanstack.com/ai/latest/docs/advanced/multimodal-content)
and [structured output with tools](https://tanstack.com/ai/latest/docs/structured-outputs/with-tools) APIs.

Brand autocomplete combines stored catalog brands and the manufacturer/logo registry.
Models are queried for the selected brand. Finished fields become an editable brand
logo (or bold name) and model label. Next always resolves the shared product identity.
Missing catalog information triggers photo-only web research through TanStack AI;
the public result and creation date are stored as review candidates. Photo discovery
uses a leased `preview` locale status, so it does not mark document research complete.

Document research is offered only when the catalog has no documents in the user's
language. It starts only after Okay. Skip during research leaves the server job
running; saving the equipment links it so later results appear on the asset page.
Documents use the selected language, then English as a fallback. Skipping the prompt
does not silently launch research on save. Described equipment without a model can
also be researched privately. Changing identity clears earlier results and selections.

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

Connection research is a separate opt-in TanStack AI query using every existing
asset in the same category on this boat. Suggested connections are checked for
review; users can uncheck them or add another same-category asset manually.
Only the final selection is persisted when Add equipment is tapped, with the
confirming user and time. Connections are shown on both
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
