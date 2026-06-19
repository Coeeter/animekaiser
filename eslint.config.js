// @ts-check

import effect from "@effect/eslint-plugin"
import { tanstackConfig } from "@tanstack/eslint-config"
import unusedImports from "eslint-plugin-unused-imports"

export default [
  ...tanstackConfig,
  {
    plugins: {
      "@effect": effect,
      "unused-imports": unusedImports,
    },
    rules: {
      "import/no-cycle": "off",
      "import/order": "off",
      "sort-imports": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/require-await": "off",
      "pnpm/json-enforce-catalog": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "@effect/no-import-from-barrel-package": [
        "error",
        { packageNames: ["effect", "@effect/platform"] },
      ],
    },
  },
  {
    ignores: ["**/eslint.config.js", "**/.prettierrc", "**/dist/**"],
  },
]
