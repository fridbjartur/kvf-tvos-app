/**
 * Where watch history is persisted, per platform.
 *
 * tvOS gives apps no persistent file storage: Documents is not writable, and
 * the Caches directory (which kvfCache uses) may be purged whenever the app is
 * not running. That is fine for a catalog that can be fetched again, but not
 * for what the viewer has watched. NSUserDefaults is the one store tvOS keeps,
 * so on Apple platforms the history is a single JSON string there, through
 * React Native's `Settings`. tvOS caps NSUserDefaults at 500 KB per app; the
 * service keeps the history far below that (see MAX_EPISODES / MAX_PROGRAMS).
 *
 * `Settings` reads are synchronous — React Native snapshots the defaults at
 * startup — so the Continue Watching row can render on its first frame.
 *
 * `Settings` does not exist on Android, so there the history is a JSON file in
 * the document directory, written atomically.
 */

import * as FileSystem from "expo-file-system/legacy";
import { Platform, Settings } from "react-native";

export interface WatchProgressStorage {
  /** The stored JSON, or null. Synchronous where the platform allows it. */
  load(): string | null | Promise<string | null>;
  save(raw: string): Promise<void>;
  clear(): Promise<void>;
}

const SETTINGS_KEY = "kvf_watch_progress";

const userDefaultsStorage: WatchProgressStorage = {
  load() {
    const raw: unknown = Settings.get(SETTINGS_KEY);
    return typeof raw === "string" ? raw : null;
  },
  async save(raw) {
    Settings.set({ [SETTINGS_KEY]: raw });
  },
  async clear() {
    // A null value removes the key from NSUserDefaults.
    Settings.set({ [SETTINGS_KEY]: null });
  },
};

const FILE_PATH = `${FileSystem.documentDirectory ?? ""}watch_progress.json`;
const TMP_PATH = `${FILE_PATH}.tmp`;

const fileStorage: WatchProgressStorage = {
  async load() {
    const info = await FileSystem.getInfoAsync(FILE_PATH);
    return info.exists ? FileSystem.readAsStringAsync(FILE_PATH) : null;
  },
  async save(raw) {
    // Write then rename, so a crash mid-write can never leave a torn file.
    await FileSystem.writeAsStringAsync(TMP_PATH, raw);
    await FileSystem.moveAsync({ from: TMP_PATH, to: FILE_PATH });
  },
  async clear() {
    await FileSystem.deleteAsync(FILE_PATH, { idempotent: true });
  },
};

export const watchProgressStorage: WatchProgressStorage = Platform.OS === "ios" ? userDefaultsStorage : fileStorage;
