import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { selectHomeSectionData } from "../api/mappers";
import type { HomeScreenData } from "../api/types";
import { useHomeData } from "../hooks/useHomeData";
import { HeroBanner } from "../components/HeroBanner";
import { Button } from "../components/Button";
import { ContentRail } from "../components/ContentRail";
import type { RailCard } from "../components/ContentRail";
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

  return (
    <Screen>
      <HomeContent
        activeSection={activeSection}
        data={data}
        error={error}
        isLoading={isLoading}
        onNavigateToProgram={(section, slug) =>
          navigation.navigate("ProgramDetail", { section, slug })
        }
        onRetry={reload}
      />
    </Screen>
  );
}

export function HomeContent({
  activeSection,
  data,
  error,
  isLoading,
  onNavigateToProgram,
  onRetry,
}: {
  activeSection: string;
  data: HomeScreenData | null;
  error: string | null;
  isLoading: boolean;
  onNavigateToProgram: (section: "sjon" | "vit", slug: string) => void;
  onRetry: () => void;
}) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <View style={styles.messagePanel}>
        <Text style={styles.eyebrow}>{getHomeConnectionIssueLabel()}</Text>
        <Text style={styles.messageTitle}>{getHomeLoadErrorTitle()}</Text>
        <Text style={styles.messageBody}>{error}</Text>
        <Button label={getRetryLabel()} onPress={onRetry} size="md" />
      </View>
    );
  }

  if (!data || !data.rails.length) {
    return (
      <View style={styles.messagePanel}>
        <Text style={styles.eyebrow}>{getHomeEmptyEyebrow()}</Text>
        <Text style={styles.messageTitle}>{getHomeEmptyTitle()}</Text>
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
        onPress={(hero) => onNavigateToProgram(hero.section, hero.slug)}
      />
      {sectionData.rails.map((rail) => {
        const cards: RailCard[] = rail.items.map((item) => ({
          id: item.id,
          title: item.title,
          imageUrl: item.imageUrl,
          badge: item.badge,
          disabled: !item.canOpenProgram,
          onPress: item.canOpenProgram
            ? () => onNavigateToProgram(item.section, item.slug)
            : undefined,
        }));

        return (
          <ContentRail
            cards={cards}
            key={rail.id}
            sectionLabel={getSectionLabel(rail.section)}
            title={rail.title}
          />
        );
      })}
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
});
