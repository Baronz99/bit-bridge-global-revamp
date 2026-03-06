# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Remotion Video Ad (Vertical 1080x1920)

A Remotion project lives in `apps/video` with composition id `BitBridgeAdVertical`.

1. Install video dependencies:
   - `npm --prefix apps/video install`
2. Put assets in `apps/video/public/`:
   - `logo.png` (already populated from `src/assets/logos/bitbridge-logo-clear.png`)
   - `voiceover.wav` (required; composition duration auto-matches this file length)
   - `transfer-voiceover.wav` (optional for `BitBridgeTransferAdVertical`; defaults to 30s if absent)
   - `bg-music.mp3` (optional; auto-detected and ducked under voiceover if present)
3. Open Remotion Studio:
   - `npm run video:studio`
4. Render MP4:
   - `npm run video:render`
   - Transfer flow ad: `npm run video:render:transfer`
   - Standalone logo reveal: `npm run video:render:logo`

Default output: `apps/video/out/bitbridge-ad-vertical.mp4`.
