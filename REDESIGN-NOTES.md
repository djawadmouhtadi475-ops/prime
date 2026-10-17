# Prime Launcher — Mint Outline UI redesign

- The four uploaded ZIP files were byte-for-byte identical (same SHA-256), so only one copy was used as the base project rather than merging duplicate copies.
- Updated the Electron renderer styling to a dark Minecraft-launcher layout with a wider navigation sidebar, mint-green outline icons, selected navigation states, and a featured Play area.
- Preserved the existing launcher code and screens (installations, skins, mods, account/settings dialogs, and launch flow) instead of replacing them with a static mockup.
- The hero art uses the project's bundled SVG artwork so it works offline. The hero copy avoids hard-coding a Minecraft release number; the actual current version should come from the version manifest when connected to the live version service.

## Run

1. Install Node.js (LTS).
2. Extract the ZIP.
3. Run `npm install`.
4. Run `npm start`.

Build a Windows installer with `npm run build` on a compatible Windows build environment.
