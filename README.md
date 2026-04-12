# multi-hit-spell-lvl-scaler

Standalone Foundry VTT V13 module for the dnd5e system.

This module is meant to support spells that gain extra hits when cast with a higher slot level, instead of increasing the damage of a single hit.

Examples targeted by the MVP:

- Scorching Ray
- Magic Missile

## Phase 1 scope

This repository currently delivers only the phase 1 skeleton:

- a clean Foundry manifest
- a bootstrap entry point for Foundry lifecycle hooks
- a small internal API
- a normalized spell flag data structure
- base localization files
- a README that documents the architecture planned for phase 2

The following are intentionally not implemented yet:

- no multi-hit execution workflow
- no retarget prompt
- no focus execution flow
- no scaling calculation tied to a cast
- no item sheet UI

## File layout

```text
multi-hit-spell-lvl-scaler/
|-- lang/
|   |-- en.json
|   `-- fr.json
|-- scripts/
|   |-- main.mjs
|   `-- module.mjs
|-- module.json
`-- README.md
```

## Runtime architecture

### `module.json`

Registers the module for Foundry VTT V13, declares the dnd5e dependency, loads `scripts/main.mjs`, and exposes English/French localization files.

### `scripts/main.mjs`

Keeps the Foundry bootstrap small and predictable:

- registers the module setting(s)
- registers the module API on startup
- logs `init`, `setup`, and `ready`

This file should remain light even in later phases. Most logic should stay in dedicated modules imported from here.

### `scripts/module.mjs`

Central module core for phase 1:

- module constants and ids
- debug logger helpers
- normalized spell configuration schema
- read/write helpers for item flags
- API factory and registration

The internal API is exposed at:

```js
game.modules.get("multi-hit-spell-lvl-scaler")?.api
```

Current API surface:

```js
const api = game.modules.get("multi-hit-spell-lvl-scaler")?.api;

api.createSpellConfig();
api.normalizeSpellConfig(data);
api.getSpellConfig(item);
api.isSpellConfigEnabled(item);
await api.setSpellConfig(item, data);
await api.clearSpellConfig(item);
```

## Flag model planned for spells

Spell configuration is stored on the item under:

```text
flags.multi-hit-spell-lvl-scaler.spellConfig
```

The stored object is normalized to this shape:

```json
{
  "enabled": false,
  "baseActivityId": "",
  "extraActivityId": "",
  "countMode": "fixed",
  "fixedCount": 0,
  "slotScaling": {
    "baseLevel": null,
    "perLevel": 1,
    "countOnly": true
  },
  "promptLabel": "",
  "targetingMode": "retarget",
  "resolutionMode": "manual"
}
```

Field intent:

- `enabled`: opt-in switch per spell
- `baseActivityId`: activity used for the first hit that resolves normally
- `extraActivityId`: activity reused for additional hits without spending another slot
- `countMode`: `fixed` or `slot-scaling`
- `fixedCount`: number of additional hits when using fixed mode
- `slotScaling.baseLevel`: slot level where the scaling reference starts
- `slotScaling.perLevel`: number of additional hits gained per slot level above `baseLevel`
- `slotScaling.countOnly`: future guard that means the scaling should only change hit count, not per-hit damage
- `promptLabel`: future custom label for prompt/chat UI
- `targetingMode`: `retarget` or `focus`
- `resolutionMode`: `manual` or `auto`

Important phase 2 assumption:

- counts are expressed as additional hits after the initial activity, not as total hits

## Planned phase 2 architecture

Phase 2 can build on this skeleton with a focused workflow:

1. Detect a cast only for configured spells where `enabled` is `true`.
2. Let the first hit resolve through the normal dnd5e activity flow.
3. Compute the number of extra hits from either `fixedCount` or `slotScaling`.
4. Store a short-lived cast context so extra hits can be resolved one by one.
5. Reuse `extraActivityId` for follow-up hits without consuming another spell slot.
6. Honor `targetingMode` so the user can either keep one target or change target between hits.
7. Keep all non-configured spells untouched.

Recommended follow-up modules/files for later phases:

- `scripts/config/` for settings and defaults if more module settings appear
- `scripts/data/` for schema helpers if the flag model grows
- `scripts/workflows/` for cast detection and extra-hit resolution
- `scripts/ui/` for prompts, chat controls, or sheet integration

## Example future configuration

Example idea for Scorching Ray in phase 2:

```json
{
  "enabled": true,
  "baseActivityId": "scorching-ray-base",
  "extraActivityId": "scorching-ray-extra",
  "countMode": "slot-scaling",
  "fixedCount": 0,
  "slotScaling": {
    "baseLevel": 2,
    "perLevel": 1,
    "countOnly": true
  },
  "promptLabel": "Choose the next ray target",
  "targetingMode": "retarget",
  "resolutionMode": "manual"
}
```

## Notes

- The repository folder currently uses the name `Mutli-hit-spell-lvl-scaler`, but the module id and manifest use the correct id `multi-hit-spell-lvl-scaler`.
- If you want the local folder name to match the module id as well, rename the folder before packaging or publishing the module.
