import strings from "@/constants/strings.json";
/**
 * Program detail screen.
 *
 * Layout:
 *   • Fixed-height banner image at top (fades into dark background via gradient)
 *   • Scrollable content below: title, description, play button, episode row
 *
 * No full-screen backdrop — just banner + dark bg.
 * Episode cards have Animated.spring scale on focus.
 */

import { FocusableButton } from "@/components/FocusableButton";
import { MarqueeText } from "@/components/MarqueeText";
import { usePlayQueue } from "@/contexts/PlayQueueContext";
import { getEpisode, getProgram, prefetchEpisode } from "@/services/kvfApi";
import type { Episode, ProgramPage, QueueEpisode, Section } from "@/types/kvf";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, BackHandler, Dimensions, FlatList, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useTVEventHandler } from "react-native";
import { DESIGN } from "@/constants/app";

const IS_TV = Platform.isTV;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const BANNER_H = IS_TV ? Math.round(SCREEN_H * 0.58) : Math.round(SCREEN_H * 0.42);
const EPISODE_CARD_W = IS_TV ? 320 : 200;
const SPRING = { tension: 220, friction: 22, useNativeDriver: true };

// ── Animated episode card ──────────────────────────────────────────────────────

interface EpisodeCardProps {
  episode: Episode;
  isActive: boolean;
  onPress: (episode: Episode) => void;
  onFocus: (episode: Episode) => void;
  hasTVPreferredFocus?: boolean;
}

