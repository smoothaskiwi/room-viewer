# Bedroom layout explorer — round 7

Static, accessible three.js + SVG bedroom comparison. Agents generate and audit layouts at build time; the phone only reads the resulting gallery. No login, CDN, remote API, or client-side solver.

## Build / verify

Set `ROOM_PROJECT_DIR`, or create an **untracked** `.project-dir` containing the owning project directory. Never put that directory in tracked code or docs. Install with `npm ci`; Python 3 + Pillow/NumPy and `/usr/sbin/google-chrome-stable` are required.

```sh
npm test
npm run verify
```

Both commands start their own `python3 -m http.server` on a dynamically assigned **127.0.0.1-only** port and stop it in `finally`. Verification uses dedicated **headless** system Chrome with SwiftShader, never the user's visible browser. It writes evidence to the owning project's `prototype/renders/round-7/`.

To browse manually, serve `docs/` with a loopback HTTP server and open `/primary-bedroom-b7q4m/`. Stop that server when finished. Commit does not publish; pushing remains a separate owner action.

## Authoritative inputs

- `prototype/explorer/room-primary-bedroom.json` (room 2.0), `brief-primary-bedroom.json`, and `expected-checks-primary-bedroom.json`, under the owning project. These are read-only.
- Product records from `products/miles-specs.json`, `products/storage-candidates-2026-11-16/specs.json`, `products/mcm-catalog-2026-11-16/specs.json` dressers/chests, `products/owned-furniture/specs.json` Machinto variants, and `products/rh-outlet-2026-11-16/specs.json`.
- `data/primary-bedroom-profile.json` supplies room-specific pinned requests and the existing photo reconstruction regions.

**Legacy scene-spec 1.4 no longer drives the build.** Historical tools/source files remain as prior-round references, not the deployed UI or test entry point.

## Pipeline and contract

`tools/catalog.mjs` compiles dimensions, owned inventory, published drawer volume/travel and labelled estimates, dated prices and finishes. Official downloaded images supply only a provisional colour sample; geometry is parametric and illustrative. Brief 1.4 retains explicit estimates when specifications omit values: travel = case depth minus 3 in; storage = 0.55 × case volume above the legs (6-in legs assumed if unpublished). Estimates and planning uncertainty are labelled, never passed off as product specifications.

`tools/explore.mjs` enumerates allowed head walls and current/corner/centred/window/15/18/24-in constraint boundaries and 3/6-in off-wall positions, owned/new nightstands on either side (or one with a warning), allowed storage pieces (the owner-excluded cubes are never generated), and laundry positions. It prunes incrementally, checks 3D trim/stool layers, one-sided swept door leaves, drawer standing space, inventory multiplicity, 3D window access and switches/registers. Tall storage receives ordinary manufacturer anti-tip advice only. It filters analytic failures, retains local Pareto trade-offs, clusters by bed wall/storage mix/laundry route pattern, then ranks representatives by main walkway, minimum bed-side strip, storage, changes and dated cost. Only non-invalid layouts can be recommendations.

`tools/routes.mjs` computes build-time conservative **0.5-inch Euclidean distance transforms**, disk width = twice radius, and max–min paths without diagonal corner cutting. It chooses the shortest route at the widest capacity, retains exact-geometry diagnostic bounds, and reports the conservative lower estimate without sub-grid inflation. Endpoints are approach regions, not furniture centres. Doorway width, individual drawer standing space and the familiar local/90° door gaps stay separate. Joint survey/camera/worst-plausible scenarios re-anchor wall-adjacent pieces; they are not statistical confidence intervals.

The canonical head/front faces east. Placement x/y is the minimum corner **after** rotation: 0 east, 90 south, 180 west, 270 north. A source room supplies geometry; the bedroom activity rules are not a universal living-room solver.

## The actual result

Brief **1.4** keeps **Today valid** (26-in conservative main route, 17.75/26.6-in side strips). Five distinct ranked alternatives pass at the best estimate and remain conditional in joint scenarios. All four and both pinned dresser requests are visible. Only Today retains the cubes. The bounded search is not a global-optimum claim.

Hard checks: height-aware collisions/room bounds, required items, white/closet doors ≥90° and entry fully open, main routes ≥20 in, bed strips ≥15 in, one-open-drawer standing ≥8 in. Below 16-in standing, storage shortfall, switch reach, receptacles and glass-hidden area are preferences. Window operation is a warning unless no openable egress-candidate remains (then invalid). Body routes ignore above-24-in wall projections ≤3 in; furniture collisions still include trim/stools. Main paths end at side-strip **entrances**, never inside the 15-in strip or at the glass. The strip measure excludes the head-end table and uses the usable middle of the long side.

