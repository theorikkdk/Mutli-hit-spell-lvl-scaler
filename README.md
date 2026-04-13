# Multi-Hit Spell Level Scaler

Multi-Hit Spell Level Scaler is a Foundry VTT V13 module for `dnd5e`.

It lets selected spells scale by gaining additional hits as slot level increases, instead of increasing the damage of a single hit.

## What The Module Does

- Treats a configured spell cast as a pool of total hits.
- Applies the rule `1 hit = 1 target = 1 workflow`.
- Uses normal spell slot consumption only for the first hit of the initial cast.
- Resolves all later hits without spending another slot.
- Leaves unconfigured spells completely unchanged.

## Compatibility

- Foundry VTT V13
- `dnd5e`
- Standalone module

Midi-QOL note:

- The module does not depend on Midi-QOL.
- It is built around native `dnd5e` activities.
- If your world uses Midi-QOL, test configured spells in your own setup before regular play.

## Installation

- GitHub release: [theorikkdk/multi-hit-spell-lvl-scaler](https://github.com/theorikkdk/multi-hit-spell-lvl-scaler)
- Manifest URL: [module.json](https://github.com/theorikkdk/multi-hit-spell-lvl-scaler/releases/latest/download/module.json)

In Foundry:

1. Open the module installer.
2. Paste the manifest URL.
3. Install the module.
4. Enable it in your world.

## How To Configure A Spell

1. Open the spell sheet.
2. Click the Multi-Hit button in the sheet header.
3. Enable Multi-Hit.
4. Choose the activity that should be reused for each hit.
5. Set `baseTotalHits`.
6. Set `hitsPerSlotLevel`.
7. Save.

The spell's base level is derived automatically from the spell itself.

## How To Use It

### Initial Cast

- When you cast the spell, you can select from `1` to `totalHits` targets.
- Each selected target is resolved as its own single-target workflow.
- Any unused hits remain available after the initial cast.

### Next Hit

- Spends exactly `1` remaining hit.
- Requires exactly `1` selected target.

### Resolve All

- Spends `1` hit per selected target.
- Cannot exceed the number of remaining hits.

## Examples

### Scorching Ray

- Base spell level: 2
- `baseTotalHits = 3`
- `hitsPerSlotLevel = 1`

Examples:

- Cast at level 2: 3 hits
- Cast at level 3: 4 hits
- Cast at level 4: 5 hits

### Magic Missile

- Base spell level: 1
- `baseTotalHits = 3`
- `hitsPerSlotLevel = 1`

Examples:

- Cast at level 1: 3 hits
- Cast at level 2: 4 hits
- Cast at level 3: 5 hits

## Current Limitations

- Template-based activities are not supported in this flow.
- The configuration UI is intentionally lightweight.

## License

This project is released under a custom non-commercial license. See [LICENSE](LICENSE).
