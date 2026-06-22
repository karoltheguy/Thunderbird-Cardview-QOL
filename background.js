const DEFAULT_SETTINGS = {
  showDeleteButton: true,
  showFavoriteStar: true,
  showReadIndicator: true,
};

async function getSettings() {
  try {
    const stored = await browser.storage.local.get(DEFAULT_SETTINGS);
    return stored;
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

async function init() {
  // Give the platform a short moment, then attach to existing windows
  await new Promise(r => setTimeout(r, 250));
  const settings = await getSettings();
  const tabs = await browser.tabs.query({ type: "mail" });
  for (const tabInfo of tabs) {
    await browser.cardModifier.add(tabInfo.id, settings);
  }
}

// Run immediately on add-on startup.
init();

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
