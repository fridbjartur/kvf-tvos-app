import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AppState, Text, TouchableOpacity, type AppStateStatus } from "react-native";
import { useLocalSearchParams } from "expo-router";
import PlayerScreen from "../player";
import ProgramScreen from "../program";
import { useScreenBack } from "@/hooks/useScreenBack";
import { loadEpisode, prefetchEpisode, resolveStreamUrl } from "@/services/kvfApi";
import { FocusScaleCard } from "@/components/focus-scale-card";
import strings from "@/constants/strings.json";
import { useKvfResource } from "@/hooks/useKvfResource";
import type { EpisodeDetail, ProgramPage } from "@/types/kvf";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockNext = { section: "sjon", slug: "show", sid: "2", title: "Next" };
const mockQueue = { hasNext: true, nextEpisode: mockNext, advance: jest.fn(() => mockNext), clear: jest.fn(), setQueue: jest.fn(), progress: "1 of 2" };
jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: () => mockRouter,
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));
jest.mock("@/hooks/useScreenBack", () => ({ useScreenBack: jest.fn() }));
jest.mock("@/contexts/PlayQueueContext", () => ({
  ...jest.requireActual("@/contexts/PlayQueueContext"),
  usePlayQueue: () => mockQueue,
}));
jest.mock("@/contexts/LoadingContext", () => ({ useLoading: () => ({ hideGlobalLoader: jest.fn() }) }));
jest.mock("@/hooks/useKvfResource", () => ({ useKvfResource: jest.fn() }));
jest.mock("@/services/kvfApi", () => ({ resolveStreamUrl: jest.fn(), loadEpisode: jest.fn(), prefetchEpisode: jest.fn(), programResource: jest.fn() }));
jest.mock("@/components/FocusableButton", () => ({ FocusableButton: "Button" }));
jest.mock("@/components/up-next-overlay", () => ({ UpNextOverlay: "UpNext" }));
jest.mock("@/components/refresh-indicator", () => ({ RefreshIndicator: "Refresh" }));
jest.mock("@/components/shimmer-block", () => ({ ShimmerBlock: "Shimmer" }));
jest.mock("@/components/loading-spinner", () => ({ LoadingSpinner: "Loading" }));
jest.mock("react-native-video", () => ({ __esModule: true, default: "Video" }));
jest.mock("@expo/vector-icons/Ionicons", () => "Icon");
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-blur", () => ({ BlurView: "Blur" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "Gradient" }));

let renderer: TestRenderer.ReactTestRenderer;
let changeState: (state: AppStateStatus) => void;
let remove: jest.Mock;
const originalState = AppState.currentState;
function render(element: React.ReactElement) {
  act(() => {
    renderer = TestRenderer.create(element);
  });
}
function host(name: string) {
  return renderer.root.findByType(name as React.ElementType);
}
function back() {
  jest.mocked(useScreenBack).mock.calls.at(-1)![0]();
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  jest.clearAllMocks();
  AppState.currentState = "active";
  remove = jest.fn();
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, callback) => {
    changeState = callback;
    return { remove };
  });
  jest.mocked(useLocalSearchParams).mockReturnValue({ streamUrl: "https://example.com/1.m3u8", episodeSid: "1" });
  mockQueue.hasNext = true;
  jest.mocked(resolveStreamUrl).mockResolvedValue("https://example.com/2.m3u8");
});
afterEach(() => {
  act(() => renderer?.unmount());
  jest.restoreAllMocks();
  AppState.currentState = originalState;
});

