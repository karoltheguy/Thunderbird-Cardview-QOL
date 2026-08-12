// `browser` is the WebExtension API object, provided by Thunderbird at
// runtime. Declaring it keeps ESLint (and so Codacy) from reporting every use
// as an undefined variable.
/* global browser */

const DEFAULT_SETTINGS = {
  showDeleteButton: true,
  showFavoriteStar: true,
  showReadIndicator: true,
  readIndicatorColor: "#0078d4",
};

async function getSettings() {
  try {
    const stored = await browser.storage.local.get(DEFAULT_SETTINGS);
    return stored;
  } catch (error) {
    // Falling back to defaults keeps the add-on usable, but swallowing this
    // silently made a broken storage layer look like the user had never
    // changed a setting. Log it so the cause is visible in the console.
    console.error("CardviewQOL: reading stored settings failed, using defaults", error);
    return DEFAULT_SETTINGS;
  }
}

async function init() {
  // Give the platform a short moment, then attach to existing windows
  await new Promise((r) => setTimeout(r, 250));
  const settings = await getSettings();
  const tabs = await browser.tabs.query({ type: "mail" });
  for (const tabInfo of tabs) {
    await browser.cardModifier.add(tabInfo.id, settings);
  }
}

// Run immediately on add-on startup.
// NOSONAR on the reporting line: S7785 wants top-level await, but MV2 loads
// this as a classic script, where top-level await is a syntax error.
init().catch((error) => { // NOSONAR
  console.error("CardviewQOL: startup failed", error);
});

// Listen for new tabs.
browser.tabs.onCreated.addListener(async (tabInfo) => {
  if (tabInfo.type === "mail") {
    const settings = await getSettings();
    await browser.cardModifier.add(tabInfo.id, settings);
  }
});

// Live-reload when settings change (no restart needed).
browser.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;
  const settings = await getSettings();
  const tabs = await browser.tabs.query({ type: "mail" });
  for (const tabInfo of tabs) {
    await browser.cardModifier.reload(tabInfo.id, settings);
  }
});
