import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Platform, Text } from "react-native";
import strings from "@/constants/strings.json";
import { UpNextOverlay, formatUpNextCountdown } from "../up-next-overlay";

let mockRemoteHandler: ((event: { eventType: string; eventKeyAction: number }) => void) | undefined;
const mockRequestFocus = jest.fn();
jest.mock("react-native", () =>
  Object.defineProperty(Object.create(jest.requireActual("react-native")), "useTVEventHandler", {
    value: (handler: typeof mockRemoteHandler) => {
      mockRemoteHandler = handler;
    },
  }),
);

jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("expo-image", () => ({ Image: "Image" }));

type Listener = () => void;
let mockNative: { show: jest.Mock; hide: jest.Mock; addListener: jest.Mock; listeners: Set<Listener> } | null = null;
jest.mock("@/modules/kvf-up-next", () => ({
  __esModule: true,
  get default() {
    return mockNative;
  },
}));

function createNative(shown = true) {
  const listeners = new Set<Listener>();
  return {
    listeners,
    show: jest.fn(() => Promise.resolve(shown)),
    hide: jest.fn(() => Promise.resolve()),
    addListener: jest.fn((_event: string, listener: Listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    }),
  };
}

const defaultProps = {
  visible: true,
  title: "Episode 2 - The Return",
  imageUrl: "https://example.com/2.jpg",
  secondsRemaining: 15,
  leadSeconds: 20,
  onSelect: jest.fn(),
};

let renderer: TestRenderer.ReactTestRenderer;
async function render(element: React.ReactElement) {
  await act(async () => {
    renderer = TestRenderer.create(element);
  });
}
async function update(element: React.ReactElement) {
  await act(async () => renderer.update(element));
}
function buttons() {
  return renderer.root.findAll((node) => node.props.accessibilityRole === "button" && typeof node.props.onPress === "function", { deep: false });
}

function texts() {
  return renderer.root.findAllByType(Text).map((node) => node.props.children);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockNative = null;
});
afterEach(() => {
  act(() => renderer?.unmount());
});

it("formats the countdown in whole seconds", () => {
  expect(formatUpNextCountdown(4.2)).toBe(strings.player.upNextCountdown.replace("{seconds}", "5"));
  expect(formatUpNextCountdown(-1)).toBe(strings.player.upNextCountdown.replace("{seconds}", "0"));
});

describe("with the native transport bar button", () => {
  it("adds the button to the player and draws a card that never takes focus", async () => {
    mockNative = createNative();
    await render(<UpNextOverlay {...defaultProps} />);
    expect(mockNative.show).toHaveBeenCalledTimes(1);
    expect(mockNative.show).toHaveBeenCalledWith(strings.player.upNextHeading);
    expect(buttons()).toHaveLength(0);
    expect(texts()).toEqual(expect.arrayContaining([strings.player.upNextHeading, defaultProps.title, formatUpNextCountdown(15)]));
  });

  it("updates the countdown without re-adding the button", async () => {
    mockNative = createNative();
    await render(<UpNextOverlay {...defaultProps} />);
    await update(<UpNextOverlay {...defaultProps} secondsRemaining={14} />);
    expect(mockNative.show).toHaveBeenCalledTimes(1);
    expect(texts()).toContain(formatUpNextCountdown(14));
  });

  it("plays next when the native button is selected", async () => {
    mockNative = createNative();
    const onSelect = jest.fn();
    await render(<UpNextOverlay {...defaultProps} onSelect={onSelect} />);
    act(() => mockNative!.listeners.forEach((listener) => listener()));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("removes the button when hidden or unmounted", async () => {
    mockNative = createNative();
    await render(<UpNextOverlay {...defaultProps} />);
    await update(<UpNextOverlay {...defaultProps} visible={false} />);
    expect(mockNative.hide).toHaveBeenCalledTimes(1);
    expect(mockNative.listeners.size).toBe(0);
    expect(renderer.toJSON()).toBeNull();

    await update(<UpNextOverlay {...defaultProps} />);
    expect(mockNative.show).toHaveBeenCalledTimes(2);
    act(() => renderer.unmount());
    expect(mockNative.hide).toHaveBeenCalledTimes(2);
  });

  it("ignores a selection from a button that was already removed", async () => {
    mockNative = createNative();
    const onSelect = jest.fn();
    await render(<UpNextOverlay {...defaultProps} onSelect={onSelect} />);
    const stale = [...mockNative.listeners];
    await update(<UpNextOverlay {...defaultProps} onSelect={onSelect} visible={false} />);
    stale.forEach((listener) => listener());
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("gives the card its own button when no native player controller is on screen", async () => {
    mockNative = createNative(false);
    await render(<UpNextOverlay {...defaultProps} />);
    expect(buttons()[0].props.hasTVPreferredFocus).toBe(true);
  });
});

describe("without the native module", () => {
  it("renders nothing when not visible", async () => {
    await render(<UpNextOverlay {...defaultProps} visible={false} />);
    expect(renderer.toJSON()).toBeNull();
  });

  it("plays next from the card's own button", async () => {
    const onSelect = jest.fn();
    await render(<UpNextOverlay {...defaultProps} onSelect={onSelect} />);
    expect(texts()).toContain(strings.player.upNextAction);
    act(() => buttons()[0].props.onPress());
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("does not play next on its own", async () => {
    const onSelect = jest.fn();
    await render(<UpNextOverlay {...defaultProps} onSelect={onSelect} secondsRemaining={0} />);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

it("does not take focus from Android player controls when Up Next appears", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(Platform, "OS")!;
  const tvDescriptor = Object.getOwnPropertyDescriptor(Platform, "isTV")!;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
  Object.defineProperty(Platform, "isTV", { configurable: true, value: true });
  try {
    const onSelect = jest.fn();
    await render(<UpNextOverlay {...defaultProps} onSelect={onSelect} />);
    expect(buttons()).toHaveLength(1);
    expect(buttons()[0].props.hasTVPreferredFocus).toBe(false);
    expect(buttons()[0].props.focusable).toBe(true);
    expect(renderer.root.findAllByProps({ autoFocus: true }).length).toBeGreaterThan(0);
    // Jest's native View mock does not implement the TV focus command.
    buttons()[0].props.ref.current.requestTVFocus = mockRequestFocus;
    mockRequestFocus.mockClear();
    // Android reports a short press on release; other keys and the press itself are ignored.
    act(() => mockRemoteHandler?.({ eventType: "right", eventKeyAction: 1 }));
    act(() => mockRemoteHandler?.({ eventType: "up", eventKeyAction: 0 }));
    expect(mockRequestFocus).not.toHaveBeenCalled();
    act(() => mockRemoteHandler?.({ eventType: "up", eventKeyAction: 1 }));
    expect(mockRequestFocus).toHaveBeenCalledTimes(1);
    act(() => buttons()[0].props.onPress());
    expect(onSelect).toHaveBeenCalledTimes(1);
  } finally {
    Object.defineProperty(Platform, "OS", descriptor);
    Object.defineProperty(Platform, "isTV", tvDescriptor);
  }
});
