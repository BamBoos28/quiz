// vite.config.js
import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        quiz1: resolve(__dirname, 'quiz1.html'),
        quiz2: resolve(__dirname, 'quiz2.html'),
        quiz3: resolve(__dirname, 'quiz3.html'),
        quiz4: resolve(__dirname, 'quiz4.html'),
        quiz5: resolve(__dirname, 'quiz5.html'),
        quiz6: resolve(__dirname, 'quiz6.html'),
        banksoal: resolve(__dirname, 'banksoal.html'),
      },
    },
  },
})