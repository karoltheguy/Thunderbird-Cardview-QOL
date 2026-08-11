const DEFAULT_SETTINGS = {
  showDeleteButton: true,
  showFavoriteStar: true,
  showReadIndicator: true,
  readIndicatorColor: "#0078d4",
};

const HEX_COLOR_PATTERN = /^#[\da-fA-F]{6}$/;

// Guards against an arbitrary stored string breaking out of the generated
// stylesheet. Falls back to the default for anything not a 6-digit hex.
function normalizeHexColor(value) {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value)
    ? value
    : DEFAULT_SETTINGS.readIndicatorColor;
}

const toggles = document.querySelectorAll(".toggle-input[data-key]");
const statusBar = document.getElementById("status-bar");
const versionLabel = document.getElementById("version-label");
const colorIndicator = document.getElementById("color-indicator");
const colorIndicatorHex = document.getElementById("color-indicator-hex");

// Show extension version
if (typeof browser !== "undefined" && browser.runtime?.getManifest) {
  const manifest = browser.runtime.getManifest();
  if (manifest?.version) {
    versionLabel.textContent = `v${manifest.version}`;
  }
}

// Tracks the last known-valid stored color, used to revert the text field
// if the user types something invalid.
let lastValidReadIndicatorColor = DEFAULT_SETTINGS.readIndicatorColor;

// Load saved settings and populate toggles
async function loadSettings() {
  const stored = await browser.storage.local.get(DEFAULT_SETTINGS);
  for (const toggle of toggles) {
    const key = toggle.dataset.key;
    if (key in stored) {
      toggle.checked = stored[key];
    }
  }

  lastValidReadIndicatorColor = normalizeHexColor(stored.readIndicatorColor);
  colorIndicator.value = lastValidReadIndicatorColor;
  colorIndicatorHex.value = lastValidReadIndicatorColor;
}

// Save a single key when a toggle changes
async function onToggleChange(event) {
  const key = event.target.dataset.key;
  const value = event.target.checked;
  await browser.storage.local.set({ [key]: value });
  flashSaved();
}

function flashSaved() {
  statusBar.textContent = "✓ Saved";
  // A later successful save clears a stale load error, otherwise the two
  // colours fight over the same element.
  statusBar.classList.remove("error");
  statusBar.classList.add("saved");
  clearTimeout(statusBar._timer);
  statusBar._timer = setTimeout(() => {
    statusBar.textContent = "";
    statusBar.classList.remove("saved");
  }, 2000);
}

// Color picker (dragging) → live preview in the text field only, no persist
function onColorPickerPreview(event) {
  const value = event.target.value;
  colorIndicatorHex.value = value;
}

// Color picker (committed) → mirror into the text field and persist
async function onColorPickerCommit(event) {
  const value = event.target.value;
  colorIndicatorHex.value = value;
  lastValidReadIndicatorColor = value;
  await browser.storage.local.set({ readIndicatorColor: value });
  flashSaved();
}

// Text field → validate, persist and mirror into the picker; revert if invalid
async function onColorHexChange(event) {
  const value = event.target.value;
  if (HEX_COLOR_PATTERN.test(value)) {
    lastValidReadIndicatorColor = value;
    colorIndicator.value = value;
    await browser.storage.local.set({ readIndicatorColor: value });
    flashSaved();
  } else {
    colorIndicatorHex.value = lastValidReadIndicatorColor;
  }
}

// Wire up listeners
for (const toggle of toggles) {
  toggle.addEventListener("change", onToggleChange);
}
colorIndicator.addEventListener("input", onColorPickerPreview);
colorIndicator.addEventListener("change", onColorPickerCommit);
colorIndicatorHex.addEventListener("change", onColorHexChange);

loadSettings().catch((error) => {
  console.error("CardviewQOL: loading settings failed", error);
  statusBar.textContent = "Could not load settings";
  statusBar.classList.add("error");
}); // NOSONAR
