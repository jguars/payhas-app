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
    // Design system (DESIGN.md → Tokens): screens use tokens and components/ui,
    // never raw sizes, spacing, radii or colours. Warn while screens move onto
    // the components (docs/UI_UX_WORKFLOW.md, Phases 6–7); then this becomes an error.
    files: ["src/**/*.tsx"],
    ignores: ["src/theme/**", "src/components/ui/**", "src/features/games/**"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "Property[key.name=/^(fontSize|lineHeight|letterSpacing|borderRadius|borderWidth|borderTopWidth|borderBottomWidth|gap|rowGap|columnGap|padding|paddingHorizontal|paddingVertical|paddingTop|paddingBottom|paddingLeft|paddingRight|margin|marginHorizontal|marginVertical|marginTop|marginBottom|marginLeft|marginRight)$/] > Literal[value>0]",
          message: "Use a token (type.*, space.*, radius.*, border.*) instead of a raw number. See DESIGN.md → Tokens.",
        },
        {
          selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message: "Use a colour token (color.*, lane[x].color / .text, media.*) instead of a raw hex value.",
        },
      ],
    },
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
