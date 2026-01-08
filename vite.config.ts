import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    host: true,  // 모든 네트워크 인터페이스에서 접속 허용 (IP 주소로 접속 가능)
  },
})
