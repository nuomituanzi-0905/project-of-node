import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  // base: './', // 打包时必须是 URL
  server: {
    host: '0.0.0.0',
    port: 5173,
    cors: true,
  },
  plugins: [vue()]
})