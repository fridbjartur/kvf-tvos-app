import TestRenderer, { act } from "react-test-renderer";
import { AppState, Text } from "react-native";
import { ContinueWatchingRow } from "../continueWatchingRow";
import { FocusScaleCard } from "../focus-scale-card";
import { EpisodeProgressOverlay } from "../episodeProgressOverlay";
import { loadEpisode, peekProgram } from "@/services/kvfApi";
import { _resetForTesting, markCompleted, recordProgress, type WatchTarget } from "@/services/watchProgressService";
import strings from "@/constants/strings.json";
import type { EpisodeDetail, ProgramPage } from "@/types/kvf";

const mockRouter = { push: jest.fn() };
const mockQueue = { setQueue: jest.fn(), clear: jest.fn() };
const mockLoading = { showGlobalLoader: jest.fn(), hideGlobalLoader: jest.fn() };
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));
jest.mock("@/contexts/PlayQueueContext", () => ({
  ...jest.requireActual("@/contexts/PlayQueueContext"),
  usePlayQueue: () => mockQueue,
}));
jest.mock("@/contexts/LoadingContext", () => ({ useLoading: () => mockLoading }));
jest.mock("@/services/kvfApi", () => ({ loadEpisode: jest.fn(), peekProgram: jest.fn() }));
jest.mock("@/services/watchProgressStorage", () => ({ watchProgressStorage: { load: () => null, save: async () => {}, clear: async () => {} } }));
jest.mock("@expo/vector-icons/Ionicons", () => "Icon");
jest.mock("expo-image", () => ({ Image: "Image" }));

const show: WatchTarget = { section: "sjon", slug: "show", sid: "2", programTitle: "Show", episodeTitle: "Episode 2", thumbnailUrl: "https://kvf.fo/2.jpg" };
const page = {
  program: { title: "Show", thumbnailUrl: "https://kvf.fo/show.jpg" },
  episodes: [
    { sid: "3", slug: "show", title: "Episode 3", listKey: "3", thumbnailUrl: null },
    { sid: "2", slug: "show", title: "Episode 2", listKey: "2", thumbnailUrl: null },
    { sid: "1", slug: "show", title: "Episode 1", listKey: "1", thumbnailUrl: null },
  ],
} as unknown as ProgramPage;

