import type { View } from "react-native";
import { createTVFocusMemory } from "../TVFocusMemoryContext";

const target = () => ({ requestTVFocus: jest.fn() }) as unknown as View & { requestTVFocus: jest.Mock };

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it("refocuses the card that opened a detail screen until it reports focus", () => {
  const memory = createTVFocusMemory();
  const card = target();
  memory.focused(card);
  // The program screen covers this one while the card still holds focus.
  memory.leave();
  memory.blurred(card);
  memory.restore();
  jest.advanceTimersByTime(60);
  // Next frame plus the first retry: the screen may not have re-attached yet.
  expect(card.requestTVFocus).toHaveBeenCalledTimes(2);
  memory.focused(card);
  jest.runAllTimers();
  expect(card.requestTVFocus).toHaveBeenCalledTimes(2);
});

it("leaves focus on the tab bar when a screen is left from it", () => {
  const memory = createTVFocusMemory();
  const card = target();
  memory.focused(card);
  // Up to the tab bar, then another tab.
  memory.blurred(card);
  memory.leave();
  memory.restore();
  jest.runAllTimers();
  expect(card.requestTVFocus).not.toHaveBeenCalled();
});

it("restores once and stops when the screen loses focus again", () => {
  const memory = createTVFocusMemory();
  const card = target();
  memory.focused(card);
  memory.leave();
  memory.blurred(card);
  const stop = memory.restore();
  stop();
  jest.runAllTimers();
  expect(card.requestTVFocus).not.toHaveBeenCalled();

  memory.restore();
  jest.runAllTimers();
  const attempts = card.requestTVFocus.mock.calls.length;
  expect(attempts).toBeGreaterThan(0);
  // A later tab selection must not pull focus back to the card.
  memory.leave();
  memory.restore();
  jest.runAllTimers();
  expect(card.requestTVFocus).toHaveBeenCalledTimes(attempts);
});
