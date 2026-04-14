import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { findNodeHandle } from "react-native";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { selectHomeSectionData } from "../api/mappers";
import type { HomeScreenData } from "../api/types";
import { useHomeData } from "../hooks/useHomeData";
import { HeroBanner } from "../components/HeroBanner";
import { ContentRail } from "../components/ContentRail";
import {
  getHomeConnectionIssueLabel,
  getHomeEmptyEyebrow,
  getHomeEmptyTitle,
  getHomeLoadErrorTitle,
  getRetryLabel,
  getSectionLabel,
} from "../utils/content";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { Screen } from "../components/Screen";
import { useSection } from "../context/SectionContext";
import type { RootStackParamList } from "../navigation/types";
import { palette, spacing, type } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const { data, error, isLoading, reload } = useHomeData();
  const { activeSection } = useSection();
  const [heroNode, setHeroNode] = useState<number | undefined>(undefined);
  const [firstRailNode, setFirstRailNode] = useState<number | undefined>(
    undefined,
  );

  return (
    <Screen>
      <HomeContent
        activeSection={activeSection}
        data={data}
        error={error}
        firstRailRef={(node) =>
          setFirstRailNode(findNodeHandle(node) ?? undefined)
        }
        heroNextFocusDown={firstRailNode}
        heroRef={(node) => setHeroNode(findNodeHandle(node) ?? undefined)}
        isLoading={isLoading}
        onNavigateToProgram={(section, slug) =>
          navigation.navigate("ProgramDetail", { section, slug })
        }
        onRetry={reload}
        railNextFocusUp={heroNode}
      />
    </Screen>
  );
}

export function HomeContent({
  activeSection,
  data,
  error,
  firstRailRef,
  heroNextFocusDown,
  heroRef,
  isLoading,
  onNavigateToProgram,
  onRetry,
  railNextFocusUp,
}: {
  activeSection: string;
  data: HomeScreenData | null;
  error: string | null;
  firstRailRef: (node: View | null) => void;
  heroNextFocusDown?: number;
  heroRef: (node: View | null) => void;
  isLoading: boolean;
  onNavigateToProgram: (section: "sjon" | "vit", slug: string) => void;
  onRetry: () => void;
  railNextFocusUp?: number;
}) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <View style={styles.messagePanel}>
        <Text style={styles.eyebrow}>{getHomeConnectionIssueLabel()}</Text>
        <Text style={styles.messageTitle}>
          {getHomeLoadErrorTitle()}
        </Text>
        <Text style={styles.messageBody}>{error}</Text>
        <Text onPress={onRetry} style={styles.actionText}>
          {getRetryLabel()}
        </Text>
      </View>
    );
  }

  if (!data || !data.rails.length) {
    return (
      <View style={styles.messagePanel}>
        <Text style={styles.eyebrow}>{getHomeEmptyEyebrow()}</Text>
        <Text style={styles.messageTitle}>
          {getHomeEmptyTitle()}
        </Text>
      </View>
    );
  }

  const sectionData = selectHomeSectionData(
    data,
    activeSection as "sjon" | "vit",
  );

  return (
    <View>
      <HeroBanner
        heroes={sectionData.heroes}
        heroRef={heroRef}
        nextFocusDown={heroNextFocusDown}
        onPress={(hero) => onNavigateToProgram(hero.section, hero.slug)}
      />
      {sectionData.rails.map((rail, index) => (
        <ContentRail
          firstItemRef={index === 0 ? firstRailRef : undefined}
          items={rail.items}
          key={rail.id}
          nextFocusUp={railNextFocusUp}
          onSelectItem={(slug, section) => onNavigateToProgram(section, slug)}
          sectionLabel={getSectionLabel(rail.section)}
          title={rail.title}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  messagePanel: {
    minHeight: 480,
    justifyContent: "center",
    gap: spacing.sm,
  },
  eyebrow: {
    color: palette.accent,
    fontSize: type.body,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  messageTitle: {
    color: palette.text,
    fontSize: type.title,
    fontWeight: "900",
    maxWidth: "58%",
  },
  messageBody: {
    color: palette.textMuted,
    fontSize: type.bodyLarge,
    maxWidth: "58%",
  },
  actionText: {
    color: palette.accent,
    fontSize: type.bodyLarge,
    fontWeight: "800",
  },
});
