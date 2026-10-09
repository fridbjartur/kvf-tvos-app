/* global __dirname */
const { it, expect } = require("@jest/globals");
const { configureManifest, networkSecurityConfig } = require("../withAndroidTV");
const withAndroidTV = require("../withAndroidTV");

it("permits the HTTP API host and radio without permitting unrelated HTTP hosts", () => {
  const xml = networkSecurityConfig("http://10.0.2.2:3939/path?ignored=yes");
  expect(xml).toContain('<base-config cleartextTrafficPermitted="false" />');
  expect(xml).toContain('<domain includeSubdomains="false">10.0.2.2</domain>');
  expect(xml).toContain('<domain includeSubdomains="false">netvarp.kringvarp.fo</domain>');
  expect(xml).not.toContain(":3939");
});

it("does not grant an HTTPS API host cleartext access", () => {
  expect(networkSecurityConfig("https://api.example.com")).not.toContain("api.example.com");
  expect(networkSecurityConfig()).toContain("192.168.1.10");
});

it("keeps the TV launcher intent while adding landscape, artwork and release network policy", () => {
  const manifest = {
    manifest: {
      application: [
        {
          $: { "android:name": ".MainApplication" },
          activity: [
            {
              $: { "android:name": ".MainActivity" },
              "intent-filter": [{ action: [{ $: { "android:name": "android.intent.action.MAIN" } }], category: [{ $: { "android:name": "android.intent.category.LEANBACK_LAUNCHER" } }] }],
            },
          ],
        },
      ],
    },
  };
  const result = configureManifest(manifest);
  const application = result.manifest.application[0];
  expect(application.$).toMatchObject({ "android:banner": "@drawable/tv_banner", "android:networkSecurityConfig": "@xml/network_security_config" });
  expect(application.activity[0].$["android:screenOrientation"]).toBe("landscape");
  expect(application.activity[0]["intent-filter"][0].category[0].$["android:name"]).toBe("android.intent.category.LEANBACK_LAUNCHER");
});

it("applies landscape after an earlier TV mod removes the activity orientation", async () => {
  const manifest = {
    manifest: {
      application: [
        { $: { "android:name": ".MainApplication" }, activity: [{ $: { "android:name": ".MainActivity" }, "intent-filter": [{ action: [{ $: { "android:name": "android.intent.action.MAIN" } }] }] }] },
      ],
    },
  };
  const config = withAndroidTV({
    name: "KVF",
    slug: "kvf",
    mods: {
      android: {
        manifest: async (config) => {
          delete config.modResults.manifest.application[0].activity[0].$["android:screenOrientation"];
          return config;
        },
      },
    },
  });
  const result = await config.mods.android.manifest({ ...config, modResults: manifest, modRequest: { platform: "android", modName: "manifest" } });
  expect(result.modResults.manifest.application[0].activity[0].$["android:screenOrientation"]).toBe("landscape");
});

it("installs TV playback controls over Media3's phone layout without fullscreen or queue buttons", () => {
  const fs = require("fs");
  const os = require("os");
  const path = require("path");
  const { copyResources } = require("../withAndroidTV");
  const resources = fs.mkdtempSync(path.join(os.tmpdir(), "kvf-res-"));
  try {
    copyResources(path.join(__dirname, "../android-tv-res"), resources);
    // Same name as Media3's controller layout, so the app's copy replaces it.
    const layout = fs.readFileSync(path.join(resources, "layout/exo_player_control_view.xml"), "utf8");
    expect(layout).toContain('android:id="@id/exo_play_pause"');
    expect(layout).toContain('android:focusedByDefault="true"');
    expect(layout).toContain('android:id="@id/exo_progress_placeholder"');
    expect(layout).toContain('android:id="@id/exo_settings"');
    for (const id of ["exo_fullscreen", "exo_minimal_fullscreen", "exo_prev", "exo_next", "exo_overflow_show", "exo_vr"]) {
      expect(layout).not.toContain(`@id/${id}"`);
    }
    for (const file of ["values/kvf_player.xml", "color/kvf_player_button_tint.xml", "drawable/kvf_player_button_background.xml", "drawable/kvf_player_scrim.xml"]) {
      expect(fs.existsSync(path.join(resources, file))).toBe(true);
    }
  } finally {
    fs.rmSync(resources, { recursive: true, force: true });
  }
});