it("ignores an episode lookup after Back, even before the player unmounts", async () => {
  const pending = deferred<string | null>();
  jest.mocked(resolveStreamUrl).mockReturnValue(pending.promise);
  render(<PlayerScreen />);
  act(() => host("Video").props.onEnd());
  act(back);
  await act(async () => {
    pending.resolve("https://example.com/next.m3u8");
  });
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it("advances only once when end and skip arrive together", async () => {
  const pending = deferred<string | null>();
  jest.mocked(resolveStreamUrl).mockReturnValue(pending.promise);
  render(<PlayerScreen />);
  act(() => {
    host("Video").props.onEnd();
    host("UpNext").props.onSkip();
    host("Video").props.onEnd();
  });
  expect(mockQueue.advance).toHaveBeenCalledTimes(1);
  await act(async () => {
    pending.resolve("https://example.com/next.m3u8");
  });
  expect(mockRouter.replace).toHaveBeenCalledTimes(1);
});

it("does not start the next episode when a lookup finishes in the background", async () => {
  const pending = deferred<string | null>();
  jest.mocked(resolveStreamUrl).mockReturnValue(pending.promise);
  render(<PlayerScreen />);
  act(() => host("Video").props.onEnd());
  AppState.currentState = "background";
  await act(async () => {
    pending.resolve("https://example.com/next.m3u8");
  });
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it("stays paused after backgrounding until native controls resume playback", () => {
  render(<PlayerScreen />);
  act(() => {
    host("Video").props.onLoad({ duration: 100 });
    AppState.currentState = "background";
    changeState("background");
  });
  expect(host("Video").props.paused).toBe(true);
  act(() => {
    AppState.currentState = "active";
    changeState("active");
  });
  expect(host("Video").props.paused).toBe(true);
  act(() => host("Video").props.onPlaybackStateChanged({ isPlaying: true, isSeeking: false }));
  expect(host("Video").props.paused).toBe(false);
  act(() => renderer.unmount());
  expect(remove).toHaveBeenCalledTimes(1);
});

it("does not display or prefetch a stale queue during live playback", () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ streamUrl: "https://example.com/live.m3u8", isLive: "true" });
  render(<PlayerScreen />);
  expect(renderer.root.findAllByType("UpNext" as React.ElementType)).toHaveLength(0);
  act(() => host("Video").props.onEnd());
  expect(mockQueue.advance).not.toHaveBeenCalled();
  expect(resolveStreamUrl).not.toHaveBeenCalled();
  expect(mockQueue.clear).toHaveBeenCalled();
});

it("renders an error instead of a black screen for a missing stream", () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  render(<PlayerScreen />);
  expect(renderer.root.findAllByType("Video" as React.ElementType)).toHaveLength(0);
  expect(renderer.root.findAllByType("Button" as React.ElementType)).toHaveLength(2);
});

it("resets the up-next overlay when the route changes episodes", () => {
  render(<PlayerScreen />);
  act(() => {
    host("Video").props.onLoad({ duration: 100 });
    host("Video").props.onProgress({ currentTime: 90 });
  });
  expect(host("UpNext").props.visible).toBe(true);
  jest.mocked(useLocalSearchParams).mockReturnValue({ streamUrl: "https://example.com/2.m3u8", episodeSid: "2" });
  act(() => renderer.update(<PlayerScreen />));
  expect(host("UpNext").props.visible).toBe(false);
});

function renderProgram() {
  jest.mocked(useLocalSearchParams).mockReturnValue({ section: "sjon", slug: "show" });
  jest.mocked(useKvfResource).mockReturnValue({
    data: { program: { title: "Show" }, episodes: [{ sid: "1", slug: "show", title: "Episode", listKey: "1" }], currentEpisodeSid: "1" } as ProgramPage,
    isLoading: false,
    isRefreshing: false,
    error: null,
    refresh: jest.fn(),
  });
  render(<ProgramScreen />);
}
it("does not open a program episode after navigating back", async () => {
  const pending = deferred<EpisodeDetail>();
  jest.mocked(loadEpisode).mockReturnValue(pending.promise);
  renderProgram();
  act(() => host("Button").props.onPress());
  act(back);
  await act(async () => {
    pending.resolve({ streamUrl: "https://example.com/1.m3u8" } as EpisodeDetail);
  });
  expect(mockRouter.push).not.toHaveBeenCalled();
  expect(mockQueue.setQueue).not.toHaveBeenCalled();
});
it("collapses repeated program Play presses into one navigation", async () => {
  const pending = deferred<EpisodeDetail>();
  jest.mocked(loadEpisode).mockReturnValue(pending.promise);
  renderProgram();
  act(() => {
    host("Button").props.onPress();
    host("Button").props.onPress();
  });
  await act(async () => {
    pending.resolve({ streamUrl: "https://example.com/1.m3u8" } as EpisodeDetail);
  });
  expect(loadEpisode).toHaveBeenCalledTimes(1);
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
  expect(mockQueue.setQueue).toHaveBeenCalledTimes(1);
});

const selectionPage = {
  program: { title: "Show", thumbnailUrl: "https://example.com/show.jpg" },
  episodes: [
    { sid: "1", slug: "show", title: "Latest episode", listKey: "1", publishDate: "22.09.2026", thumbnailUrl: "https://example.com/1.jpg" },
    { sid: "2", slug: "show", title: "Older episode", listKey: "2", publishDate: "21.09.2026", thumbnailUrl: "https://example.com/2.jpg" },
  ],
  currentEpisodeSid: "1",
} as ProgramPage;

