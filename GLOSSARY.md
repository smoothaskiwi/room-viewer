# Measured room layouts

Room-coordinate terms shared by the catalog, plan, browser and fit calculations.

## Language

**Catalog item**: A furniture definition with canonical local dimensions and an appearance kind, separate from where it is placed.
_Avoid_: Scene object, placed item when referring only to a product definition.

**Placement**: One catalog instance in one layout, positioned by the minimum x/y corner of its rotated footprint.
_Avoid_: Pivot, headboard location, room-wide product position.

**Layout**: A named set of placements; optional rank orders the comparison gallery without changing geometry.
_Avoid_: Fixed scene number, hard-coded scenario.

**Rotation**: Clockwise quarter turns in the east/south coordinate frame; east, south, west and north correspond to 0, 90, 180 and 270 degrees for a canonically east-headed bed.
_Avoid_: Camera orbit, screen angle.

**Closest passage**: The shortest planar separation between placed bed and storage footprints, with drawer travel included when open. This geometric gap is not proof of a usable circulation route.
_Avoid_: Guaranteed walking route, accessibility clearance.

**Storage contact**: The first contact of the one-sided rotating door slab with a placed furniture envelope; the installed door stop and lever are separate unknowns.
_Avoid_: Measured maximum opening.
