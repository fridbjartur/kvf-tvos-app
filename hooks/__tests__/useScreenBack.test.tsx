import React, { createContext, useContext, useEffect } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { BackHandler, Platform, TVEventControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { useScreenBack } from "../useScreenBack";

const FocusContext = createContext(false);
function useMockFocusEffect(effect: () => void | (() => void)) {
  const focused = useContext(FocusContext);
  useEffect(() => (focused ? effect() : undefined), [effect, focused]);
}
function Consumer({ onBack }: { onBack: () => void }) {
  useScreenBack(onBack);
  return null;
}
function Screen({ focused, onBack }: { focused: boolean; onBack: () => void }) {
  return (
    <FocusContext.Provider value={focused}>
      <Consumer onBack={onBack} />
    </FocusContext.Provider>
  );
}

let renderer: TestRenderer.ReactTestRenderer;
let handlers: Set<() => boolean | null | undefined>;
function render(element: React.ReactElement) {
  act(() => {
    if (renderer) renderer.update(element);
    else renderer = TestRenderer.create(element);
  });
}
function pressBack() {
  for (const handler of [...handlers].reverse()) {
    if (handler()) return true;
  }
  return false;
}

beforeEach(() => {
  handlers = new Set();
  jest.mocked(useFocusEffect).mockImplementation(useMockFocusEffect);
  jest.spyOn(Platform, "isTV", "get").mockReturnValue(true);
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
    handlers.add(handler);
    return {
      remove: () => {
        handlers.delete(handler);
      },
    };
  });
  jest.spyOn(TVEventControl, "enableTVMenuKey").mockImplementation(() => {});
  jest.spyOn(TVEventControl, "disableTVMenuKey").mockImplementation(() => {});
});
afterEach(() => {
  act(() => renderer.unmount());
  renderer = undefined!;
  jest.restoreAllMocks();
  jest.mocked(useFocusEffect).mockReset();
});

it("captures Menu only on the focused detail screen and consumes repeated Back once", () => {
  const back = jest.fn();
  render(<Screen focused={false} onBack={back} />);
  expect(handlers.size).toBe(0);
  expect(TVEventControl.enableTVMenuKey).not.toHaveBeenCalled();
  render(<Screen focused onBack={back} />);
  expect(TVEventControl.enableTVMenuKey).toHaveBeenCalledTimes(1);
  act(() => {
    expect(pressBack()).toBe(true);
    expect(pressBack()).toBe(true);
  });
  expect(back).toHaveBeenCalledTimes(1);
  render(<Screen focused={false} onBack={back} />);
  expect(handlers.size).toBe(0);
  expect(TVEventControl.disableTVMenuKey).toHaveBeenCalledTimes(1);
  expect(pressBack()).toBe(false);
  render(<Screen focused onBack={back} />);
  act(() => {
    pressBack();
  });
  expect(back).toHaveBeenCalledTimes(2);
});

it("only pops the active player, then program, then category as focus returns", () => {
  const categoryBack = jest.fn();
  const programBack = jest.fn();
  const playerBack = jest.fn();
  const tree = (active: string) => (
    <>
      <Screen focused={active === "category"} onBack={categoryBack} />
      <Screen focused={active === "program"} onBack={programBack} />
      <Screen focused={active === "player"} onBack={playerBack} />
    </>
  );
  for (const active of ["player", "program", "category"]) {
    render(tree(active));
    expect(handlers.size).toBe(1);
    act(() => {
      pressBack();
    });
    if (active === "player") {
      expect(programBack).not.toHaveBeenCalled();
      expect(categoryBack).not.toHaveBeenCalled();
    }
  }
  expect(playerBack).toHaveBeenCalledTimes(1);
  expect(programBack).toHaveBeenCalledTimes(1);
  expect(categoryBack).toHaveBeenCalledTimes(1);
});

it("keeps Menu enabled when focus effects overlap during a transition", () => {
  const back = jest.fn();
  render(
    <>
      <Screen focused onBack={back} />
      <Screen focused onBack={back} />
    </>,
  );
  expect(TVEventControl.enableTVMenuKey).toHaveBeenCalledTimes(1);
  render(
    <>
      <Screen focused={false} onBack={back} />
      <Screen focused onBack={back} />
    </>,
  );
  expect(TVEventControl.disableTVMenuKey).not.toHaveBeenCalled();
  render(
    <>
      <Screen focused={false} onBack={back} />
      <Screen focused={false} onBack={back} />
    </>,
  );
  expect(TVEventControl.disableTVMenuKey).toHaveBeenCalledTimes(1);
});

it("handles Android Back without changing Apple TV Menu handling", () => {
  jest.replaceProperty(Platform, "OS", "android");
  const back = jest.fn();
  render(<Screen focused onBack={back} />);
  act(() => {
    expect(pressBack()).toBe(true);
  });
  expect(back).toHaveBeenCalledTimes(1);
  expect(TVEventControl.enableTVMenuKey).not.toHaveBeenCalled();
});
