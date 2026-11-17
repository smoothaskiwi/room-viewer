# Room and route contract — Round 9b

All coordinates are inches. `x` increases east; `y` increases south; floor `z=0`.
Footprints are rotation-applied `x,y,w,d,h` envelopes; `rotation` is provenance, **do not rotate these extents again**. `polygon` is the actual plan boundary in room coordinates. Table bases and tops are separate height layers; a table overlapping a banquette seat in plan is not automatically a solid collision. Full-person walk routes use table **top** envelopes, never a pedestal-only shortcut.

## Room discovery

`docs/rooms.json` is an array, generated from `data/rooms.json`:

```json
[
  {"room":"primary-bedroom","slug":"primary-bedroom-b7q4m","title":"Primary bedroom","path":"primary-bedroom-b7q4m/","layouts":"layouts.json"},
  {"room":"kitchen","slug":"kitchen-n4x8p","title":"Kitchen nook","path":"kitchen-n4x8p/","layouts":"layouts.json"},
  {"room":"dining-room","slug":"dining-f6r2v","title":"Dining room","path":"dining-f6r2v/","layouts":"layouts.json"}
]
```

`path` is relative to `docs/` (the Pages root); `layouts` is relative to that page.
Each page also publishes `room.json`, `brief.json`, `catalog.json`, `render-spec.json`, `verdict.txt` and downloadable `wall-clearances-<layout-id>.txt`.

## Stable route data

In **every** room's `layouts.json`, each `layouts[].routes.destinations[]` retains:

```js
{
  id: string,
  width: number,              // conservative 0.5-in grid moving-disk diameter
  path: [[x,y], ...],         // room coordinates, not screen pixels
  bottleneck: {
    x: number, y: number,
    width: number,            // identical to the containing route.width
    between: [string,string],// two distinct nearest boundary entity ids
    state: 'everyday' | 'door open' | 'chairs pulled out' | 'seated'
  }
}
```

Boundary ids name a movable footprint, built-in, opening, or `wall-north|east|south|west`. Wall segments omit floor openings. `between` identifies nearby bounding entities; it does not replace the EDT diameter with their diagonal edge gap. Disconnected invalid proposals retain width zero and an explicit unconnected-route sentinel. Never render a zero-width route as a passing walk.

`bottleneck_point: [x,y]` preserves the previous point when present. Bedroom plan consumers now accept the object and legacy arrays; no placement, classification or measurement changed. Kitchen/dining also retain `states.tucked|seated|pulled.{chairs,route}`; the same route records are exposed in destinations with descriptive state names. Bedroom destinations currently describe everyday doors; door-open warnings remain separately reported and must not be relabelled as everyday clearance.

`layouts[].metrics` / `keys` / `state_metrics` are engine-formatted strings used by static HTML, plan/detail, compare and announcement paths. Do not recompute measurements in a renderer. Unknown price/base/underside fields remain null/unknown, not zero or purchase-ready approval.

## Shared opening and joined reference

Dining coordinates = nook coordinates − `(101.1, -54.6)`, survey allowance ±2 in. The arch is 97 in jamb-to-jamb but only 66.4 in open floor (30.6 in of its north part is cabinet). `house-graph.json` records the graph and an actual combined-polygon 0.5-in route for the pinned 48×32 / 60×36 reference pair, in each chair state. It does **not** claim that arbitrary cross-room selections have been jointly checked or that living-room furniture is modelled. Plain-text result: `house-walk.txt`.

## Council proposals

At build time, `tools/council.mjs` reads optional A/B/C pinned-room files from the private project tree. Every proposal is schema-validated, converted to the same table/base/chair footprints and evaluated with the same hard rules and joint scenarios. Hand numbers are ignored. Invalid proposals stay visible as pinned invalid comparisons, with failed rule ids; no hand-picked class is trusted.

## Front-end integration boundary

- `src/explorer-3d.mjs`: **unchanged** in the Round 9b engine/UI commit.
- `src/explorer-app.mjs`: **unchanged** in that commit.
- `src/explorer-plan.mjs`: accepts `bottleneck.x/y` with legacy array fallback.
- `src/explorer.css`: only adds wrapping 44px-minimum room-switcher links and the current-room state.
- New `src/dining-{app,plan,3d,format}.mjs` and `src/dining.css`: shared kitchen/dining gallery, compare, hash/share, favourites, announcements, labelled illustrative shapes/banquette/chairs/fixtures; no photo mode without plates; forced-WebGL and no-JS plan fallback. Existing wall-clearance UI/geometry/overlay modules are reused.
- `tools/build.mjs`: annotates bedroom route publication; loads room manifest; adds bedroom switcher; runs new-room searches in separate sequential child processes (worker RSS reported per room, not inherited cumulative peaks); refreshes wall-clearance assets for every room; writes house index, `rooms.json` and joined reference report. Original bedroom renderer asset/plate path and refresh call remain.
- `tools/wall-clearances-build.mjs`: dining entrypoint detection refreshes shared clearance modules and per-layout text without injecting duplicate UI or copying bedroom entrypoints over new ones; original bedroom injection remains.

