// WORKAROUND: Mock Expo's winter runtime globals for Jest
// Expo 54+ uses a "winter" module system that requires these globals
// This is a temporary hack until Expo provides official Jest support
// See: https://github.com/expo/expo/tree/main/packages/expo/src/winter
global.__ExpoImportMetaRegistry = {};

// Mock @expo/metro-runtime to prevent native runtime from loading in Node
jest.mock("@expo/metro-runtime", () => ({}));

// Mock react-native-video
jest.mock("react-native-video", () => {
  const React = require("react");
  const MockVideo = React.forwardRef(function MockVideo() {
    return null; // Mock Video component
  });
  MockVideo.displayName = "MockVideo";
  return MockVideo;
});

// Mock expo-router to prevent loading app structure
jest.mock("expo-router", () => ({
  Stack: "Stack",
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: jest.fn(),
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
}));

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
