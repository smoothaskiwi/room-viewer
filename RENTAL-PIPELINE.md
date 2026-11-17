# Rental ingestion pipeline

Local-only tooling for the five room pages. Product research and council inputs are external to this repository; the project directory resolves through `ROOM_PROJECT_DIR` or the untracked `.project-dir`.

## Refresh final designer proposals

```sh
npm run rental:ingest
```

This re-reads all five rental research/shop sources, reads the dated rental council's A/B/C pinned room files, re-evaluates geometry and rental rules, ranks within quality/value/mixed tiers, copies compressed local product images, rebuilds rental-first pages, and regenerates shopping CSVs. It does not repeat the owner-layout search and does not publish anything. `npm run build` also runs this step after the complete owner build.

Optional `RENTAL_COUNCIL_DIR` selects another council root. A missing root or missing designer/room file produces no fake proposals; malformed submissions are listed in the ingestion report. New furniture needs sourced canonical dimensions, not just its proposed footprint. Hand checks and submitted cost totals are not treated as engine proof.

## Inspect the generated results

- `docs/catalog.json`: complete catalog, source provenance, dated prices, purchase links, public image paths, furniture/styling split.
- `docs/rental-ingestion-report.json`: counts, classes, input errors and compressed-image counts.
- Each room's `rentals.json`: evaluated proposals, reasons, band scores, camera, styling, shop rows/totals and separate test fixtures.
- Each room's `shopping-<layout-id>.csv`: current shopping list.
- `data/owner-pages/`: clean owner markup snapshots used by repeated standalone ingestion. Never edit these to change the source owner page builder.

Synthetic fixture previews use `?rental-fixtures=1`. They test the machinery, are clearly labelled, and are never recommendations. Proposals classified invalid stay inspectable with reasons; an attractive render is not a passed safety or geometry check.

## Verify

```sh
node tools/rental-catalog-test.mjs
node tools/rental-test.mjs
node tools/rental-browser.mjs --screenshots
```

For the complete retained and rental checks on an already-built artifact:

```sh
npm run test:postbuild
```

`npm test` first does a full build, then runs that same serial test chain. Do not run two full suites concurrently. Set `ROOM_TEST_EVIDENCE_DIR`, `ROUND10_EVIDENCE_DIR`, `RENTAL_EVIDENCE_DIR` and `TMPDIR` to scoped scratch when evidence must not go to old project render folders. All browser checks use independent headless Chrome/SwiftShader and loopback Python servers; the server/browser are stopped in `finally`.

## Limits

Doorway prose maps to a heuristic corner; explicit `hero_view: {position:[x,y,z],target:[x,y,z]}` is preferable for a final listing composition. The listing eye height is fixed at 54 in. Styling and furniture are illustrative, not manufacturer CAD. Incomplete upholstery abrasion/cleaning evidence is excluded, not assumed to pass; anchors, blackout/workspace and other buying conditions remain explicit. Prices exclude tax/delivery/installation, and unknown prices produce a known subtotal, not a fictional free item. The retained room briefs' calibrated minima are hard; 24/30/36-in comfort targets are banded preferences. Council acceptance, remaining owner-use review defects and publishing belong to the next integration pass.
