import { FolderStackEntry } from "@/types/jellyfin";
import { Ionicons } from "@expo/vector-icons";
import { Dimensions, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const IS_TV = Platform.isTV;

interface BreadcrumbProps {
  stack: FolderStackEntry[];
}

function BreadcrumbItem({ entry, isLast }: { entry: FolderStackEntry; isLast: boolean }) {
  return (
    <View style={styles.itemContainer}>
      <Text style={[styles.breadcrumbText, isLast && styles.breadcrumbTextCurrent]} numberOfLines={1}>
        {entry.name}
      </Text>
      {!isLast && <Ionicons name="chevron-forward" size={IS_TV ? 20 : 16} color="#FFC312" style={styles.separator} />}
    </View>
  );
}

export function Breadcrumb({ stack }: BreadcrumbProps) {
  // Show "No Library" when at library selection level
  if (stack.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.rotatedContent}>
          <View style={styles.scrollContent}>
            <Text style={styles.breadcrumbTextPlaceholder}>Home</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.rotatedContent}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {stack.map((entry, index) => (
            <BreadcrumbItem key={entry.id} entry={entry} isLast={index === stack.length - 1} />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 44,
    backgroundColor: "#F39D120C",
    overflow: "hidden",
  },
  rotatedContent: {
    width: SCREEN_HEIGHT,
    height: 44,
    transform: [{ rotate: "-90deg" }, { translateX: -(SCREEN_HEIGHT / 2) + 22 }, { translateY: -(SCREEN_HEIGHT / 2) + 22 }],
  },
  scrollContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: IS_TV ? 40 : 20,
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  breadcrumbText: {
    color: "#4CD964",
    fontSize: IS_TV ? 24 : 16,
    lineHeight: IS_TV ? 24 : 16,
    fontWeight: "600",
    // Cap each level label so one long folder name can't hog the bar; longer names
    // truncate with an ellipsis (numberOfLines=1) so more depth stays visible.
    maxWidth: 200,
  },
  breadcrumbTextCurrent: {
    color: "#FFFFFF",
  },
  breadcrumbTextPlaceholder: {
    color: "#98989D",
    fontSize: IS_TV ? 24 : 16,
    lineHeight: IS_TV ? 24 : 16,
    fontWeight: "600",
  },
  separator: {
    marginHorizontal: IS_TV ? 8 : 4,
  },
});
