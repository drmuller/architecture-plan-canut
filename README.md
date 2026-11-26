# Ivry · Atelier Canut

Interactive 3D reconstruction of a Lyon canut apartment based on the ASEPT PRO ind. 1 plan and 3D views dated 12 October 2026.

Open `index.html` directly, or visit the GitHub Pages URL after enabling **Settings → Pages → Deploy from a branch → main → / (root)**. The root page embeds its scripts, styles, and cropped plan, so Pages needs no build step.

The editable source is in `dist/`. To run it locally:

```sh
python3 -m http.server 4173 --directory dist
```

Then open <http://localhost:4173>.

## Introduction: the apartment in its building

The page opens on the neighbourhood: terraces of canut buildings on the slopes of the Croix-Rousse, the two white towers across the side street and the Rhône beyond. The camera flies down to the corner building and the apartment is picked out on its façades (second floor: five tall windows on the street and one round the corner). The building then comes apart like an exploded drawing. The roof and the floors above lift away, the floors below drop, the rest of the block folds into the ground, and only the apartment is left in the usual overview.

- It plays once per browser tab. **Skip intro** or Esc ends it; **Views → Play the introduction** replays it. `?intro=0` in the address skips it and `?intro=1` forces it; it does not autoplay when the system asks for reduced motion.
- The apartment's storey in the building is the real model, so its own windows, and its lamps at night, show through the façade. The other floors repeat its window positions.
- The surroundings are a schematic massing drawn from aerial views, not a survey: building heights, roofs, the side façade's blind bays, the towers and the river are approximate.



The model fills the window. A top bar holds the view tools (**Views**, **Walk**, **Cut**, **Display**, **Light**), a side panel holds the editing tabs (**Finishes**, **Furniture**, **Space**, **Plan**), and a camera ball sits at the top right. On phones the panel becomes a bottom sheet: tap a tab to open it, tap it again to close it.

- **Click anything to select it.** Furniture and the person show a blue frame, a floating toolbar (turn, edit, put back, deselect) and a round handle. Walls, floors, joinery, worktops and ceilings open their finishes, with quick colours beside the click.
- **Drag the selected piece** to move it across the floor. Drag the round handle around it to turn it (5° steps; hold Shift for free rotation). **Press and hold** any piece to grab it without selecting it first. Every other drag orbits the camera.
- Arrow keys nudge 10 cm (Shift: 1 cm), R turns 15°, Ctrl/⌘+Z undoes, Esc deselects. Furniture movement is freeform; compare the floor plan when checking clearances.
- **Double-click** a point to fly there. Room labels are buttons too.

### Camera ball

The ball at the top right is a thumbstick: push it and the view keeps orbiting that way, release and it springs back. It also works as a compass. The N, E, S and W markers and the ▲ top marker follow the real camera, and tapping one brings that side to the front (▲ gives a top view). In walkthrough the ball turns your head instead. When it has keyboard focus, the arrow keys steer it.

### Section cut

**Cut** slices the model with a plane that faces the camera at the moment it is created. After that the plane keeps its orientation: it only moves **forward or backward**, with the slider, the − / + buttons (hold to keep moving), the orange handle in the model, the mouse wheel over the bar, or the `[` and `]` keys. Cut faces are filled dark, as in a drawn section, and what is cut away casts no shadow.

- **Upright** (on by default) stands the cut vertically along the camera's heading, snapping square to the walls when within a few degrees; from a top view it becomes a plan cut 1.20 m above the floor. Turn it off to match the exact camera tilt.
- **Flip** shows the other side, **Re-aim** cuts again from the current view, and **Remove** (or the Cut button) deletes it.
- While a cut is active, automatic wall cutaways are suspended so the section is true. The cut is a local viewing aid; it is not saved or shared.

### Light and rendering

The sun stands where it really is over the building. **Light** follows the current date and time in Lyon by default (**Now**), or shows any moment you choose: a time slider, a date field with solstice and equinox shortcuts, and Morning, Midday, Golden hour and Evening, which are worked out from that day's sunrise and sunset. The menu states sunrise, sunset and where the sun is. Daylight enters through the real window openings; after sunset the sky darkens and the pendants and floor lamp come on.

The position used is the neighbourhood's, rounded to two decimals, which is ample for the sun. The street façade is taken to face 172° (just east of due south), read from the building on the map; **Light → Orientation** adjusts it, and the camera ball's compass follows. `?date=2026-06-21&time=15:30` in the address pins a moment.

