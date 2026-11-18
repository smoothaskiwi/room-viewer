# Round 17 A — primary and living

## Delivered

1. Window-clearance copy is regenerated from each evaluated bed and its actual head-wall window, after variant geometry is final. The RH primary winner ends at **84.1875 in**, against opening start **85.1 in**, so the nominal margin is **0.9125 in**, shown consistently as **0.9 in**. The unshifted non-RH alternative correctly retains its own **1.4-in** rounded margin; it is not globally replaced. Expanded phone notes show the final rounded endpoint **84.2 in**, one margin and the trim/setback tape condition. The new regression scans full visible clearance prose for all layouts and fixtures, deliberately rejects a stale-note injection, and changes the model to prove the summary regenerates.
2. Primary rank 1 keeps both owned RH tables. All three living Best picks instead draw and evaluate **two 19.5-in round P055 side tables**, with the second explicitly labelled as replacing the RH table now in primary. The five room winners' owned-shopping quantities now fit the household inventory; the regression checks every owned ID, not only RH, and deliberately rejects duplicate use. The **$149** procurement moves out of primary into living: primary **$2,931.21 → $2,782.21**; living **$1,175.32 → $1,324.32** (all three Best picks, before builder B's unrelated product edits). A separate RH-retained living alternative is under More options and explicitly requires the non-RH primary bedside layout.
3. Best-effort approach improvement: in the TV-centred living layouts, coffee table moves from **(118,79) to (114,76)** and the adjacent round side table from **(96,100) to (93,100)**. Both sofa local approaches improve **11 → 14 in estimated walking width**; best group entry remains **25 in**, all seven drinks pass the unchanged about-18-in/**18.5-in** threshold (maximum **18.42 in**), and occupied-head sightlines remain clear. The **15-in target is not met** and the short trade-off plainly discloses it. A further half-inch north move gives 15-in approaches but loses drink coverage (**18.89 / 18.65 in**). Additional real trials moving tables to the sofa sides or removing/reallocating the stump produced worse local access (**0.5–9 in**); no inflated pass is claimed. The direct no-swivel option gets the same 14-in improvement.

## Verification

- `npm run test:quick`: **PASS**, 15 stages, **81.66 s**; Round 17 A adds **75** assertions, including negative controls.
- Full `npm test`: **PASS**, **24 stages in 549.05 s**, exit 0. Exactly one full invocation; build, all unit stages and all nine browser stages passed. Log retained in scratch as `round17/a-full.log`. The task-owned port-8781 server was stopped after capture.
- Dedicated headless-only phone check: **412 × 915, DPR 2, mobile/touch**, Chrome/SwiftShader. Living and primary rank-1 card, plan, listing and expanded notes/shopping captured. **Zero page exceptions, zero horizontal overflow**, and browser assertions confirm primary visible text has **0.9 in**, no stale **1.4 in**, and living has the **Qty 2 / $149** replacement note. Visual inspection succeeded on both listings, plans and notes, including the cropped living seating group. The living plan shows two round bought tables and the 14-in label; primary listing shows the open RH bedside silhouette. Cameras themselves were not changed.
- Captures and `phone-audit.json`: `PROJECT/prototype/renders/round-17/a/`.
- Initial capture attempt coincided with the full build temporarily serving baseline owner pages and timed out waiting for the enhanced app. After build output completed, the same capture path passed. No product or geometry failure was hidden.

## Files / merge

- New `tools/round17-a.mjs`, `tools/round17-a-test.mjs`, `tools/round17-a-capture.mjs` and this note.
- Pipeline hooks: `tools/rental-build.mjs`, `tools/rental-presentation.mjs`.
- Test registration: `tools/test-suite.mjs`; two obsolete primary procurement expectations updated in `tools/round16-b-test.mjs`.
- Actual rendered living listing cache/manifest updated under `data/listing-images/`, including the explicitly conditional RH-retained alternative. Parent should rebuild the merged pipeline.
- No council source proposals edited. No guest labels, kitchen scene or purchase destinations touched. Generated `docs/` and `data/owner-pages/` are excluded from the commit.
