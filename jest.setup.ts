jest.mock("expo-video", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockVideoView = React.forwardRef(
    (
      { children }: { children?: React.ReactNode },
      ref: React.ForwardedRef<unknown>,
    ) => React.createElement(View, { ref }, children),
  );

  return {
    VideoView: MockVideoView,
    useVideoPlayer: (
      source: string,
      setup?: (player: {
        addListener: () => { remove: () => void };
        currentTime: number;
        enterFullscreen?: () => void;
        pause: () => void;
        play: () => void;
      }) => void,
    ) => {
      const player = {
        addListener: jest.fn(() => ({ remove: jest.fn() })),
        currentTime: 0,
        play: jest.fn(),
        pause: jest.fn(),
      };

      if (setup) {
        setup(player);
      }

      return player;
    },
  };
});
