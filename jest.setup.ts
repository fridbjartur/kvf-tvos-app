jest.mock("expo-video", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    VideoView: ({ children }: { children?: React.ReactNode }) => React.createElement(View, null, children),
    useVideoPlayer: (source: string, setup?: (player: { play: () => void; pause: () => void }) => void) => {
      const player = {
        play: jest.fn(),
        pause: jest.fn()
      };

      if (setup) {
        setup(player);
      }

      return player;
    }
  };
});
