/**
 * SectionScreen — the front page for one section: hero banner plus a
 * horizontal row per category.
 *
 * One section per screen, deliberately. The sub-sections that used to be a
 * selector inside this screen are top-level tabs now (Sjón · VIT · MiKS) or a
 * picker of their own (Ljóð), so there is no in-screen chrome above the rows
 * to keep reachable once the user has scrolled.
 */

import { TVScreenScrollView } from "@/components/tv-screen-scroll-view";
import { HeroBanner } from "@/components/HeroBanner";
import { KvfProgramCard } from "@/components/kvf-program-card";
import type { SectionId } from "@/constants/sections";
import strings from "@/constants/strings.json";
import { useKvfResource } from "@/hooks/useKvfResource";
import { frontPageResource } from "@/services/kvfApi";
import type { Category, FrontPage, ProgramCard } from "@/types/kvf";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, TVFocusGuideView, View } from "react-native";

const IS_TV = Platform.isTV;
const CARD_W = IS_TV ? 360 : 220;
const ROW_GAP = IS_TV ? 56 : 32;

function CategoryRow({ category, onPress }: { category: Category; onPress: (p: ProgramCard) => void }) {
  const renderItem = useCallback(({ item, index }: { item: ProgramCard; index: number }) => <KvfProgramCard program={item} onPress={onPress} cardWidth={CARD_W} index={index} />, [onPress]);

  return (
    <TVFocusGuideView autoFocus>
      <Text style={S.categoryTitle}>{category.title}</Text>
      <FlatList
        data={category.programs}
        renderItem={renderItem}
        keyExtractor={(p) => p.listKey}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.rowContent}
        style={S.rowList}
        removeClippedSubviews={false}
        initialNumToRender={6}
      />
    </TVFocusGuideView>
  );
}

export function SectionScreen({ section }: { section: SectionId }) {
  const router = useRouter();

  // Rebuilt each render, but useKvfResource keys off `resource.key` only.
  const resource = useMemo(() => frontPageResource(section), [section]);
  const { data: page, isLoading, isRefreshing, error } = useKvfResource<FrontPage>(resource, strings.common.failedToLoad);

  const featured = useMemo(() => page?.featuredPrograms ?? [], [page]);
  const categories = useMemo(() => page?.categories ?? [], [page]);

  const handleProgramPress = useCallback(
    (program: ProgramCard) => {
      // Carried so the program screen can paint the real title and banner while
      // its own (sometimes very slow) fetch is still running.
      router.push({
        pathname: "/program",
        params: { section, slug: program.slug, title: program.title, thumb: program.thumbnailUrl ?? undefined },
      });
    },
    [router, section],
  );

  return (
    <TVScreenScrollView isRefreshing={isRefreshing}>
      {isLoading && !page ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : error && !page ? (
        <View style={S.center}>
          <Text style={S.errorText}>{error}</Text>
        </View>
      ) : (
        <>
          {featured.length > 0 && <HeroBanner heroes={featured} onPress={handleProgramPress} />}
          <View style={S.categories}>
            {categories.map((cat) => (
              <CategoryRow key={cat.listKey} category={cat} onPress={handleProgramPress} />
            ))}
          </View>
          <View style={S.bottomPad} />
        </>
      )}
    </TVScreenScrollView>
  );
}

// Named "S" not "styles" — prevents editor auto-import from shadowing the local definition.
const S = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0a" },
  errorText: { color: "#FF3B30", fontSize: IS_TV ? 20 : 15, textAlign: "center", padding: 32 },
  categories: { marginTop: IS_TV ? 40 : 24, gap: ROW_GAP },
  categoryTitle: { color: "#FFFFFF", fontSize: IS_TV ? 30 : 16, fontWeight: "600", marginBottom: 2, marginLeft: IS_TV ? 76 : 20, letterSpacing: -0.2 },
  rowList: { overflow: "visible" },
  rowContent: { paddingHorizontal: IS_TV ? 60 : 12 },
  bottomPad: { height: IS_TV ? 240 : 80 },
});
