# Release Notes

## Release Zip Content

The release zip should contain the module root files directly:

- `module.json`
- `README.md`
- `lang/`
- `scripts/`
- `styles/`

Do not include:

- `.git/`
- `.gitignore`
- local editor files
- old zip files
- temporary notes or local-only artifacts

## Recommended Release Assets

For a GitHub release, keep these asset names:

- `module.json`
- `multi-hit-spell-lvl-scaler.zip`

These names match the URLs currently declared in `module.json`.

## Quick Release Checklist

1. Update `version` in `module.json`.
2. Verify `README.md` is up to date.
3. Build a clean zip with only the module files listed above.
4. Create a GitHub release.
5. Upload `module.json` and `multi-hit-spell-lvl-scaler.zip` as release assets.
6. Verify the `manifest` and `download` URLs after publication.

## Notes

- The GitHub repository is `theorikkdk/multi-hit-spell-lvl-scaler`.
- The manifest URLs in `module.json` target that repository's GitHub release assets.
- `license` is set to `MIT`, and the full license text is provided in `LICENSE`.
