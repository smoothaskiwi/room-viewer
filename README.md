# Bedroom layout explorer — round 5

Static, accessible three.js + SVG bedroom comparison. Agents generate and audit layouts at build time; the phone only reads the resulting gallery. No login, CDN, remote API, or client-side solver.

## Build / verify

Set `ROOM_PROJECT_DIR`, or create an **untracked** `.project-dir` containing the owning project directory. Never put that directory in tracked code or docs. Install with `npm ci`; Python 3 + Pillow/NumPy and `/usr/sbin/google-chrome-stable` are required.

```sh
npm test
npm run verify
```

Both commands start their own `python3 -m http.server` on a dynamically assigned **127.0.0.1-only** port and stop it in `finally`. Verification uses dedicated **headless** system Chrome with SwiftShader, never the user's visible browser. It writes evidence to the owning project's `prototype/renders/round-5/`.

To browse manually, serve `docs/` with a loopback HTTP server and open `/primary-bedroom-b7q4m/`. Stop that server when finished. Commit does not publish; pushing remains a separate owner action.

## Authoritative inputs

- `prototype/explorer/room-primary-bedroom.json` (room 2.0), `brief-primary-bedroom.json`, and `expected-checks-primary-bedroom.json`, under the owning project. These are read-only.
- Product records from `products/miles-specs.json`, `products/storage-candidates-2026-11-16/specs.json`, and `products/rh-outlet-2026-11-16/specs.json`.
- `data/primary-bedroom-profile.json` supplies room-specific pinned requests and the existing photo reconstruction regions.

**Legacy scene-spec 1.4 no longer drives the build.** Historical tools/source files remain as prior-round references, not the deployed UI or test entry point.

## Pipeline and contract

`tools/catalog.mjs` compiles dimensions, owned inventory, known/unknown drawer volume and travel, dated prices and finishes. Official downloaded images supply only a provisional colour sample; geometry is parametric and illustrative. Unknown travel/volume is never inferred from cabinet depth or drawer count.

`tools/explore.mjs` enumerates allowed head walls and current/corner/centred/window-boundary anchors, owned/new nightstands on either side (or one with a warning), zero/one/two storage pieces, and laundry positions. It prunes incrementally, checks 3D trim/stool layers, one-sided swept door leaves, drawer standing space, inventory multiplicity, window access, switches/registers, and child-safety warnings. It filters analytic failures, retains local Pareto trade-offs, clusters by bed wall/storage mix/laundry route pattern, then ranks representatives by everyday route, known storage, changes and dated cost. Only non-invalid layouts can be recommendations.

`tools/routes.mjs` computes build-time conservative **0.5-inch Euclidean distance transforms**, disk width = twice radius, and max–min paths without diagonal corner cutting. It chooses the shortest route at the widest capacity, retains exact-geometry diagnostic bounds, and reports the conservative lower estimate without sub-grid inflation. Endpoints are approach regions, not furniture centres. Doorway width, individual drawer standing space and the familiar local/90° door gaps stay separate. Joint survey/camera/worst-plausible scenarios re-anchor wall-adjacent pieces; they are not statistical confidence intervals.

The canonical head/front faces east. Placement x/y is the minimum corner **after** rotation: 0 east, 90 south, 180 west, 270 north. A source room supplies geometry; the bedroom activity rules are not a universal living-room solver.

## The actual result

No **wall-anchored** candidate passes the draft brief. The gallery therefore says **comparison options, not recommendations**, with every hard failure visible. It never quietly relaxes the 22-inch route, storage, drawer, window or door requirements to manufacture four recommendations. It shows Today + four distinct diagnostic options first, expanding to eight including both pinned requests. Floating-bed arrangements are outside this bounded search.

The pinned corrected queen starts at the owner's current north edge, not the superseded offset. Its sill-dependent setback is explicitly conditional, but the overall pinned layouts remain invalid on the other hard checks. Inspect the emitted `layouts.json` for the exact audit and failures.

## Phone / screen reader

Verdict and ranked HTML text table precede a one-column phone gallery. Every option has a same-scale SVG, shared formatter, class, narrowest route/scenarios, storage comparison, dated new cost and main warning. Stable `#layout=id` links, local favourites, keyboard controls, 48px targets, pressed states, and polite announcements work without interpreting the canvas. A/B plans stack at full width. One 3D scene is loaded only after asking for it, with hall/bed/orbit presets and non-dragging orbit controls. No-WebGL uses the same live SVG, not a stale fixed still.

Photo view is gated by actual placements against the retained reconstruction regions. Otherwise the UI explains why it is unavailable. Eligible layouts retain protected original pixels, fade-to-original and a separate unedited photograph; reconstruction is visibly illustrative, not photographic evidence of fit.

## Tests and privacy

`npm test` asserts every parent audit value against actual pinned placements; independently rechecks every published layout and every joint scenario; runs door, diagonal and drawer fixtures; checks cards/plans/readouts/announcements against the formatter; decodes photo plates and checks protected pixels and original-photo identity. Browser checks cover every option/view at 412×915 DPR 2 touch and 1440×900, real rotated mesh XY bounds, full-width compare, fonts/overlaps, keyboard/favourite persistence, query and genuinely WebGL-disabled fallback, zero console/network errors and axe.

Tracked files and `git log -p main` are leak-scanned. Never push `local-history-private`. Pages are noindex/nofollow (not access control), photographs have no EXIF, the root has no directory link, and vendored three.js keeps its MIT licence. Physical tape, installed door stops/handles, window escape operation, anchoring, real phone/screen-reader testing and independent blind review remain separate from browser emulation.