**Realistic** rendering adds ambient occlusion, finer shadows and multisampling; **Fast** is lighter and is the default on touch devices. If frames stay slow the app first skips occlusion while moving, then switches to Fast. `?quality=high|standard` forces a setting.

Rendering is on demand: the picture is redrawn only when something changes. Finishes are procedural and true to scale (12.5 cm parquet boards, veneer on joinery, sawn timber overhead, fine plaster), projected in metres so they stay consistent across split or cut-away walls.

### The person

A young woman, 1.65 m tall with long brown hair, stands by the kitchen island as a scale figure. She can be moved and turned like furniture, switched between **Standing** and **Sitting**, hidden under **Display → Person**, and recoloured part by part (hair, jumper, jeans, shoes, skin). Her pose and colours travel with the design.

Layout and material choices save in browser storage.

Printed widths from the plan guide the model. The entry and bathroom box has a 2.90 m plasterboard ceiling; the kitchen/living area reaches 4.00 m with a main beam and timber joists. Beam section, joist spacing and furniture sizes are illustrative and should not be treated as survey dimensions.

The windows are drawn from a photograph of the rooms during the works, not from measurements. Their widths come from the plan; the glazing runs from about 0.90 m to 2.90 m above the floor. Each has two opening leaves with a grid of small panes at the top, a tall pane and a shorter one below; the wide windows (about 1.70 m) add a fixed side light at each end, the narrow ones (about 1.20 m) do not. The kitchen window has the same design but starts at 1.10 m, above the worktop. The pattern lives in `dist/window-pattern.js` and is reused on the façades in the introduction. The same goes for the person, the lamps, rugs and plants, the sun path and the plain ceilings over the bedrooms and hall.

Three.js, OrbitControls and the add-ons in `dist/vendor/addons` (r170: EffectComposer, GTAOPass, OutputPass, RoomEnvironment and their shaders) are copyright the Three.js authors and licensed under MIT. See <https://github.com/mrdoob/three.js/blob/master/LICENSE>.


## Save, export and shared editing

**Save & share** provides a complete JSON export/import and automatic local drafts in IndexedDB, including furniture, finishes, uploaded textures and ceiling heights. JSON exports can be imported on another device. PNG exports are pictures only.

GitHub Pages serves the application. Supabase stores one shared apartment design. Everyone who can access the page can read and save it; there is no sign-in or editor restriction. Shared saves are explicit. Visitors check for new revisions every 10 seconds while the page is visible. A newer shared revision never silently overwrites an unsaved local draft: load the latest version or explicitly replace it. Export a draft before replacing it if you want a separate copy.

Setup:

1. Run `supabase/schema.sql` in the project's Supabase SQL Editor.
2. Set the project origin and **publishable** key in `dist/shared-config.js`. A legacy anon key is also supported. Never use a secret or service-role key.
3. Run `npm test` and `npm run build`, then publish the updated root `index.html` to GitHub Pages.
4. Open **Save & share**, save the first shared design, and check it from another browser.

The SQL keeps previous shared revisions in `app_private.ivry_history`, accessible to the project administrator. Writes use an atomic revision check. Local drafts remain available when the connection fails. This is shared snapshot editing, not simultaneous per-object merging.

Rebuild the standalone page after editing any source in `dist/`:

```sh
npm run build
```


## Walkthrough

Choose **Walk** in the top bar for an eye-level visit. Click the small floor dots, spaced about half a metre along the room and corridor routes, to jump, or use **Jump to** to enter another room. Drag (or swipe) to turn your head; the camera ball and the arrow keys also turn the view. Scroll or use +/− to change the field of view. **Exit walkthrough**, Esc, or another view returns to orbit controls.

Walls and ceilings remain full in walkthrough mode. Points hidden by walls are not shown, and points occupied by moved furniture are disabled. Navigation is local to each visitor and does not change the shared design.


## Individual wall and bathroom colours

Click a wall face in the model, or pick a named one under **Finishes → Surface**. Dragging still orbits the camera. Opposite sides of partitions and room sections of long walls have separate finishes. The kitchen wood cladding also has its own finish.

The SDB bathroom and SDE shower room have separate floor and wall palettes, including the shower recess returns and the ML cupboard return. Tiles are 50 × 50 mm with 2 mm grout; their world-space grid stays the same size during cutaways and ceiling-height changes. Custom colours leave the grout neutral.

