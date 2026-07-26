import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // FIN-2: es2022 for TOP-LEVEL AWAIT. The world builds its meshes
    // synchronously in the World constructor, so the Blender factory's GLBs
    // must be resolved before that line runs; one top-level await in main.js
    // is a far smaller change than making boot async throughout.
    //
    // Not a meaningful compatibility cost: vite's default target is chrome87,
    // and this game already requires WebGL2, WebAudio and WebRTC. Every
    // browser that can run it supports top-level await.
    target: 'es2022',
  },
})
