var cardModifier = class extends (ExtensionCommon.ExtensionAPI) {
  getAPI(context) {
    const styleId = "styles-from-add-delete-button-addon";
    const buttonClass = "qcd-delete-button";
    const buttonIconClass = "qcd-delete-button-icon";
    const readIndicatorClass = "qcd-read-indicator";
    const hoveredClass = "qcd-hovered";

    // JS-only selector — used in querySelectorAll/closest, NOT in CSS strings.
    // Includes bare 'thread-card' tag for newer Thunderbird builds.
    const jsThreadCardSelector = "thread-card, [is='thread-card'], tr.thread-card, li.thread-card";

    // We do NOT use a thread-card parent selector in CSS for hover — it can't be
    // reliably matched in Thunderbird's privileged document context.
    // Instead we use a .qcd-hovered class toggled via JS mouseenter/mouseleave.

    const defaultSettings = {
      showDeleteButton: true,
      showFavoriteStar: true,
      showReadIndicator: true,
    };

    function addDynamicCSS(document, id, css) {
      const existing = document.getElementById(id);
      if (existing) {
        existing.remove();
      }
      const style = document.createElement("style");
      style.id = id;
      style.textContent = css;
      document.head.appendChild(style);
    }

    function buildCSS(settings) {
      const s = Object.assign({}, defaultSettings, settings);
      let css = `
/* === Anchor containers that hold our injected elements (:has() — Gecko 121+) === */
.card-container:has(> .${buttonClass}),
.card-container:has(> .${readIndicatorClass}),
.thread-card-icon-info:has(> .${buttonClass}) {
  position: relative !important;
}

.thread-card-icon-info:has(> .${buttonClass}) {
  padding-inline-end: 32px !important;
}

/* === Delete button layout (always injected regardless of toggle) === */
.thread-card-icon-info > .${buttonClass},
.card-container > .${buttonClass} {
  appearance: none !important;
  position: absolute !important;
  inset-inline-end: 0 !important;
  inset-block-start: 50% !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  inline-size: 24px !important;
  block-size: 24px !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  border-radius: 4px !important;
  background: transparent !important;
  cursor: pointer !important;
  transform: translateY(-50%) !important;
  z-index: 20 !important;
}

.thread-card-icon-info > .${buttonClass} > .${buttonIconClass},
.card-container > .${buttonClass} > .${buttonIconClass} {
  inline-size: 16px !important;
  block-size: 16px !important;
  background-color: currentColor !important;
  mask-image: url("chrome://messenger/skin/icons/delete.svg") !important;
  mask-repeat: no-repeat !important;
  mask-position: center !important;
  mask-size: 16px 16px !important;
  opacity: 0.4 !important;
  transition: opacity 0.15s ease, transform 0.15s ease !important;
}

.thread-card-icon-info > .${buttonClass}:hover > .${buttonIconClass},
.card-container > .${buttonClass}:hover > .${buttonIconClass} {
  opacity: 1 !important;
}

.thread-card-icon-info > .${buttonClass}:active > .${buttonIconClass},
.card-container > .${buttonClass}:active > .${buttonIconClass} {
  transform: scale(0.85) !important;
}

/* Hide on group headers / dummy rows */
:is(tr, li, thread-card)[data-properties~="dummy"][aria-expanded] .thread-card-icon-info > .${buttonClass},
:is(tr, li, thread-card)[is="thread-group-header"] .thread-card-icon-info > .${buttonClass},
:is(tr, li, thread-card)[data-properties~="dummy"][aria-expanded] .card-container > .${buttonClass},
:is(tr, li, thread-card)[is="thread-group-header"] .card-container > .${buttonClass} {
  display: none !important;
}
`;

      if (s.showDeleteButton) {
        // Toggle ON  → hover-only: hidden at rest, visible on hover
        css += `
/* === Delete button: hover-only mode === */
.thread-card-icon-info > .${buttonClass},
.card-container > .${buttonClass} {
  opacity: 0 !important;
  pointer-events: none !important;
  transition: opacity 0.15s ease !important;
}

.${hoveredClass} .thread-card-icon-info > .${buttonClass},
.${hoveredClass} .card-container > .${buttonClass} {
  opacity: 1 !important;
  pointer-events: auto !important;
}
`;
      } else {
        // Toggle OFF → always-show: matches original pre-hover behaviour
        css += `
/* === Delete button: always-visible mode === */
.thread-card-icon-info > .${buttonClass},
.card-container > .${buttonClass} {
  opacity: 1 !important;
  pointer-events: auto !important;
}
`;
      }

      if (s.showFavoriteStar) {
        // Real Thunderbird class confirmed from source (about3Pane.xhtml line 336):
        // <button class="button-star tree-button-flag">
        // The wrapper is .tree-view-row-flag
        css += `
/* === Favorite star: hover-only mode === */
.tree-button-flag {
  opacity: 0 !important;
  transition: opacity 0.15s ease !important;
}

.${hoveredClass} .tree-button-flag {
  opacity: 1 !important;
}

/* Always show when the message is actually flagged */
[data-properties~="flagged"] .tree-button-flag {
  opacity: 1 !important;
}

/* Transparent yellow highlight when hovering the star (only if not already flagged) */
:not([data-properties~="flagged"]) .tree-button-flag:hover {
  background-color: rgba(255, 204, 0, 0.25) !important;
  border-radius: 4px !important;
}
`;
      }

      if (s.showReadIndicator) {
        css += `
/* === Read/unread vertical bar === */
.${readIndicatorClass} {
  position: absolute !important;
  inset-inline-start: 0 !important;
  inset-block-start: 0 !important;
  inline-size: 10px !important; /* 10px invisible hit area */
  block-size: 100% !important;
  background: transparent !important;
  cursor: pointer !important;
  z-index: 20 !important;
}

/* The visible blue bar */
.${readIndicatorClass}::before {
  content: "" !important;
  position: absolute !important;
  inset-inline-start: 0 !important;
  inset-block-start: 0 !important;
  inline-size: 4px !important;
  block-size: 100% !important;
  background: #0078d4 !important;
  border-radius: 0 2px 2px 0 !important;
  transition: opacity 0.2s ease, inline-size 0.2s ease !important;
}

.${readIndicatorClass}[data-read="true"] {
  pointer-events: none !important;
}
.${readIndicatorClass}[data-read="true"]::before {
  opacity: 0 !important;
}

.${readIndicatorClass}[data-read="false"] {
  pointer-events: auto !important;
}
.${readIndicatorClass}[data-read="false"]::before {
  opacity: 1 !important;
}

/* On card hover, ghost the read bar so users know they can click it to mark unread */
.${hoveredClass} .${readIndicatorClass}[data-read="true"] {
  pointer-events: auto !important;
}
.${hoveredClass} .${readIndicatorClass}[data-read="true"]::before {
  opacity: 0.15 !important;
}

/* On bar hit-area hover, widen the visible bar and provide visual feedback (semi-transparent) */
.${readIndicatorClass}:hover::before {
  inline-size: 8px !important;
}

.${readIndicatorClass}[data-read="false"]:hover::before {
  opacity: 0.5 !important;
}

.${readIndicatorClass}[data-read="true"]:hover::before {
  opacity: 0.5 !important;
}

/* Hide Thunderbird's native unread indicator button when our bar is present.
   Aggressively targets all known unread indicator classes/wrappers in different TB versions. */
:is(tr, li, thread-card, [is="thread-card"]):has(.${readIndicatorClass}) .tree-button-unread,
:is(tr, li, thread-card, [is="thread-card"]):has(.${readIndicatorClass}) .tree-view-row-unread,
:is(tr, li, thread-card, [is="thread-card"]):has(.${readIndicatorClass}) .unread-indicator,
:is(tr, li, thread-card, [is="thread-card"]):has(.${readIndicatorClass}) .thread-card-unread-indicator,
:is(tr, li, thread-card, [is="thread-card"]):has(.${readIndicatorClass}) .is-new-indicator,
:is(tr, li, thread-card, [is="thread-card"]):has(.${readIndicatorClass}) .new-indicator,
:is(tr, li, thread-card, [is="thread-card"]):has(.${readIndicatorClass}) .read-status {
  opacity: 0 !important;
  visibility: hidden !important;
}

:is(tr, li, thread-card, [is="thread-card"]):has(.${readIndicatorClass}) .card-layout[data-properties~="unread"] {
  border-left-color: transparent !important;
}
`;
      }

      return css;
    }

    function unwrap(obj) {
      try {
        return obj && obj.wrappedJSObject ? obj.wrappedJSObject : obj;
      } catch (err) {
        return obj;
      }
    }

    async function waitForThreadCards(doc, retries = 10, delay = 200) {
      for (let i = 0; i < retries; i++) {
        if (doc.querySelector(jsThreadCardSelector)) {
          return true;
        }
        await new Promise(r => doc.defaultView.setTimeout(r, delay));
      }
      return false;
    }

    function getViewIndex(card, rawCard) {
      const candidateViewIndices = [
        rawCard?._index,
        rawCard?.index,
        card._index,
        card.index,
      ];

      for (const candidate of candidateViewIndices) {
        if (Number.isInteger(candidate) && candidate >= 0) {
          return candidate;
        }
      }

      const ariaIndex = card.getAttribute("aria-rowindex") || card.getAttribute("aria-posinset");
      if (!ariaIndex) {
        return null;
      }

      const viewIndex = parseInt(ariaIndex, 10) - 1;
      return viewIndex >= 0 ? viewIndex : null;
    }

    function getMessageHeader(card) {
      const contentWin = card.ownerDocument.defaultView;
      const rawCard = unwrap(card);
      const dbView = unwrap(contentWin?.gDBView);
      const viewIndex = getViewIndex(card, rawCard);

      if (dbView && viewIndex !== null && typeof dbView.getMsgHdrAt === "function") {
        try {
          const msgHdr = dbView.getMsgHdrAt(viewIndex);
          if (msgHdr) {
            return msgHdr;
          }
        } catch (err) {
          console.warn("QuickDelete: gDBView lookup failed", err);
        }
      }

      try {
        const fallbackMsg =
          rawCard.message ||
          rawCard.messageKey ||
          rawCard.messageDisplayItem?.message ||
          rawCard._instance?.message ||
          rawCard._instance?.messageDisplayItem?.message;

        if (fallbackMsg && typeof fallbackMsg !== "number") {
          return fallbackMsg;
        }
      } catch (err) {
        console.warn("QuickDelete: Property access failed", err);
      }

      return null;
    }

    function deleteCardFromButton(button) {
      const card = button.closest("tr, li, thread-card");
      if (!card) {
        return;
      }

      const msgHdr = getMessageHeader(card);
      if (!msgHdr?.folder?.deleteMessages) {
        console.error("QuickDelete: No message header found for clicked card.");
        return;
      }

      try {
        const contentWin = card.ownerDocument.defaultView;
        const topWin = contentWin?.browsingContext?.top?.window ?? contentWin;
        const msgWindow = topWin?.msgWindow ?? null;

        msgHdr.folder.deleteMessages([msgHdr], msgWindow, false, true, null, true);
      } catch (err) {
        console.error("QuickDelete: Direct delete failed", err);
      }
    }

    function createDeleteButton(doc) {
      const button = doc.createElement("button");
      button.className = buttonClass;
      button.type = "button";
      button.title = "Delete";
      button.setAttribute("aria-label", "Delete");
      const icon = doc.createElement("span");
      icon.className = buttonIconClass;
      icon.setAttribute("aria-hidden", "true");
      button.appendChild(icon);
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        deleteCardFromButton(button);
      }, true);
      return button;
    }

    function createReadIndicator(doc) {
      const indicator = doc.createElement("span");
      indicator.className = readIndicatorClass;
      indicator.setAttribute("aria-hidden", "true");
      indicator.addEventListener("click", event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const card = indicator.closest("tr, li, thread-card");
        if (!card) return;
        const msgHdr = getMessageHeader(card);
        if (!msgHdr) {
          console.error("QuickReadToggle: No message header found.");
          return;
        }
        try {
          msgHdr.markRead(!msgHdr.isRead);
          indicator.setAttribute("data-read", String(msgHdr.isRead));
        } catch (err) {
          console.error("QuickReadToggle: Failed to toggle read state", err);
        }
      }, true);

      // Prevent double-click from bubbling up and opening the email
      indicator.addEventListener("dblclick", event => {
        event.preventDefault();
        event.stopImmediatePropagation();
      }, true);

      return indicator;
    }

    const hoveredWired = new WeakSet();

    function wireHoverListeners(row) {
      if (hoveredWired.has(row)) return;
      hoveredWired.add(row);
      row.addEventListener("mouseenter", () => row.classList.add(hoveredClass));
      row.addEventListener("mouseleave", () => row.classList.remove(hoveredClass));
    }

    function ensureDeleteButton(row, doc) {
      const container = row.querySelector(".thread-card-icon-info") ||
        row.querySelector(".card-container") ||
        row;
      if (!container.querySelector(`:scope > .${buttonClass}`)) {
        container.appendChild(createDeleteButton(doc));
      }
    }

    function ensureReadIndicator(row, doc) {
      const container = row.querySelector(".card-container");
      if (!container) {
        return;
      }
      const existing = container.querySelector(`:scope > .${readIndicatorClass}`);
      if (existing) {
        const msgHdr = getMessageHeader(row);
        if (msgHdr) {
          existing.setAttribute("data-read", String(msgHdr.isRead));
        }
        return;
      }
      const indicator = createReadIndicator(doc);
      const msgHdr = getMessageHeader(row);
      indicator.setAttribute("data-read", msgHdr ? String(msgHdr.isRead) : "true");
      container.appendChild(indicator);
    }

    function ensureElements(doc, settings) {
      const s = Object.assign({}, defaultSettings, settings);
      for (const row of doc.querySelectorAll(jsThreadCardSelector)) {
        // Wire hover listeners whenever any hover-dependent feature is active.
        if (s.showDeleteButton || s.showFavoriteStar || s.showReadIndicator) {
          wireHoverListeners(row);
        }
        // Delete button is always injected; the toggle controls visibility (hover-only vs always-show).
        ensureDeleteButton(row, doc);
        if (s.showReadIndicator) {
          ensureReadIndicator(row, doc);
        }
      }
    }

    function removeElements(doc) {
      for (const button of doc.querySelectorAll(`.${buttonClass}`)) {
        button.remove();
      }
      for (const indicator of doc.querySelectorAll(`.${readIndicatorClass}`)) {
        indicator.remove();
      }
      for (const row of doc.querySelectorAll(`.${hoveredClass}`)) {
        row.classList.remove(hoveredClass);
      }
    }

    function observeThreadCards(doc, settings) {
      if (doc._qcdButtonObserver) {
        doc._qcdButtonObserver.disconnect();
        delete doc._qcdButtonObserver;
      }

      let scheduled = false;
      const scheduleEnsureElements = () => {
        if (scheduled) return;
        scheduled = true;
        doc.defaultView.requestAnimationFrame(() => {
          scheduled = false;
          ensureElements(doc, settings);
        });
      };

      doc._qcdButtonObserver = new doc.defaultView.MutationObserver(() => {
        scheduleEnsureElements();
      });
      doc._qcdButtonObserver.observe(doc.body, {
        childList: true,
        subtree: true,
      });
    }

    function applyToDoc(doc, settings) {
      addDynamicCSS(doc, styleId, buildCSS(settings));
      removeElements(doc);
      ensureElements(doc, settings);
      observeThreadCards(doc, settings);

      if (doc._quickDeleteMouseDownHandler) {
        doc.removeEventListener("mousedown", doc._quickDeleteMouseDownHandler, true);
      }
      doc._quickDeleteMouseDownHandler = e => {
        const button = e.target.closest(`.${buttonClass}`);
        if (!button) return;
        e.preventDefault();
        e.stopImmediatePropagation();
      };
      doc.addEventListener("mousedown", doc._quickDeleteMouseDownHandler, true);
    }

    function getAllMailDocs() {
      const docs = [];
      try {
        const windows = Array.from(Services.wm.getEnumerator("mail:3pane"));
        for (const window of windows) {
          for (const nativeTab of window.gTabmail.tabInfo.filter(t => t.mode.name === "mail3PaneTab")) {
            const doc = nativeTab?.chromeBrowser?.contentDocument;
            if (doc) docs.push(doc);
          }
        }
      } catch (err) {
        console.error("QCD: Error enumerating windows", err);
      }
      return docs;
    }

    context.callOnClose({
      close() {
        for (const doc of getAllMailDocs()) {
          const style = doc.getElementById(styleId);
          if (style) style.remove();

          if (doc._quickDeleteMouseDownHandler) {
            doc.removeEventListener("mousedown", doc._quickDeleteMouseDownHandler, true);
            delete doc._quickDeleteMouseDownHandler;
          }
          if (doc._qcdButtonObserver) {
            doc._qcdButtonObserver.disconnect();
            delete doc._qcdButtonObserver;
          }
          removeElements(doc);
        }
      }
    });

    return {
      cardModifier: {
        async add(tabId, settings) {
          const nativeTab = context.extension.tabManager.get(tabId).nativeTab;
          const doc = nativeTab?.chromeBrowser?.contentDocument;
          if (!doc) return;

          await waitForThreadCards(doc);
          applyToDoc(doc, settings || {});
        },

        async reload(tabId, settings) {
          const nativeTab = context.extension.tabManager.get(tabId).nativeTab;
          const doc = nativeTab?.chromeBrowser?.contentDocument;
          if (!doc) return;

          applyToDoc(doc, settings || {});
        },
      }
    };
  }
};
