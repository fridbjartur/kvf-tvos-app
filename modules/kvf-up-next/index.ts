import { NativeModule, requireOptionalNativeModule } from "expo-modules-core";

type UpNextEvents = {
  onSelect: () => void;
};

declare class KvfUpNextModule extends NativeModule<UpNextEvents> {
  /** Adds the button to the player's transport bar. Resolves false when no native player controller is on screen. */
  show(title: string): Promise<boolean>;
  hide(): Promise<void>;
}

/** Null outside native tvOS builds (tests, Expo Go, Android). */
export default requireOptionalNativeModule<KvfUpNextModule>("KvfUpNext");
