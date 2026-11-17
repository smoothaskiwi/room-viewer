# Rental ingestion pipeline

Local-only tooling for the five room pages. Product research and council inputs are external to this repository; the project directory resolves through `ROOM_PROJECT_DIR` or the untracked `.project-dir`.

## Refresh final designer proposals

```sh
npm run rental:ingest
```

This re-reads all five rental research/shop sources, reads the dated rental council's A/B/C pinned room files, re-evaluates geometry and rental rules, ranks the actual schemes across quality/value tiers (price breaks equal-score ties), copies compressed local product images, rebuilds rental-first pages, and regenerates shopping CSVs. It does not repeat the owner-layout search and does not publish anything. `npm run build` also runs this step after the complete owner build.

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

`npm test` first does a full build, then runs that same serial test chain. Do not run two full suites concurrently. Set `ROOM_TEST_EVIDENCE_DIR`, `ROUND10_EVIDENCE_DIR`, `RENTAL_EVIDENCE_DIR`, `ROUND11_EVIDENCE_DIR` and `TMPDIR` to scoped scratch when evidence must not go to old project render folders. All browser checks use independent headless Chrome/SwiftShader and loopback Python servers; the server/browser are stopped in `finally`.

## Limits

Doorway prose maps to a heuristic corner; explicit `hero_view: {position:[x,y,z],target:[x,y,z]}` is preferable for a final listing composition. The listing eye height is fixed at 54 in. Styling and furniture are illustrative, not manufacturer CAD. Incomplete upholstery abrasion/cleaning evidence is conditional, not invalid or assumed to pass; anchors, blackout/workspace and other buying conditions remain explicit. Prices exclude tax/delivery/installation, and unknown prices produce a known subtotal, not a fictional free item. The retained room briefs' calibrated minima are hard; 24/30/36-in comfort targets are banded preferences. The parent rule tiers are tested in `tools/rental-rulings-test.mjs`; all 30 submissions are retained, with three additive one-piece geometry fixes and three EKHOLMA value-sofa variants. `tools/round11-test.mjs` checks the generated artifact; `tools/round11-browser.mjs` checks actual cards, 44px targets, active-state numbers, 1440px comparisons and listing cameras, and records evidence in `ROUND11_EVIDENCE_DIR` (default: the project’s round-11 render folder). Publication remains a parent step.


## Reuse-first support (Round 12 part 1)

The rental-only inventory overlay reads the owned-furniture specs and each room's Today envelopes. Canonical owned ids and room-scoped Today aliases refer to the same physical furniture; unknown ownership cannot make a new product free. Guest-room current contents remain excluded. Owned pieces cost $0; unavailable model names/links do not block reuse. Known photo estimates, their ± margins and their origin rooms are visible in the list. Submitted footprints within an owned estimate's margin are replaced by the canonical estimate and warned; new-purchase dimension checks and all geometry checks remain strict. The current primary Today bed is a king, not a queen: reuse does not waive the existing queen requirement.

Owned white/bouclé and other new-purchase material exclusions become care notes, not material failures. Anchoring and geometry still apply. Reuse cards lead the gallery; within each hard geometry class, weighted comfort/style points plus two points for reuse minus new spend divided by $250 sets the order. Missing prices cannot look like a complete free layout. The complete ranking rationale is shown on every card.

Shopping has **You own** and **To buy** sections; copy/CSV preserve status, origin, size margins, care and zero new spend. Only To buy rows need retailer links. Owned thumbnails use an inventory image when actually available, never a speculative model-match photo. Plan tags and the existing Three.js renderer use owned-piece colours. Root `reuse-house.json` and the whole-house section show each designer's five-room new spend and moves; duplicate physical assignments produce `reuse_warnings` in the ingestion report and an unusable-plan warning. Separate pieces of an owned pair can be split only with distinct `owned_instance_id` values, within the inventory quantity.

### Part 2 — only after all three designers have finished

Confirm all 15 pinned room files are final, each with a reuse layout. Part 1 deliberately used a frozen copy of only the 30 old quality/value proposals, not the changing designer reuse files. From the repository:

```sh
unset RENTAL_COUNCIL_DIR
npm run rental:ingest
node tools/reuse-test.mjs --ui
npm run test:postbuild
REUSE_EVIDENCE_DIR="$TMPDIR/reuse-final" node tools/reuse-browser.mjs --screenshots
```

Review `docs/rental-ingestion-report.json` (`errors`, `reuse_warnings`), `docs/reuse-house.json`, every reuse verdict/care note and the actual resulting pictures before accepting the plans. `test:postbuild` now includes the new ownership and browser tests and does not rerun the owner search. Scope all existing evidence environment variables to a permitted scratch directory before running it. Do not publish automatically.

Synthetic owned scenes: any room `?reuse-fixtures=1`; root `?reuse-fixtures=1` shows a clearly labelled synthetic whole-house plan. They never become designer recommendations. `node tools/reuse-browser.mjs --screenshots` checks all five at 412×915 DPR2 and 1440×900, uses the required independent headless Chrome/SwiftShader with a loopback Python server, and closes both in `finally`. Capture waits are bounded and only decode visible images: hidden lazy images may never resolve. Scenario verdicts, rules and measured widths remain public; redundant scenario placement snapshots and dense path samples are omitted to stay within the unchanged 32-MiB deployment cap.
