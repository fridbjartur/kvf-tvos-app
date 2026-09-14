module.exports = {
  preset: "jest-expo",
  // Worklets must resolve its JS implementation in Jest, not the native bridge.
  resolver: "react-native-worklets/jest/resolver.js",
  testEnvironment: "jest-environment-node",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
  collectCoverageFrom: ["services/**/*.{ts,tsx}", "utils/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}", "!**/__tests__/**", "!**/node_modules/**"],
};
