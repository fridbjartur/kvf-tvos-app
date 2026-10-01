import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Pressable, Text } from "react-native";
import strings from "@/constants/strings.json";
import { UpNextOverlay, formatUpNextCountdown } from "../up-next-overlay";

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
    expect(renderer.root.findAllByType(Pressable)).toHaveLength(0);
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
    expect(renderer.root.findByType(Pressable).props.hasTVPreferredFocus).toBe(true);
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
    act(() => renderer.root.findByType(Pressable).props.onPress());
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("does not play next on its own", async () => {
    const onSelect = jest.fn();
    await render(<UpNextOverlay {...defaultProps} onSelect={onSelect} secondsRemaining={0} />);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
