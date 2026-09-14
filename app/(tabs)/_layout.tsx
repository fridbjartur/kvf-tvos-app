import { Platform } from "react-native";
import strings from "@/constants/strings.json";
import { NativeTabs } from "expo-router/unstable-native-tabs";

const { Icon, Label } = NativeTabs.Trigger;

export default function TabLayout() {
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