Colours are included in automatic local recovery, JSON export/import and **Save & share → Save shared design**. Older designs inherit their previous plaster finish on the new wall faces. Repeated uploaded textures use validated references to avoid inflating exports. The update needs no Supabase schema changes.


## Reuse colours and select multiple walls

**Saved colours** is available for every material. The last used colour appears first; click a saved swatch to reuse that exact solid colour on the current surface or selection. **Save current** also stores an existing surface colour without recolouring anything. Up to 12 unique colours are kept, included in local recovery, JSON exports and shared design saves. Tile grids and neutral grout stay intact when applying colours.

Click a face to select it; **Shift-click** adds or removes faces. A blue overlay marks the actual selected faces, following wall cutaways and ceiling-height changes. The selection count and names appear in Finishes, and a floating bar offers quick colours. A normal click replaces the selection, and **Clear** or Esc clears it. Selection is local UI state and is never exported or shared. Colour/finish and roughness edits apply to the whole selection; uploaded texture editing is limited to a single non-tiled surface.

Selection also works inside **Walk**: click to select, or Shift-click to add/remove. Dragging still turns your head and floor dots still move between points. Colour changes keep the same camera position and direction. Esc first clears an active selection; a second Esc exits walkthrough.


## Furniture detail and individual colours

Movable sofas, armchairs, chairs, beds, wardrobes, tables and the desk use rounded edges, padded cushions, timber legs, handles, fabric weave and wood grain. The reconstruction keeps the existing furniture IDs, positions, rotations and nominal sizes; these are illustrative furniture models, not identified manufacturer products.

Click a piece in the model, or choose it in the **Furniture** list (which also flies the camera to it). Choose **Wood & frame**, **Upholstery / fabric**, or **Bedding / scatter cushions** where available, then use the colour picker, swatches or saved colours. Only the selected piece changes. **Restore colours** restores that piece’s original palette independently of its position. Colour overrides are included in automatic local saves, JSON exports and explicit shared saves. Older designs load with the new default furniture palette. No database migration is required. In walkthrough, arrow keys keep turning the head; Esc deselects furniture before exiting.


## Kitchen counter stools

Three counter stools stand on the living-room side of the kitchen peninsula, whose worktop overhangs that side by 20 cm so the seats tuck under it. They follow the supplied product sheet: 88 cm overall height, 67 cm seat height with a 3 cm cushion, 43.5 × 41 cm seat, 40 × 20 cm backrest, 48 × 51 cm leg footprint and footrest at 19.5 cm. They have a sage-green metal frame, rust seat and mustard velvet backrest. Each stool can be moved like other furniture. Its **Metal frame**, **Upholstery / fabric** and **Backrest** colours can be changed separately. Older local drafts, JSON exports and shared designs still load; stools missing from them appear in their default place.


## Navigating the 3D model

- **Zoom at the cursor:** the scroll wheel or trackpad pinch zooms toward the point under the pointer, not the screen centre.
- **Views** in the top bar lists the camera presets and a close 3/4 view of each room; Home returns to the overview.
- **Panning** (right-drag, two fingers, or WASD/arrow keys) slides across the floor. It stops at the apartment's edges, so the model can't be lost. Q/E turn the view.
- **Display** holds the wall cutaway and ceiling modes and the toggles for furniture, the person, room labels, dimension guides and ceiling zones.
- **Reset all finishes** is at the bottom of Finishes and asks for confirmation before resetting colours.


## Source layout and tests

`dist/app.js` builds the model and wires the interface. Focused modules sit beside it: `render-pipeline.js` (lighting, occlusion, section fill), `solar.js` (sun position and civil time), `daylight.js`, `building-intro.js` (the neighbourhood and the opening sequence), `textures.js`, `surface-materials.js`, `section-cut.js`, `view-joystick.js`, `character-model.js`, `furniture-models.js`, `walkthrough.js` and the design format and sharing modules. `scripts/build.py` inlines everything, including the Three.js add-ons, into the root `index.html`; keep each `import` on one line and one `export` per declaration so it can do so.

`npm test` covers the geometry, the design format and sharing, the walkthrough, and the pure logic of the section cut, the camera ball, the sun and daylight model, the introduction's timeline and the scale figure.
