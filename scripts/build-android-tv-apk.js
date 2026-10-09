/* global __dirname */
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(os.homedir(), process.platform === "darwin" ? "Library/Android/sdk" : "Android/Sdk");
if (!fs.existsSync(sdk)) throw new Error("Install the Android SDK and set ANDROID_HOME before building. See docs/android-tv.md.");
const env = { ...process.env, ANDROID_HOME: sdk, EXPO_TV: "1", CI: "1", NODE_ENV: "production" };

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

// Regenerate Android only. Build customizations belong in config plugins.
run("yarn", ["expo", "prebuild", "--platform", "android", "--clean", "--no-install"]);
run("./gradlew", ["assembleRelease", "--no-daemon"], path.join(root, "android"));
const output = path.join(root, "dist", "kvf-android-tv.apk");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.copyFileSync(path.join(root, "android/app/build/outputs/apk/release/app-release.apk"), output);
console.log(`Tester APK (development signing): ${output}`);
