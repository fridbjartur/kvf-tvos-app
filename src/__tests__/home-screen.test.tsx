import { Text } from "react-native";
import renderer, { act, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { HomeContent } from "../screens/HomeScreen";

jest.mock("../components/HeroBanner", () => ({
  HeroBanner: ({ heroes }: { heroes: Array<{ title: string }> }) => {
    const { Text: MockText } = require("react-native");
    return <MockText>{heroes[0]?.title ?? "No hero"}</MockText>;
  }
}));

jest.mock("../components/ContentRail", () => ({
  ContentRail: ({ title }: { title: string }) => {
    const { Text: MockText } = require("react-native");
    return <MockText>{title}</MockText>;
  }
}));

describe("HomeContent", () => {
  test("renders rails from combined home data", () => {
    let tree!: ReactTestRenderer;

    act(() => {
      tree = renderer.create(
        <HomeContent
          activeSection="sjon"
          data={{
            heroes: [
              {
                id: "hero",
                section: "sjon",
                slug: "dv",
                title: "Dagur og vika",
                summary: "Seinastu tidindi",
                imageUrl: null,
                canOpenProgram: true
              }
            ],
            rails: [
              {
                id: "rail-1",
                title: "Seinast lagt aftrat",
                section: "sjon",
                items: [
                  {
                    id: "item-1",
                    section: "sjon",
                    slug: "dv",
                    title: "Dagur og vika",
                    imageUrl: null,
                    canOpenProgram: true,
                    badge: "SJÓN"
                  }
                ]
              }
            ]
          }}
          error={null}
          firstRailRef={jest.fn()}
          heroRef={jest.fn()}
          isLoading={false}
          onNavigateToProgram={jest.fn()}
          onRetry={jest.fn()}
        />
      );
    });

    const renderedText = tree.root
      .findAllByType(Text)
      .map((node: ReactTestInstance) => node.props.children);

    expect(renderedText).toEqual(
      expect.arrayContaining(["Dagur og vika", "Seinast lagt aftrat"])
    );
  });
});
