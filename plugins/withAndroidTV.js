/* global __dirname */
const { withBaseMod, withDangerousMod, AndroidConfig } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function networkSecurityConfig(apiUrl) {
  const domains = new Set(["netvarp.kringvarp.fo"]);
  const api = new URL(apiUrl || "http://192.168.1.10:3939");
  if (api.protocol === "http:") domains.add(api.hostname);
  const entries = [...domains].map((host) => `    <domain includeSubdomains="false">${host.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</domain>`).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
${entries}
  </domain-config>
</network-security-config>
`;
}

/** Copies the plugin's Android resources (e.g. the TV player controls) into the app module. */
function copyResources(source, destination) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copyResources(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function configureManifest(manifest) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  application.$["android:banner"] = "@drawable/tv_banner";
  application.$["android:networkSecurityConfig"] = "@xml/network_security_config";
  const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
  activity.$["android:screenOrientation"] = "landscape";
  return manifest;
}

function withAndroidTV(config) {
  config = withBaseMod(config, {
    platform: "android",
    mod: "manifest",
    // Run after the TV and default orientation mods, which remove orientation.
    async action({ modRequest: { nextMod, ...modRequest }, ...config }) {
      const result = await nextMod({ ...config, modRequest });
      result.modResults = configureManifest(result.modResults);
      return result;
    },
  });
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const resources = path.join(config.modRequest.platformProjectRoot, "app/src/main/res");
      fs.mkdirSync(path.join(resources, "xml"), { recursive: true });
      fs.mkdirSync(path.join(resources, "drawable"), { recursive: true });
      fs.writeFileSync(path.join(resources, "xml/network_security_config.xml"), networkSecurityConfig(process.env.EXPO_PUBLIC_KVF_API_BASE_URL));
      fs.copyFileSync(path.join(config.modRequest.projectRoot, "assets/images/android-tv-banner.xml"), path.join(resources, "drawable/tv_banner.xml"));
      // App resources override Media3's, replacing its phone controls with TV controls.
      copyResources(path.join(__dirname, "android-tv-res"), resources);
      return config;
    },
  ]);
}

module.exports = withAndroidTV;
module.exports.networkSecurityConfig = networkSecurityConfig;
module.exports.configureManifest = configureManifest;
module.exports.copyResources = copyResources;
