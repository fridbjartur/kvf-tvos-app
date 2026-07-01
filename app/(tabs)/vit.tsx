/**
 * VIT — same layout as Sjón, sourced from /api/vit.
 */

import { HeroBanner } from "@/components/HeroBanner";
import { KvfProgramCard } from "@/components/kvf-program-card";
import { getVitPage } from "@/services/kvfApi";
import type { Category, FrontPage, ProgramCard } from "@/types/kvf";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const IS_TV = Platform.isTV;
const CARD_W = IS_TV ? 360 : 220;
const ROW_GAP = IS_TV ? 56 : 32;

function CategoryRow({ category, onPress }: { category: Category; onPress: (p: ProgramCard) => void }) {
  const noop = useCallback((_p: ProgramCard) => {}, []);

  const renderItem = useCallback(
    ({ item, index }: { item: ProgramCard; index: number }) => <KvfProgramCard program={item} onPress={onPress} onFocus={noop} cardWidth={CARD_W} index={index} />,
    [onPress, noop],
  );

  return (
    <View>
      <Text style={S.categoryTitle}>{category.title}</Text>
      <FlatList
        data={category.programs}
        renderItem={renderItem}
        keyExtractor={(p) => p.slug}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.rowContent}
        style={S.rowList}
        removeClippedSubviews={false}
        initialNumToRender={6}
      />
    </View>
  );
}

export default function VitScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [page, setPage] = useState<FrontPage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getVitPage({
      onData: setPage,
      onLoading: setIsLoading,
      onError: (e) => setError(e instanceof Error ? e.message : "Failed to load"),
    });
  }, []);

  const featured = useMemo(() => page?.featuredPrograms ?? [], [page]);
  const categories = useMemo(() => page?.categories ?? [], [page]);

  const handleProgramPress = useCallback(
    (program: ProgramCard) => {
      router.push({ pathname: "/program", params: { section: "vit", slug: program.slug } });
    },
    [router],
  );

  if (isLoading && !page) {
    return (
      <View style={S.center}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (error && !page) {
    return (
      <View style={S.center}>
        <Text style={S.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={S.container}>
      <ScrollView style={S.scroll} contentContainerStyle={S.scrollContent} showsVerticalScrollIndicator={false} removeClippedSubviews={false}>
        {featured.length > 0 ? <HeroBanner heroes={featured} onPress={handleProgramPress} hasTVPreferredFocus /> : <View style={{ height: insets.top }} />}
        <View style={S.categories}>
          {categories.map((cat) => (
            <CategoryRow key={cat.id ?? cat.title} category={cat} onPress={handleProgramPress} />
          ))}
        </View>
        <View style={S.bottomPad} />
      </ScrollView>
    </View>
  );
}

// Named "S" not "styles" — prevents editor auto-import from shadowing the local definition.
const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  scroll: { flex: 1 },
  scrollContent: {},
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0a" },
  errorText: { color: "#FF3B30", fontSize: IS_TV ? 20 : 15, textAlign: "center", padding: 32 },
  categories: { marginTop: IS_TV ? 40 : 24, gap: ROW_GAP },
  categoryTitle: { color: "#FFFFFF", fontSize: IS_TV ? 26 : 16, fontWeight: "700", marginBottom: 2, marginLeft: IS_TV ? 76 : 20, letterSpacing: -0.2 },
  rowList: { overflow: "visible" },
  rowContent: { paddingHorizontal: IS_TV ? 60 : 12 },
  bottomPad: { height: IS_TV ? 240 : 80 },
});