function setProgramPage(page: ProgramPage) {
  jest.mocked(useKvfResource).mockReturnValue({ data: page, isLoading: false, isRefreshing: false, error: null, refresh: jest.fn() });
}

it("moves the episode badge, preview, artwork and Play action together when focus changes", async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ section: "sjon", slug: "show" });
  jest.mocked(loadEpisode).mockResolvedValue({ streamUrl: "https://example.com/2.m3u8" } as EpisodeDetail);
  setProgramPage(selectionPage);
  render(<ProgramScreen />);
  const cards = renderer.root.findAllByType(FocusScaleCard);
  const badge = (card: TestRenderer.ReactTestInstance) => card.findAllByType(Text).filter((text) => text.props.children === "▶");
  expect(badge(cards[0])).toHaveLength(1);
  act(() => cards[1].findByType(TouchableOpacity).props.onFocus());
  expect(badge(cards[0])).toHaveLength(0);
  expect(badge(cards[1])).toHaveLength(1);
  expect(cards.map((card) => card.props.accessibilityState.selected)).toEqual([false, true]);
  expect(cards.every((card) => !card.props.hasTVPreferredFocus)).toBe(true);
  expect(
    host("Blur")
      .findAllByType(Text)
      .map((text) => text.props.children),
  ).toEqual(["Older episode", "21.09.2026"]);
  expect(renderer.root.findAllByType("Image" as React.ElementType)[0].props.source.uri).toBe("https://example.com/2.jpg");
  expect(prefetchEpisode).toHaveBeenLastCalledWith("sjon", "show", "2");

  // Moving back to Play retains the episode selection and its preview.
  act(() => cards[1].findByType(TouchableOpacity).props.onBlur());
  await act(async () => host("Button").props.onPress());
  expect(loadEpisode).toHaveBeenLastCalledWith("sjon", "show", "2");
  expect(mockRouter.push).toHaveBeenCalledWith(expect.objectContaining({ params: expect.objectContaining({ episodeSid: "2", title: "Older episode" }) }));
});

it("retains the selected episode across a refresh and falls back when it disappears", () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ section: "sjon", slug: "show" });
  setProgramPage(selectionPage);
  render(<ProgramScreen />);
  const selectedCard = renderer.root.findAllByType(FocusScaleCard)[1];
  act(() => selectedCard.findByType(TouchableOpacity).props.onFocus());
  const newest = { ...selectionPage.episodes[0], sid: "3", listKey: "3", title: "Newest episode" };
  setProgramPage({ ...selectionPage, currentEpisodeSid: "3", episodes: [newest, ...selectionPage.episodes] });
  act(() => renderer.update(<ProgramScreen />));
  expect(renderer.root.findAllByType(FocusScaleCard)[2]).toBe(selectedCard);
  expect(selectedCard.props.accessibilityState.selected).toBe(true);
  expect(host("Blur").findAllByType(Text)[0].props.children).toBe("Older episode");

  setProgramPage({ ...selectionPage, currentEpisodeSid: "3", episodes: [newest] });
  act(() => renderer.update(<ProgramScreen />));
  expect(renderer.root.findByType(FocusScaleCard).props.accessibilityState.selected).toBe(true);
  expect(host("Blur").findAllByType(Text)[0].props.children).toBe("Newest episode");
});

it("updates the selected episode when a card is pressed without a focus event", async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ section: "sjon", slug: "show" });
  jest.mocked(loadEpisode).mockResolvedValue({ streamUrl: null } as EpisodeDetail);
  setProgramPage(selectionPage);
  render(<ProgramScreen />);
  await act(async () => renderer.root.findAllByType(FocusScaleCard)[1].props.onPress());
  expect(host("Blur").findAllByType(Text)[0].props.children).toBe("Older episode");
  expect(loadEpisode).toHaveBeenLastCalledWith("sjon", "show", "2");
});

it("uses the shared focusable Back button during the program skeleton", () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ section: "sjon", slug: "show" });
  jest.mocked(useKvfResource).mockReturnValue({ data: null, isLoading: true, isRefreshing: false, error: null, refresh: jest.fn() });
  render(<ProgramScreen />);
  expect(host("Button").props).toMatchObject({ title: strings.program.goBack, hasTVPreferredFocus: true });
  act(() => host("Button").props.onPress());
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});
