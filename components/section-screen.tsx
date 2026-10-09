import { tvSize } from "@/utils/tvLayout";
import { LoadingSpinner } from "@/components/loading-spinner";
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
import { ContinueWatchingRow } from "@/components/continueWatchingRow";
import { HeroBanner } from "@/components/HeroBanner";
import { KvfProgramCard } from "@/components/kvf-program-card";
import { sectionIdFromApiProgramUrl, type SectionId } from "@/constants/sections";
import { FocusableButton } from "@/components/FocusableButton";
import strings from "@/constants/strings.json";
import { useKvfResource } from "@/hooks/useKvfResource";
import { frontPageResource } from "@/services/kvfApi";
import type { Category, FrontPage, ProgramCard } from "@/types/kvf";
import { tvRowScrollProps, tvSnap } from "@/utils/tvScroll";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Platform, StyleSheet, Text, TVFocusGuideView, View } from "react-native";

const IS_TV = Platform.isTV;
const ANDROID_TV = IS_TV && Platform.OS === "android";
const CARD_W = IS_TV ? tvSize(360) : 220;
const ROW_GAP = IS_TV ? tvSize(56) : 32;

function CategoryRow({ category, onPress, focusFirst = false }: { category: Category; onPress: (p: ProgramCard) => void; focusFirst?: boolean }) {
  // Captured at mount: preferred focus applies to the first card once.
  const [focusFirstOnMount] = useState(focusFirst);
  const renderItem = useCallback(
    ({ item, index }: { item: ProgramCard; index: number }) => (
      <KvfProgramCard program={item} onPress={onPress} cardWidth={CARD_W} index={index} hasTVPreferredFocus={focusFirstOnMount && index === 0} />
    ),
    [onPress, focusFirstOnMount],
  );

  return (
    <TVFocusGuideView autoFocus {...tvSnap()} trapFocusLeft={ANDROID_TV} trapFocusRight={ANDROID_TV}>
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
        {...tvRowScrollProps()}
      />
    </TVFocusGuideView>
  );
}

/**
 * `showContinueWatching` adds the viewer's Continue Watching row under the hero (home only).
 * `focusContentOnLoad` focuses the first content once, when it mounts, for screens
 * pushed from a picker; Android TV has no focus engine to choose it.
 */
export function SectionScreen({ section, showContinueWatching = false, focusContentOnLoad = false }: { section: SectionId; showContinueWatching?: boolean; focusContentOnLoad?: boolean }) {
  const router = useRouter();

  // Rebuilt each render, but useKvfResource keys off `resource.key` only.
  const resource = useMemo(() => frontPageResource(section), [section]);
  const { data: page, isLoading, isRefreshing, error, refresh } = useKvfResource<FrontPage>(resource, strings.common.failedToLoad);

  const featured = useMemo(() => page?.featuredPrograms ?? [], [page]);
  const categories = useMemo(() => page?.categories ?? [], [page]);

  const handleProgramPress = useCallback(
    (program: ProgramCard) => {
      // Carried so the program screen can paint the real title and banner while
      // its own (sometimes very slow) fetch is still running.
      router.push({
        pathname: "/program",
        params: { section: sectionIdFromApiProgramUrl(program.apiProgramUrl) ?? section, slug: program.slug, title: program.title, thumb: program.thumbnailUrl ?? undefined },
      });
    },
    [router, section],
  );

  return (
    <TVScreenScrollView isRefreshing={isRefreshing} underNavigation={featured.length > 0}>
      {isLoading && !page ? (
        <View style={S.center}>
          <LoadingSpinner size="large" />
        </View>
      ) : error && !page ? (
        <View style={S.center}>
          <Text style={S.errorText}>{error}</Text>
          <FocusableButton title={strings.player.retryButton} onPress={refresh} hasTVPreferredFocus />
        </View>
      ) : (
        <>
          {featured.length > 0 && <HeroBanner heroes={featured} onPress={handleProgramPress} hasTVPreferredFocus={focusContentOnLoad} />}
          <View style={S.categories}>
            {showContinueWatching && <ContinueWatchingRow />}
            {categories.map((cat, index) => (
              <CategoryRow key={cat.listKey} category={cat} onPress={handleProgramPress} focusFirst={focusContentOnLoad && featured.length === 0 && index === 0} />
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
  errorText: { color: "#FF3B30", fontSize: IS_TV ? tvSize(20) : 15, textAlign: "center", padding: 32 },
  categories: { marginTop: IS_TV ? tvSize(40) : 24, gap: ROW_GAP },
  categoryTitle: { color: "#FFFFFF", fontSize: IS_TV ? tvSize(30) : 16, fontWeight: "600", marginBottom: 2, marginLeft: IS_TV ? tvSize(76) : 20, letterSpacing: -0.2 },
  rowList: { overflow: "visible" },
  rowContent: { paddingHorizontal: IS_TV ? tvSize(60) : 12 },
  bottomPad: { height: IS_TV ? tvSize(240) : 80 },
});
