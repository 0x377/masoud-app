import { defineConfig } from "vite";
import laravel from "laravel-vite-plugin";
import react from "@vitejs/plugin-react";
import Inspect from "vite-plugin-inspect";

export default defineConfig({
  plugins: [
    Inspect(),
    laravel({
      input: ["resources/js/app.jsx"],
      refresh: true,
    }),
    // react(),
  ],
//   server: {
//     watch: {
//       ignored: ["**/storage/framework/views/**"],
//     },
//     port: 3000,
//   },
});