let renderer: TestRenderer.ReactTestRenderer | undefined;
function render() {
  act(() => {
    renderer = TestRenderer.create(<ContinueWatchingRow />);
  });
  return renderer!.root;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const originalState = AppState.currentState;
beforeEach(() => {
  jest.clearAllMocks();
  _resetForTesting();
  AppState.currentState = "active";
  jest.mocked(loadEpisode).mockResolvedValue({ streamUrl: "https://kvf.fo/2.m3u8" } as EpisodeDetail);
  jest.mocked(peekProgram).mockResolvedValue(page);
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  _resetForTesting();
  AppState.currentState = originalState;
});

it("renders nothing without watch history", () => {
  const root = render();
  expect(root.findAllByType(FocusScaleCard)).toHaveLength(0);
  expect(root.findAllByType(Text)).toHaveLength(0);
});

it("shows one card per program, most recent first, with its progress", () => {
  const now = jest.spyOn(Date, "now");
  now.mockReturnValue(1_000_000);
  recordProgress({ ...show, sid: "1", episodeTitle: "Episode 1" }, 600, 1800);
  now.mockReturnValue(2_000_000);
  recordProgress({ ...show, slug: "news", programTitle: "News", sid: "n", episodeTitle: "Tonight" }, 300, 1800);
  now.mockReturnValue(3_000_000);
  recordProgress(show, 900, 1800);
  const root = render();
  now.mockRestore();

  const cards = root.findAllByType(FocusScaleCard);
  expect(cards.map((card) => card.props.accessibilityLabel)).toEqual(["Show, Episode 2, 15 min. eftir", "News, Tonight, 25 min. eftir"]);
  expect(cards[0].findByType(EpisodeProgressOverlay).props.progress).toMatchObject({ position: 900, duration: 1800 });
  expect(root.findAllByType(Text)[0].props.children).toBe(strings.watch_progress.continue_watching_heading);
});

it("labels a card that moved on to an unwatched next episode", () => {
  markCompleted({ ...show, sid: "1" }, 1800, show);
  const card = render().findByType(FocusScaleCard);
  expect(card.props.accessibilityLabel).toBe(`Show, Episode 2, ${strings.player.upNextHeading}`);
  expect(card.findByType(EpisodeProgressOverlay).props.progress).toBeUndefined();
});

it("updates live while the row is mounted", () => {
  const root = render();
  act(() => recordProgress(show, 900, 1800));
  expect(root.findAllByType(FocusScaleCard)).toHaveLength(1);
  act(() => markCompleted(show, 1800, null));
  expect(root.findAllByType(FocusScaleCard)).toHaveLength(0);
});

it("resumes playback directly with the program's Up Next queue", async () => {
  recordProgress(show, 900, 1800);
  const root = render();
  await act(async () => root.findByType(FocusScaleCard).props.onPress());

  expect(mockLoading.showGlobalLoader).toHaveBeenCalledTimes(1);
  expect(mockLoading.hideGlobalLoader).not.toHaveBeenCalled();
  // Broadcast order is the reverse of the newest-first row: 1, 2, 3.
  expect(mockQueue.setQueue).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ sid: "3" })]), 1);
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: "/player",
    params: {
      streamUrl: "https://kvf.fo/2.m3u8",
      title: "Episode 2",
      section: "sjon",
      programSlug: "show",
      episodeSid: "2",
      programTitle: "Show",
      thumb: "https://kvf.fo/2.jpg",
      programThumb: "https://kvf.fo/show.jpg",
    },
  });
});

it("plays without a queue when the program page is not cached", async () => {
  jest.mocked(peekProgram).mockResolvedValue(null);
  recordProgress(show, 900, 1800);
  const root = render();
  await act(async () => root.findByType(FocusScaleCard).props.onPress());
  expect(mockQueue.clear).toHaveBeenCalled();
  expect(mockQueue.setQueue).not.toHaveBeenCalled();
  expect(mockRouter.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/player" }));
});

it("opens the program page when the stream cannot be resolved", async () => {
  jest.mocked(loadEpisode).mockRejectedValue(new Error("offline"));
  recordProgress(show, 900, 1800);
  const root = render();
  await act(async () => root.findByType(FocusScaleCard).props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/program", params: { section: "sjon", slug: "show", title: "Show", thumb: "https://kvf.fo/2.jpg" } });
  expect(mockLoading.hideGlobalLoader).toHaveBeenCalledTimes(1);
});

it("opens the program page on long press", () => {
  recordProgress(show, 900, 1800);
  const root = render();
  act(() => root.findByType(FocusScaleCard).props.onLongPress());
  expect(mockRouter.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/program" }));
  expect(loadEpisode).not.toHaveBeenCalled();
});

it("collapses repeated presses into one lookup", async () => {
  recordProgress(show, 900, 1800);
  const root = render();
  const card = root.findByType(FocusScaleCard);
  await act(async () => {
    card.props.onPress();
    card.props.onPress();
  });
  expect(loadEpisode).toHaveBeenCalledTimes(1);
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
});

it("does not open the player when the lookup finishes after the app was backgrounded", async () => {
  const pending = deferred<EpisodeDetail>();
  jest.mocked(loadEpisode).mockReturnValue(pending.promise);
  recordProgress(show, 900, 1800);
  const root = render();
  act(() => {
    root.findByType(FocusScaleCard).props.onPress();
  });
  AppState.currentState = "background";
  await act(async () => pending.resolve({ streamUrl: "https://kvf.fo/2.m3u8" } as EpisodeDetail));
  expect(mockRouter.push).not.toHaveBeenCalled();
  expect(mockLoading.hideGlobalLoader).toHaveBeenCalledTimes(1);
});