## Repeatable verification

Run `npm test` **sequentially**. It builds all rooms, runs the independent geometry/expected-check/privacy tests, retained bedroom regression, existing wall-clearance tests, and headless browser tests. New browser tests spawn a loopback-only `python3 -m http.server`, use `/usr/sbin/google-chrome-stable` with headless SwiftShader flags, and terminate both browser and server in `finally`. `node tools/activity-browser.mjs --screenshots` captures every shown plan/default 3D, mobile/desktop galleries, comparison, fallback and the bedroom switcher into the private Round 9b render directory.

For UI-only iteration, `node tools/activity-build.mjs <kitchen|dining-room> --reuse` refreshes assets from retained outputs without claiming a fresh search. Final verification always uses a full build. Source inputs are read-only. Private root comes from `ROOM_PROJECT_DIR` or ignored `.project-dir`; never put a private address in this repository. Privacy tests ignore only SHA-1/SHA-256 hex digests, not the literal house number.

## Separate Family bedroom walkway patch

The subsequent Family commit adds `walkwayOverlay` to `src/explorer-3d.mjs`: instantiate, draw, update after show, expose `setWalkway` / debug readback, dispose. Mesh construction and cameras remain unchanged. `src/explorer-app.mjs` imports/mounts/synchronises `mountWalkwayUI` and exposes walkway debug data; selection, compare, favourites, doors and photos otherwise remain unchanged. New `src/walkway-clearances.css` is separate; established wall-gap CSS is not edited by this patch. `tools/build.mjs` imports `amendWalkwayClearances` and calls it immediately after the bedroom wall-clearance refresh **only**. In that bedroom-only commit no kitchen/dining walkway overlay was installed; those adapters remained with the Family lane.

The 11 non-build patch files applied cleanly. The explicitly excluded stale build hunk was integrated manually. Test harnesses were made portable: the browser test archives actual committed pre-overlay bedroom assets from `537d383` into scoped scratch storage and serves only that baseline plus current docs; the object-contract test compares current output against committed legacy-array `a7ca7cf`. They no longer depend on a missing sibling `preimages/` folder or write a sibling `evidence/` directory. Geometry, wall and owner-contract tests run with `npm test`; the paired 160-capture walkway browser also runs in that suite.

## Final Family polygon / chair-state adapter

The next separate Family commit applies all 11 activity source paths after exact preimage checks (three existing SHA-256 values, eight absent new files); all 11 initial postimages match the supplied manifest. `src/dining-app.mjs` imports/mounts/synchronises the new activity annotation UI; `src/dining-3d.mjs` adds the additive SVG/label overlay, draw/dispose/debug methods and camera restoration. `tools/dining-page.mjs` calls `amendActivityWalkways(out)` after publishing page assets. No further bedroom or `tools/build.mjs` hook changes are made. Activity source CSS remains separate; original wall-clearance CSS and geometry stay intact.

Only the supplied browser harness needed portable paths/baseline fixture and dynamic report counts: it archives actual pre-overlay activity pages from `35ed980` into scoped scratch storage, compares rendered meshes/materials/world bounds/cameras, and writes evidence under the private Round 9b render directory. The original dispatch covered 29 layouts; final council C proposals expanded the retained set to 35. Geometry/routing logic is not rewritten. Published source paths, widths, bottleneck coordinates and chair states are preserved. Some source bottleneck discs lie just beyond the pictured floor at an opening; that known display limitation is intentionally retained.

Final council normalization accepts the documented **shape note** (including leading `rounded oval` / `round, diameter` descriptions), not only a bare enum. It parses the leading actual shape, so `oval as sold (ask for a true racetrack)` remains oval. A published `circle` footprint wins over a collection name containing `Rounded`; unpublished enlargements and genuinely unknown forms still fail. Regressions first demonstrated these source-data failures, then passed.

To keep the annotation proof valid after those model corrections, the activity harness preserves its archived `35ed980` source preimage and builds a **separate derived fixture** using that actual pre-overlay renderer/page builder with byte-copied current room/layout/brief/catalog/render datasets. It records all ten dataset hashes. Thus comparison isolates annotation behavior instead of mistaking an intentional table-shape correction for a mesh regression. The original archive and supplied Family manifests remain untouched.
