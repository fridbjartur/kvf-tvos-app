import { Platform } from "react-native";
import strings from "@/constants/strings.json";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Tabs } from "expo-router";
import { AndroidTVTabBar } from "@/components/android-tv-tab-bar";
import { AndroidTVNavigationContext, createAndroidTVNavigation } from "@/contexts/AndroidTVNavigationContext";
import { useState } from "react";

const { Icon, Label } = NativeTabs.Trigger;

/**
 * Tabs never form a history: Back from content returns to the tab bar, and Back
 * at the tab bar leaves the app, as Menu does at tvOS's tab bar.
 */
function AndroidTVTabs() {
  const [navigation] = useState(createAndroidTVNavigation);
  return (
    <AndroidTVNavigationContext value={navigation}>
      <Tabs backBehavior="none" detachInactiveScreens screenOptions={{ headerShown: false, tabBarPosition: "top", animation: "fade" }} tabBar={(props) => <AndroidTVTabBar {...props} />}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="vit" />
        <Tabs.Screen name="miks" />
        <Tabs.Screen name="ljod" />
        <Tabs.Screen name="schedule" />
        <Tabs.Screen name="search" />
      </Tabs>
    </AndroidTVNavigationContext>
  );
}

export default function TabLayout() {
  if (Platform.OS === "android" && Platform.isTV) return <AndroidTVTabs />;
  return (
    <NativeTabs blurEffect="systemChromeMaterial">
      <NativeTabs.Trigger name="index">
        <Icon sf="tv.fill" />
        <Label>{strings.tabs.sjon}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="vit">
        <Icon sf="figure.2.and.child.holdinghands" />
        <Label>{strings.tabs.vit}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="miks">
        <Icon sf="sparkles.tv.fill" />
        <Label>{strings.tabs.miks}</Label>
      </NativeTabs.Trigger>

      {/* Returning focus to the TV tab bar must not dismiss a radio category. */}
      <NativeTabs.Trigger name="ljod" disablePopToTop={Platform.isTV} disableScrollToTop={Platform.isTV}>
        <Icon sf="radio.fill" />
        <Label>{strings.tabs.ljod}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="schedule">
        <Icon sf="antenna.radiowaves.left.and.right" />
        <Label>{strings.tabs.live}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <Icon sf="magnifyingglass" />
        <Label>{strings.tabs.search}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
