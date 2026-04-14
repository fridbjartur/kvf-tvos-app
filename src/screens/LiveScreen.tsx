import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { FocusableCard } from "../components/FocusableCard";
import {
  FullscreenVideoPlayer,
  type PlaybackRequest,
} from "../components/FullscreenVideoPlayer";
import { Screen } from "../components/Screen";
import type { LiveChannel, LiveQuality } from "../data/liveChannels";
import { liveChannels } from "../data/liveChannels";
import type { RootStackParamList } from "../navigation/types";
import { palette, spacing, type } from "../theme";
import { getLiveBadgeLabel, getLiveQualityHeading } from "../utils/content";

type Props = NativeStackScreenProps<RootStackParamList, "Live">;

export function LiveScreen({}: Props) {
  const [selectedChannel, setSelectedChannel] = useState<LiveChannel | null>(
    null,
  );
  const [playback, setPlayback] = useState<PlaybackRequest | null>(null);

  function handleChannelPress(channel: LiveChannel) {
    if (channel.qualities.length === 1) {
      playQuality(channel.qualities[0]);
    } else {
      setSelectedChannel(channel);
    }
  }

  function playQuality(quality: LiveQuality) {
    setPlayback({
      streamUrl: quality.streamUrl,
      kind: "stream",
    });
  }

  return (
    <View style={styles.screen}>
      <Screen>
        <View style={styles.container}>
          <FlatList
            contentContainerStyle={styles.channelRow}
            data={liveChannels}
            horizontal
            keyExtractor={(c) => c.id}
            renderItem={({ item: channel }) => (
              <FocusableCard
                badge={getLiveBadgeLabel()}
                imageUrl={null}
                onPress={() => handleChannelPress(channel)}
                title={channel.title}
              />
            )}
            showsHorizontalScrollIndicator={false}
          />

          {selectedChannel ? (
            <View style={styles.qualitySection}>
              <Text style={styles.qualityHeading}>
                {selectedChannel.title} · {getLiveQualityHeading()}
              </Text>
              <FlatList
                contentContainerStyle={styles.qualityRow}
                data={selectedChannel.qualities}
                horizontal
                keyExtractor={(q) => q.id}
                renderItem={({ item: quality }) => (
                  <Button
                    label={
                      quality.bitrate
                        ? `${quality.label}\n${quality.bitrate}`
                        : quality.label
                    }
                    onPress={() => playQuality(quality)}
                    size="md"
                  />
                )}
                showsHorizontalScrollIndicator={false}
              />
            </View>
          ) : null}
        </View>
      </Screen>
      {playback ? (
        <FullscreenVideoPlayer
          playback={playback}
          onClose={() => setPlayback(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    gap: spacing.xl,
    paddingTop: spacing.lg,
  },
  channelRow: {
    gap: spacing.xl,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  qualitySection: {
    gap: spacing.md,
  },
  qualityHeading: {
    color: palette.text,
    fontSize: type.title,
    fontWeight: "900",
    paddingHorizontal: spacing.sm,
  },
  qualityRow: {
    gap: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
});
