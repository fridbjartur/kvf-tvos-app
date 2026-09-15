const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");
const globals = require("globals");

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: ["dist/**", ".expo/**", "expo-env.d.ts", "coverage/**", "ios/**", "android/**"],
  },
  {
    files: ["jest.setup.js", "jest.config.js"],
    languageOptions: {
      globals: { ...globals.jest, ...globals.node },
    },
  },
  {
    // Tests may use require() after jest.doMock/resetModules to load a module
    // with the current mock registry — import statements can't do that.
    // jest.mock() is hoisted above imports, so a factory referencing a mock
    // fixture must be declared before them: imports can't all come first.
    files: ["**/__tests__/**", "**/*.test.*"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "import/first": "off",
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);