Pinned requests retain their exact placements and all 20 parent assertions. With the white bathroom door **closed**, the Mid-Century request is valid and the Miles request conditional: conservative everyday routes 22/21 in, local gaps 23.45/22.15 in, drawer standing 15.45/13.45 in. White-open routes 13/16 in are separate warnings. Marking that door `open` in `brief.doors.everyday_state` makes both invalid, with no code change. Entry is open along the south wall; closet is closed. The stool-dependent setback is not silently adjusted.

`tools/dresser-tradeoff.mjs` recomputes every west-fitting catalog dresser/chest, plus a labelled hypothetical size. Its table compares camera/survey stop ranges, thin-leaf and full-slab local open-door gaps, and closed walkways. Five parent reference rows are asserted within 1 degree / 0.25 in. About 105 degrees is owner-acceptable, more is preferred; installed stops/handles remain unmeasured.

## Phone / screen reader

A verdict of at most three sentences precedes a one-column phone gallery. Each layout starts with one plain sentence of at most 25 words; live announcements use that sentence. Expand **Details** for the preserved full description and the per-layout table: everyday route, separate white-open and closet-open routes and their bottleneck locations, bed-side strips, drawer standing, door angle, storage, both glass-hidden area percentages and cost, with ± and differences from Today. The compare table uses the same formatter. The door-length table and detailed ranked text table follow the gallery. Each plan includes a numbered name/overall-size legend legible on a 412-px phone. Stable `#layout=id` links, local favourites, keyboard controls, 48px targets, pressed states, and polite announcements work without interpreting the canvas. A/B plans stack at full width. One 3D scene is loaded only after asking for it, with hall/bed/cutaway-orbit presets and non-dragging orbit controls. No-WebGL uses the same live SVG, not a stale fixed still.

Photo view is gated by actual placements against the retained reconstruction regions. Otherwise the UI explains why it is unavailable. Eligible layouts retain protected original pixels, fade-to-original and a separate unedited photograph; reconstruction is visibly illustrative, not photographic evidence of fit.

## Tests and privacy

`npm test` asserts every parent audit value against actual pinned placements; independently rechecks every published layout and every joint scenario; runs door, diagonal and drawer fixtures; checks cards/plans/readouts/announcements against the formatter; decodes photo plates and checks protected pixels and original-photo identity. Browser checks cover every option/view at 412×915 DPR 2 touch and 1440×900, real rotated mesh XY bounds, full-width compare, fonts/overlaps, keyboard/favourite persistence, query and genuinely WebGL-disabled fallback, zero console/network errors and axe. A regression requires Today valid in all joint scenarios, four passing alternatives and lexicographic policy ranking; orbit verifies actual near-wall visibility.

Tracked files and `git log -p main` are leak-scanned. Never push `local-history-private`. Pages are noindex/nofollow (not access control), photographs have no EXIF, the root has no directory link, and vendored three.js keeps its MIT licence. Physical tape, installed door stops/handles, window escape operation, anchoring, real phone/screen-reader testing and independent blind review remain separate from browser emulation.

## Round 7 sizes and 3D windows

The owner's north nightstand is 18 in; king and pinned queen north edge 18.5 in. Audit 1.1 pins the queen headboard to 18.5–83.1: 1.8 in casing span overlap, 2.8 in assumed stool overlap, 2 in clear of glass. Inputs are copied unchanged.

`tools/windows.mjs` evaluates piece-front to assumed glass/wall plane (24 in comfortable, 30 limit) over tops at most 40 in, union glass-hidden area, and strictly-under-stool height (top minus 1 in). Higher pieces stand off by stool projection. No width-coverage warning or width-based egress penalty remains. At least one egress-candidate must remain openable; this is planning, not code approval. Sash recess, locks and operating force remain unmeasured.

`tools/size-sweep.mjs` analytically evaluates 14/16/18/20-in depths, 30-in-to-span lengths every 2 in, 30–36-in dresser and 44–54-in chest heights every 2 in, all quarter turns and both run-end anchors, including below windows. Pareto boundary size samples enter the full bed/nightstand/sorter recombination; all four bed headings and 0/3/6-in floating offsets are tested. Tables distinguish this owner-edge reference sweep from the full recombination, and report actual evaluated counts rather than claiming exhaustive optimization. At most two top-family generic layouts are published, labelled “generic size, no product chosen”; generic storage is unpriced, not free.

Four compact wall tables expose independent rule envelopes with expandable assumptions; three depth/length tables show conservative moving route, local gap, door angle, drawer standing and window reach, plus nearest catalog sizes. An envelope's scalar maxima are not one guaranteed-fitting box. West reference: 18.225-in depth with estimated depth-minus-3 drawer travel (8-in standing); 21.45-in depth for a straight 20-in walkway only. North sash comfort: 22-in cabinet depth plus 2-in stool standoff, 40-in height; below 27-in top slides beneath the 28-in stool. Full owner-edge window dresser fits can still fail bedside/drawer rules. Physical tape and real hardware remain necessary.
