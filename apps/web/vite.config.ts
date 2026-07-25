import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const config = defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "effect",
              test: /node_modules[\\/](?:@effect(?:-atom)?[\\/]|effect[\\/])/,
            },
          ],
        },
      },
    },
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tanstackRouter({ autoCodeSplitting: true, quoteStyle: "single" }),
    tailwindcss(),
    babel({
      presets: [reactCompilerPreset()],
    }),
    viteReact(),
  ],
})

export default config