function EpisodeCard({ episode, isActive, onPress, onFocus, hasTVPreferredFocus }: EpisodeCardProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const borderOpacity = useRef(new Animated.Value(isActive ? 0.5 : 0)).current;

  const handleFocus = useCallback(() => {
    Animated.spring(scale, { toValue: 1.08, ...SPRING }).start();
    Animated.spring(borderOpacity, { toValue: 1, ...SPRING }).start();
    onFocus(episode);
  }, [scale, borderOpacity, onFocus, episode]);

  const handleBlur = useCallback(() => {
    Animated.spring(scale, { toValue: 1, ...SPRING }).start();
    Animated.spring(borderOpacity, { toValue: isActive ? 0.5 : 0, ...SPRING }).start();
  }, [scale, borderOpacity, isActive]);

  const handlePress = useCallback(() => onPress(episode), [onPress, episode]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      activeOpacity={0.9}
      isTVSelectable
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={styles.epOuter}
      accessibilityLabel={episode.title}
      accessibilityRole="button">
      <Animated.View style={[styles.epCard, { transform: [{ scale }] }]}>
        {episode.thumbnailUrl ? (
          <Image source={{ uri: episode.thumbnailUrl, cacheKey: `ep-${episode.sid}` }} style={styles.epImage} contentFit="cover" transition={0} cachePolicy="memory-disk" />
        ) : (
          <View style={styles.epImagePlaceholder} />
        )}

        {isActive && (
          <View style={styles.nowPlayingBadge}>
            <Text style={styles.nowPlayingText}>▶</Text>
          </View>
        )}

        <Animated.View style={[styles.epBorder, { opacity: borderOpacity }]} pointerEvents="none" />
      </Animated.View>

      <Text style={styles.epTitle} numberOfLines={2}>
        {episode.title}
      </Text>
      {episode.publishDate ? <Text style={styles.epDate}>{episode.publishDate}</Text> : null}
    </TouchableOpacity>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function ProgramScreen() {
  const { section, slug } = useLocalSearchParams<{ section: string; slug: string }>();
  const router = useRouter();
  const { setQueue } = usePlayQueue();

  const [programPage, setProgramPage] = useState<ProgramPage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedEpisode, setFocusedEpisode] = useState<Episode | null>(null);
  const [isResolvingStream, setIsResolvingStream] = useState(false);

  const safeSection = (section === "vit" ? "vit" : "sjon") as Section;

  useEffect(() => {
    if (!slug) return;
    getProgram(safeSection, slug, {
      onData: (p) => {
        setProgramPage(p);
        const current = p.currentEpisodeSid ? (p.episodes.find((e) => e.sid === p.currentEpisodeSid) ?? p.episodes[0]) : p.episodes[0];
        setFocusedEpisode(current ?? null);
      },
      onLoading: setIsLoading,
      onError: (e) => setError(e instanceof Error ? e.message : strings.program.failedToLoad),
    });
  }, [safeSection, slug]);

  // Prefetch focused episode in background
  useEffect(() => {
    if (!focusedEpisode || !slug) return;
    prefetchEpisode(safeSection, slug, focusedEpisode.sid);
  }, [focusedEpisode, safeSection, slug]);

  const handleEpisodePress = useCallback(
    async (episode: Episode) => {
      if (!programPage || !slug) return;
      setIsResolvingStream(true);

      const queue: QueueEpisode[] = programPage.episodes.map((e) => ({
        sid: e.sid,
        slug: e.slug,
        title: e.title,
        section: safeSection,
        thumbnailUrl: e.thumbnailUrl,
      }));
      const startIdx = programPage.episodes.findIndex((e) => e.sid === episode.sid);
      setQueue(queue, startIdx >= 0 ? startIdx : 0);

      getEpisode(safeSection, slug, episode.sid, {
        onData: (detail) => {
          setIsResolvingStream(false);
          if (!detail.streamUrl) {
            setError(strings.program.errorNoStream);
            return;
          }
          router.push({
            pathname: "/player",
            params: {
              streamUrl: detail.streamUrl,
              title: episode.title,
              section: safeSection,
              programSlug: slug,
              episodeSid: episode.sid,
            },
          });
        },
        onError: () => {
          setIsResolvingStream(false);
          setError(strings.program.errorLoadEpisode);
        },
      });
    },
    [programPage, safeSection, slug, setQueue, router],
  );

  const handlePlayCurrentPress = useCallback(() => {
    if (!programPage) return;
    const ep = programPage.episodes.find((e) => e.sid === programPage.currentEpisodeSid) ?? programPage.episodes[0];
    if (ep) handleEpisodePress(ep);
  }, [programPage, handleEpisodePress]);

  const handleBack = useCallback(() => router.back(), [router]);

  useTVEventHandler(
    useCallback(
      (evt: { eventType: string }) => {
        if (evt.eventType === "menu") handleBack();
      },
      [handleBack],
    ),
  );

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [handleBack]);

  const activeEpSid = programPage?.currentEpisodeSid ?? programPage?.episodes[0]?.sid ?? null;

  const renderEpisode = useCallback(
    ({ item, index }: { item: Episode; index: number }) => (
      <EpisodeCard
        episode={item}
        isActive={item.sid === activeEpSid}
        onPress={handleEpisodePress}
        onFocus={setFocusedEpisode}
        hasTVPreferredFocus={item.sid === activeEpSid || (index === 0 && !activeEpSid)}
      />
    ),
    [activeEpSid, handleEpisodePress],
  );

  if (isLoading && !programPage) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (error && !programPage) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <FocusableButton title={strings.program.goBack} onPress={handleBack} variant="secondary" hasTVPreferredFocus />
      </View>
    );
  }

  const program = programPage?.program;
  const episodes = programPage?.episodes ?? [];

  return (
    <View style={styles.container}>
      {/* Banner: fixed-height image + gradient fade at bottom */}
      <View style={styles.bannerContainer} pointerEvents="none">
        {program?.thumbnailUrl ? (
          <Image source={{ uri: program.thumbnailUrl, cacheKey: `prog-banner-${program.slug}` }} style={styles.bannerImage} contentFit="cover" transition={300} cachePolicy="memory-disk" />
        ) : (
          <View style={styles.bannerPlaceholder} />
        )}
        {/* Bottom gradient: banner fades to background */}
        <LinearGradient colors={["transparent", "rgba(10,10,10,0.7)", "#0a0a0a"]} locations={[0.3, 0.7, 1]} style={styles.bannerGradient} />
        {/* Left side vignette */}
        <LinearGradient colors={["rgba(10,10,10,0.4)", "transparent"]} start={{ x: 0, y: 0.5 }} end={{ x: 0.5, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </View>

      {/* Scrollable content overlapping the banner from below */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Spacer: pushes content below the opaque portion of the banner */}
        <View style={{ height: BANNER_H - (IS_TV ? 180 : 100) }} />

        {/* Program info */}
        <View style={styles.info}>
          <Text style={styles.programTitle}>{program?.title ?? ""}</Text>
          {program?.description ? (
            <Text style={styles.programDescription} numberOfLines={IS_TV ? 3 : 4}>
              {program.description}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <FocusableButton title={isResolvingStream ? strings.program.loadingButton : strings.program.playButton} onPress={handlePlayCurrentPress} variant="primary" hasTVPreferredFocus={false} />
          </View>
        </View>

        {/* Episodes */}
        {episodes.length > 0 && (
          <View style={styles.episodesSection}>
            <Text style={styles.episodesHeading}>{strings.program.episodesHeading}</Text>
            <FlatList
              data={episodes}
              renderItem={renderEpisode}
              keyExtractor={(e) => e.sid}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.episodesRow}
              removeClippedSubviews={false}
              initialNumToRender={8}
            />
          </View>
        )}

        {/* Focused episode preview */}
        {focusedEpisode && (
          <BlurView intensity={40} tint="dark" style={styles.epInfo}>
            <Text style={styles.epInfoTitle} numberOfLines={2}>
              {focusedEpisode.title}
            </Text>
            {focusedEpisode.publishDate ? <Text style={styles.epInfoDate}>{focusedEpisode.publishDate}</Text> : null}
          </BlurView>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20, backgroundColor: "#0a0a0a" },
  errorText: { color: "#FF3B30", fontSize: IS_TV ? 20 : 15, textAlign: "center", padding: 32 },

  // Banner
  bannerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: BANNER_H,
  },
  bannerImage: { width: "100%", height: "100%" },
  bannerPlaceholder: { width: "100%", height: "100%", backgroundColor: "#1a1a1a" },
  bannerGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: BANNER_H * 0.65,
  },

  // Scrollable content
  scroll: { flex: 1 },
  scrollContent: {},
  info: {
    paddingHorizontal: IS_TV ? 80 : 24,
    paddingBottom: IS_TV ? 32 : 20,
    maxWidth: IS_TV ? 820 : undefined,
  },
  programTitle: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 48 : 26,
    fontWeight: "800",
    marginBottom: IS_TV ? 12 : 8,
    letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  programDescription: {
    color: "rgba(255,255,255,0.78)",
    fontSize: IS_TV ? 18 : 13,
    lineHeight: IS_TV ? 27 : 19,
    marginBottom: IS_TV ? 28 : 18,
    maxWidth: IS_TV ? 700 : undefined,
  },
  actions: { flexDirection: "row", gap: IS_TV ? 20 : 12 },

  // Episodes
  episodesSection: { marginBottom: IS_TV ? 24 : 14 },
  episodesHeading: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 24 : 16,
    fontWeight: "700",
    marginLeft: IS_TV ? 80 : 24,
    marginBottom: IS_TV ? 4 : 4,
    letterSpacing: -0.2,
  },
  episodesRow: { paddingHorizontal: IS_TV ? 64 : 12 },

  // Episode card
  epOuter: {
    width: EPISODE_CARD_W + (IS_TV ? 32 : 20),
    paddingHorizontal: IS_TV ? 16 : 10,
    paddingVertical: IS_TV ? 18 : 12,
  },
  epCard: {
    width: EPISODE_CARD_W,
    aspectRatio: 16 / 9,
    backgroundColor: "#2C2C2E",
    marginBottom: IS_TV ? 14 : 6,
    borderRadius: DESIGN.BORDER_RADIUS_SMALL,
    overflow: "hidden",
  },
  epImage: { width: "100%", height: "100%" },
  epImagePlaceholder: { width: "100%", height: "100%", backgroundColor: "#2C2C2E" },
  nowPlayingBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: DESIGN.BORDER_RADIUS_SMALL,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  nowPlayingText: { color: "#000", fontSize: IS_TV ? 13 : 10, fontWeight: "700" },
  epBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    borderRadius: DESIGN.BORDER_RADIUS_SMALL,
  },
  epTitle: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 16 : 11,
    fontWeight: "600",
    lineHeight: IS_TV ? 22 : 15,
  },
  epDate: { color: "#98989D", fontSize: IS_TV ? 14 : 10, marginTop: 2 },

  // Focused episode info bar
  epInfo: {
    marginHorizontal: IS_TV ? 80 : 24,
    marginTop: IS_TV ? 4 : 2,
    padding: IS_TV ? 16 : 10,
    overflow: "hidden",
  },
  epInfoTitle: { color: "#FFFFFF", fontSize: IS_TV ? 20 : 14, fontWeight: "600" },
  epInfoDate: { color: "#98989D", fontSize: IS_TV ? 15 : 11, marginTop: 4 },

  bottomPad: { height: IS_TV ? 240 : 80 },
});
