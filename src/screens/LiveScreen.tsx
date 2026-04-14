import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { FocusableCard } from "../components/FocusableCard";
import { Screen } from "../components/Screen";
import type { LiveChannel, LiveQuality } from "../data/liveChannels";
import { liveChannels } from "../data/liveChannels";
import type { RootStackParamList } from "../navigation/types";
import { palette, spacing, type } from "../theme";
import { getLiveBadgeLabel, getLiveQualityHeading } from "../utils/content";

type Props = NativeStackScreenProps<RootStackParamList, "Live">;

export function LiveScreen({ navigation }: Props) {
  const [selectedChannel, setSelectedChannel] = useState<LiveChannel | null>(
    null,
  );

  function handleChannelPress(channel: LiveChannel) {
    if (channel.qualities.length === 1) {
      playQuality(channel, channel.qualities[0]);
    } else {
      setSelectedChannel(channel);
    }
  }

  function playQuality(channel: LiveChannel, quality: LiveQuality) {
    navigation.navigate("Playback", {
      streamUrl: quality.streamUrl,
      title: `${channel.title}${quality.label !== "Sjálvvirkur" ? ` · ${quality.label}` : ""}`,
    });
  }

  return (
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
              renderItem={({ item: quality, index }) => (
                <Button
                  label={
                    quality.bitrate
                      ? `${quality.label}\n${quality.bitrate}`
                      : quality.label
                  }
                  onPress={() => playQuality(selectedChannel, quality)}
                  size="md"
                />
              )}
              showsHorizontalScrollIndicator={false}
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
