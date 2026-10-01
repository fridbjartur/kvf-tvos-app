import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { FlatList, StyleSheet } from "react-native";
import SearchScreen from "../(tabs)/search";
import { TvosSearchView } from "expo-tvos-search";
import { useKvfResource } from "@/hooks/useKvfResource";
import type { IndexedProgram } from "@/types/kvf";

let mockFocused = true;
let mockNativeAvailable = true;
const mockScrollToOffset = jest.fn();
const mockScrollToTop = jest.fn().mockResolvedValue(undefined);
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useIsFocused: () => mockFocused,
  useFocusEffect: (effect: () => void) => {
    require("react").useEffect(() => {
      if (mockFocused) return effect();
    }, [effect, mockFocused]);
  },
}));
jest.mock("expo-tvos-search", () => ({
  isNativeSearchAvailable: () => mockNativeAvailable,
  TvosSearchView: "TvosSearchView",
}));
jest.mock("@/hooks/useKvfResource", () => ({ useKvfResource: jest.fn() }));
jest.mock("@/services/kvfApi", () => ({ allProgramsResource: jest.fn() }));
jest.mock("@/components/kvf-program-card", () => ({ KvfProgramCard: "ProgramCard" }));
jest.mock("@/components/FocusableButton", () => ({ FocusableButton: "Button" }));
jest.mock("@/components/refresh-indicator", () => ({ RefreshIndicator: "Refresh" }));
jest.mock("@/components/loading-spinner", () => ({ LoadingSpinner: "Loading" }));
jest.mock("@expo/vector-icons/Ionicons", () => "Icon");

let renderer: TestRenderer.ReactTestRenderer;
const programs = [
  { listKey: "sjon/show", title: "Show", sectionId: "sjon", slug: "show" },
  { listKey: "sjon/other", title: "Other", sectionId: "sjon", slug: "other" },
] as IndexedProgram[];
function render() {
  act(() => {
    if (renderer) renderer.update(<SearchScreen />);
    else
      renderer = TestRenderer.create(<SearchScreen />, {
        createNodeMock: (element) => (element.type === "TvosSearchView" ? { scrollToTop: mockScrollToTop } : null),
      });
  });
}
beforeEach(() => {
  mockFocused = true;
  mockNativeAvailable = true;
  jest.clearAllMocks();
  jest.mocked(useKvfResource).mockReturnValue({ data: programs, isLoading: false, isRefreshing: false, error: null, refresh: jest.fn() });
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined!;
  jest.restoreAllMocks();
});

it("reserves tab bar clearance in the native frame on the first render", () => {
  render();
  const search = renderer.root.findByType(TvosSearchView);
  expect(StyleSheet.flatten(search.parent!.props.style).paddingTop).toBe(140);
  expect(search.props.topInset).toBe(0);
});

it("resets native scroll on return without remounting or replacing search state", () => {
  render();
  const originalSearch = renderer.root.findByType(TvosSearchView);
  expect(mockScrollToTop).toHaveBeenCalledTimes(1);
  mockScrollToTop.mockClear();
  act(() => originalSearch.props.onSearch({ nativeEvent: { query: "Show" } }));
  expect(renderer.root.findByType(TvosSearchView).props.results).toHaveLength(1);

  mockFocused = false;
  render();
  expect(renderer.root.findByType(TvosSearchView)).toBe(originalSearch);
  expect(mockScrollToTop).not.toHaveBeenCalled();

  mockFocused = true;
  render();
  const search = renderer.root.findByType(TvosSearchView);
  expect(search).toBe(originalSearch);
  expect(mockScrollToTop).toHaveBeenCalledTimes(1);
  expect(search.props.results).toEqual([expect.objectContaining({ id: "sjon/show" })]);
});

it("scrolls fallback results to the top each time the tab becomes active", () => {
  mockNativeAvailable = false;
  jest.spyOn(FlatList.prototype, "scrollToOffset").mockImplementation(mockScrollToOffset);
  render();
  expect(mockScrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: false });
  mockScrollToOffset.mockClear();

  mockFocused = false;
  render();
  expect(mockScrollToOffset).not.toHaveBeenCalled();
  mockFocused = true;
  render();
  expect(mockScrollToOffset).toHaveBeenCalledTimes(1);
  expect(mockScrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: false });
});
