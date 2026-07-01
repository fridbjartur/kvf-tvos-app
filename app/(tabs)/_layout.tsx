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
        <Icon sf="play.rectangle.fill" />
        <Label>{strings.tabs.vit}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <Icon sf="magnifyingglass" />
        <Label>{strings.tabs.search}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="live">
        <Icon sf="antenna.radiowaves.left.and.right" />
        <Label>{strings.tabs.live}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <Icon sf="gearshape.fill" />
        <Label>{strings.tabs.settings}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
