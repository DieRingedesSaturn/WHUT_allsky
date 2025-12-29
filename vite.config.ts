import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // 这里填仓库名，前后都要加斜杠
  base: '/WHUT_allsky/', 
  plugins: [react()],
})
