// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Edge Functions run on Deno (npm: imports); they're outside the app's tsconfig too.
    ignores: ["dist/*", "supabase/functions/*"],
  },
  {
    files: ["app.config.js"],
    languageOptions: { globals: { process: "readonly" } },
  },
  {
    // React Compiler rules from eslint-plugin-react-hooks. The app doesn't use the
    // compiler, and they flag working patterns (Reanimated `.value` writes, random
    // confetti, load-on-mount effects), so they warn until the code is refactored.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
    },
  },
]);
