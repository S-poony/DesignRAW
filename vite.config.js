import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: {
    open: true,
    watch: {
      exclude: ['**/dist_electron/**']
    }
  }
})
