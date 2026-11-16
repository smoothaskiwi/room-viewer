# Measured bedroom viewer

Accessible static three.js room study: Today, Requested and one Alternative. Deploy `docs/` as static files; no CDN, login or runtime build.

## Build and verify

Create an **untracked** `.project-dir` with the owning project directory, or set `ROOM_PROJECT_DIR`. `SCENE_SPEC` can override the specification path. The source is read-only. Python 3 with Pillow/NumPy, Node dependencies (`npm ci`) and system Chrome are required.

```sh
npm test
python3 -m http.server 8766 --bind 127.0.0.1 --directory docs
# In another terminal:
npm run verify
```

The viewer is at `/primary-bedroom-b7q4m/`. Verification defaults to the owning project's `prototype/renders/round-4/`; override `VIEWER_URL` or `RENDER_DIR` if needed. Stop the loopback server afterwards. No push is needed to build.

## Round 4

- Unchanged source spec 1.4 drives furniture, trim, clearances, verdict, tables, plans, 3D labels and announcements. The queen clears the east-window sill at a disclosed two-inch wall setback, while its headboard still covers the lower north corner of that window.
- Door stops use a one-sided slab; uncertainty propagates the hinge edge minus dresser end, including the north-window sill standoff. Camera hinge evidence is direct, not inferred from trim. Every expected margin/stop check is enforced.
- The shorter dresser clears trim and opens the door wider; it does not widen the aisle. Tape requests are published unchanged. Plan guides, person markers and uncertainty bands remain.
- Pointer/touch scene, view and toggle actions scroll the picture into sight without moving focus. Presets require no dragging; controls retain 48-pixel targets and aria-pressed. Live announcements share the page formatter and are exhaustively checked against `clearances.json`.
- Plan labels have halos and a separate door-gap dimension line. Phone From the bed and Free orbit show at most two labels. Non-breaking ranges avoid fractured numbers.
- `?no3d=1` uses the same live SVG for all layouts, drawer and door states. Unsupported views and Reset are hidden, not disabled. Fixed no-JavaScript stills disclose their poses.
- Deterministic masked photo plates use sampled walls, curtain folds and oak. Protected rack, nightstand and door pixels remain original; every build checks exact outside-mask and protected-pixel identity. No generative photo editing. New oak rails and a shadow-catching floor ground the replacement furniture; fade zero and Compare retain the unedited original.
- Cream walls are sampled from the room photos. Materials, bedding and reconstructed hidden surfaces are illustrative, not manufacturer CAD or recovered photographic evidence.

## Tests and publication

`npm test` checks source parity, all scene footprints, expected clearances, window overlaps, door margins and ranges, generated prose, every possible announcement, metadata and location safety, plus headless phone/fallback regression. The privacy test scans every tracked file and the complete patch history of `main`; local source paths belong only in the untracked setting. The former history is retained only on `local-history-private`, which must **never** be pushed. `main` has a fresh root.

`npm run verify` uses dedicated headless Chrome only (`/usr/sbin/google-chrome-stable`, SwiftShader), not the user's browser. It captures all scenes/presets/photos at 412×915/DPR 2/touch and 1440×900, open drawers/doors, fallback, photo fades/comparison and the full phone page. Checks cover real mesh bounds, furniture-versus-trim collisions, door pivots, fonts, text/line overlaps, axe, keyboard actions, scrolling and console errors. Tall images are stitched from real viewport captures to avoid the SwiftShader tile-repeat issue. Six fixed stills are regenerated.

Pages have noindex/nofollow, which is not access control. JPEG metadata is stripped. The root has no viewer directory link. Vendored three.js and add-ons carry their MIT license; the existing Van Gogh print crop is not AI-generated. Physical tape checks, a real phone/screen-reader session and independent review are separate from browser emulation.

## Catalog placements and ranked layouts

The current read-only source remains spec 1.4 for regression continuity. It is not a recommendation to buy the longer dresser. The next measured gallery needs the owner's new spec; no assumed 19-inch north offset has been substituted into the old one.

`src/layout.mjs` accepts any number of `layouts` (an array or ID-keyed object), sorted by optional `rank`. Legacy `scenes` with catalog-ID strings remain supported. `catalog` replaces `furniture` for new sources; dimensions are inches. Catalog items have `w`, `d`, `h`, `label`, and a `kind` (`bed`, `dresser`, `storage`, `nightstand`, `rack`, or `other`). The canonical local bed head and storage front face east; use placement rotation for other headings. Existing detailed bed fields and dresser drawer-extension/base-clearance fields retain their meaning. A new unrecognised object can use `other` for an honest envelope rather than an invented detailed product.

```json
{
  "catalog": {
    "queen": {"kind":"bed", "label":"Example queen", "w":84.3,"d":64.6,"h":45,
      "headboard":{"thickness":3.5,"panel_height":36.7,"top_z":45},
      "floor_clearance":8.5,"side_rail_top_z":15,"mattress_space":[60,80]},
    "compact": {"kind":"dresser", "label":"Example dresser", "w":18,"d":54,"h":33,
      "drawer_extension":10,"base_clearance":6}
  },
  "layouts": [
    {"id":"north-head", "label":"North-head option", "rank":1,
     "items":[
       {"id":"bed", "catalog_id":"queen", "position":{"x":34,"y":30}, "rotation":270},
       {"id":"dresser", "catalog_id":"compact", "position":[2,3], "rotation":0}
     ]}
  ]
}
```

This is a **schema example, not a proposed fit**. Keep the existing room/openings/guides/measurement fields alongside it. Position is the minimum x/y corner **after rotation**, not the headboard centre or an arbitrary pivot. Rotation is clockwise in the east/south coordinates: 0 east, 90 south, 180 west, 270 north. Other angles are rejected. Placed instances get independent IDs, rotated bounds, head/front directions, and computed closed/open-drawer clearance segments. Closest passage means the shortest footprint-to-footprint separation, including a diagonal segment when necessary; it is not an unverified circulation route. Door contacts test every placed item.

`tools/layout-regression.mjs` and `catalog-browser.mjs` exercise five ranked layouts, four headings, a different dresser size, rotated drawer extension, actual headboard location, mesh bounds and trim collisions. The generic fixture is built and served independently under the scratch directory, not over the deployed source. `ROOM_OUTPUT_DIR` enables isolated build output; `ROOM_TEST_RENDER_DIR` optionally retains generic-browser screenshots. Current-room photo cleanup masks remain room-specific, and the old requested/alternative verdict and source checks remain a compatibility layer until the new spec arrives.
