import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ВАЖНО: замените "CLUTCH" на имя вашего репозитория на GitHub
export default defineConfig({
  plugins: [react()],
  base: "/CLUTCH/",
});
