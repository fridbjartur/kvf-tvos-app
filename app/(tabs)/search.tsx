/**
 * Sendingar — searchable list of all KVF programs.
 *
 * On tvOS:  native TvosSearchView (expo-tvos-search) — system keyboard + spotlight UI.
 * On iOS:   React Native TextInput fallback with the same grid layout.
 */

import { KvfProgramCard } from "@/components/kvf-program-card";
import { getAllPrograms } from "@/services/kvfApi";
import type { ProgramCard } from "@/types/kvf";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { isNativeSearchAvailable, SearchResult, TvosSearchView } from "expo-tvos-search";
import strings from "@/constants/strings.json";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, TextInput, View } from "react-native";

const IS_TV = Platform.isTV;
const NUM_COLS = IS_TV ? 4 : 2;
const CARD_W = IS_TV ? 360 : 170;

// ── Shared data hook ──────────────────────────────────────────────────────────

function useAllPrograms() {
  const [programs, setPrograms] = useState<ProgramCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAllPrograms()
      .then(setPrograms)
      .catch((e) => setError(e instanceof Error ? e.message : strings.search.failedToLoad))
      .finally(() => setIsLoading(false));
  }, []);

  return { programs, isLoading, error };
}

// ── Native tvOS search (TvosSearchView) ───────────────────────────────────────

function NativeSearchScreen() {
  const router = useRouter();
  const { programs, isLoading } = useAllPrograms();

  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Map all programs to SearchResult once loaded, so the initial state shows everything
  useEffect(() => {
    if (programs.length > 0) {
      setResults(
        programs.map((p) => ({
          id: p.slug,
          title: p.title,
          imageUrl: p.thumbnailUrl ?? undefined,
        })),
      );
    }
  }, [programs]);

  const handleSearch = useCallback(
    (event: { nativeEvent: { query: string } }) => {
      const q = event.nativeEvent.query.trim().toLowerCase();
      setIsSearching(true);

      const filtered = q ? programs.filter((p) => p.title.toLowerCase().includes(q)) : programs;

      setResults(
        filtered.map((p) => ({
          id: p.slug,
          title: p.title,
          imageUrl: p.thumbnailUrl ?? undefined,
        })),
      );
      setIsSearching(false);
    },
    [programs],
  );

  const handleSelectItem = useCallback(
    (event: { nativeEvent: { id: string } }) => {
      const slug = event.nativeEvent.id;
      const program = programs.find((p) => p.slug === slug);
      const section = program?.path?.includes("/vit/") ? "vit" : "sjon";
      router.push({ pathname: "/program", params: { section, slug } });
    },
    [programs, router],
  );

  if (isLoading) {
    return (
      <View style={S.center}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <TvosSearchView
      results={results}
      columns={5}
      placeholder={strings.search.placeholder}
      emptyStateText={strings.search.emptyNative}
      isLoading={isSearching}
      topInset={140}
      colorScheme="dark"
      overlayTitleSize={30}
      onSearch={handleSearch}
      onSelectItem={handleSelectItem}
      style={S.nativeSearch}
    />
  );
}

// ── React Native fallback (iOS / simulator) ───────────────────────────────────

const SearchHeader = React.memo(function SearchHeader({ onChangeText, inputRef }: { onChangeText: (t: string) => void; inputRef: React.RefObject<TextInput> }) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={S.searchContainer}>
      <View style={[S.searchInputWrapper, focused && S.searchInputWrapperFocused]}>
        <TextInput
          ref={inputRef}
          placeholder={strings.search.placeholder}
          placeholderTextColor="#8E8E93"
          autoCorrect={false}
          autoCapitalize="none"
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={S.searchInput}
          multiline={false}
          numberOfLines={1}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
    </View>
  );
});

function ReactNativeSearchScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const { programs, isLoading, error } = useAllPrograms();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return q ? programs.filter((p) => p.title.toLowerCase().includes(q)) : programs;
  }, [searchQuery, programs]);

  const handlePress = useCallback(
    (program: ProgramCard) => {
      const section = program.path?.includes("/vit/") ? "vit" : "sjon";
      router.push({ pathname: "/program", params: { section, slug: program.slug } });
    },
    [router],
  );

  const renderItem = useCallback(({ item }: { item: ProgramCard }) => <KvfProgramCard program={item} onPress={handlePress} cardWidth={CARD_W} />, [handlePress]);

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return (
        <View style={S.centerContainer}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={S.loadingText}>{strings.search.loading}</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={S.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
          <Text style={S.errorTitle}>{strings.search.errorTitle}</Text>
          <Text style={S.errorText}>{error}</Text>
        </View>
      );
    }
    if (searchQuery.trim()) {
      return (
        <View style={S.centerContainer}>
          <Ionicons name="search-outline" size={64} color="#98989D" />
          <Text style={S.emptyText}>
            {strings.search.emptyAfterQuery} &ldquo;{searchQuery}&rdquo;
          </Text>
        </View>
      );
    }
    return (
      <View style={S.centerContainer}>
        <Ionicons name="tv-outline" size={64} color="#98989D" />
        <Text style={S.emptyText}>{strings.search.emptyInitial}</Text>
      </View>
    );
  }, [isLoading, error, searchQuery]);

  return (
    <View style={S.container}>
      <SearchHeader onChangeText={setSearchQuery} inputRef={inputRef} />
      {filtered.length > 0 ? (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(p) => p.slug}
          numColumns={NUM_COLS}
          key={NUM_COLS}
          contentContainerStyle={S.gridContent}
          columnWrapperStyle={S.columnWrapper}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          keyboardDismissMode="on-drag"
          ListFooterComponent={
            filtered.length > 0 ? (
              <Text style={S.resultsLabel}>
                {filtered.length} {filtered.length === 1 ? strings.search.resultSingular : strings.search.resultPlural}
              </Text>
            ) : null
          }
        />
      ) : (
        <View style={S.emptyContainer}>{renderEmpty()}</View>
      )}
    </View>
  );
}

// ── Entry point ───────────────────────────────────────────────────────────────

export default function SearchScreen() {
  if (isNativeSearchAvailable()) {
    return <NativeSearchScreen />;
  }
  return <ReactNativeSearchScreen />;
}

// Named "S" not "styles" — prevents editor auto-import from shadowing the local definition.
const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  nativeSearch: { flex: 1, backgroundColor: "#141414" },
  emptyContainer: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0a" },
  searchContainer: {
    paddingTop: IS_TV ? 140 : 60,
    paddingHorizontal: IS_TV ? 80 : 16,
    paddingBottom: IS_TV ? 24 : 16,
    alignItems: "center",
  },
  searchInputWrapper: {
    width: "100%",
    maxWidth: 800,
    borderRadius: IS_TV ? 28 : 25,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#3A3A3C",
  },
  searchInputWrapperFocused: {
    borderColor: "#FFFFFF",
  },
  searchInput: {
    width: "100%",
    minHeight: IS_TV ? 56 : 50,
    backgroundColor: "#2C2C2E",
    paddingHorizontal: IS_TV ? 28 : 20,
    fontSize: IS_TV ? 28 : 20,
    color: "#FFFFFF",
  },
  gridContent: {
    paddingBottom: IS_TV ? 120 : 80,
    paddingHorizontal: IS_TV ? 40 : 8,
  },
  columnWrapper: {
    justifyContent: "flex-start",
    paddingVertical: IS_TV ? 8 : 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    gap: IS_TV ? 16 : 12,
  },
  loadingText: { fontSize: IS_TV ? 20 : 16, color: "#98989D", fontWeight: "500" },
  errorTitle: { fontSize: IS_TV ? 24 : 20, fontWeight: "700", color: "#FFFFFF" },
  errorText: { fontSize: IS_TV ? 18 : 15, color: "#98989D", textAlign: "center", lineHeight: 24 },
  emptyText: { fontSize: IS_TV ? 20 : 16, color: "#98989D", textAlign: "center" },
  resultsLabel: { fontSize: IS_TV ? 16 : 13, color: "#98989D", textAlign: "center", paddingVertical: IS_TV ? 16 : 10 },
});
