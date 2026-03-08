var cardModifier = class extends (ExtensionCommon.ExtensionAPI) {
  getAPI(context) {
    const styleId = "styles-from-add-delete-button-addon";
    const buttonClass = "qcd-delete-button";
    const buttonIconClass = "qcd-delete-button-icon";

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

    const cssText = `
[is="thread-card"] .card-container,
tr.thread-card .card-container,
li.thread-card .card-container {
  position: relative !important;
}

.thread-card-icon-info {
  padding-inline-end: 32px !important;
}

.card-container > .${buttonClass} {
  appearance: none !important;
  position: absolute !important;
  inset-inline-end: 8px !important;
  inset-block-end: -2px !important;
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
  transition: transform 0.15s ease !important;
  z-index: 20 !important;
}

.card-container > .${buttonClass} > .${buttonIconClass} {
  inline-size: 16px !important;
  block-size: 16px !important;
  background-color: currentColor !important;
  mask-image: url("chrome://messenger/skin/icons/delete.svg") !important;
  mask-repeat: no-repeat !important;
  mask-position: center !important;
  mask-size: 16px 16px !important;
  opacity: 0.4 !important;
  transition: opacity 0.15s ease, transform 0.15s ease, background-color 0.15s ease !important;
}

.card-container > .${buttonClass}:hover > .${buttonIconClass},
.card-container > .${buttonClass}:focus-visible > .${buttonIconClass} {
  opacity: 1 !important;
}

.card-container > .${buttonClass}:active > .${buttonIconClass} {
  transform: scale(0.85) !important;
}

.card-layout.cards-row-compact .card-container > .${buttonClass} {
  inset-block-end: 0px !important;
}

.card-layout:not(.cards-row-compact) .card-container > .${buttonClass} {
  inset-block-end: 0.5px !important;
}

:is(tr, li)[data-properties~="dummy"][aria-expanded] .card-container > .${buttonClass} {
  display: none !important;
}

:is(tr, li)[is="thread-group-header"] .card-container > .${buttonClass} {
  display: none !important;
}
`;

    async function waitForThreadCards(doc, retries = 10, delay = 200) {
      for (let i = 0; i < retries; i++) {
        if (doc.querySelector(".thread-card-icon-info")) {
          return true;
        }
        await new Promise(r => doc.defaultView.setTimeout(r, delay));
      }
      return false;
    }

    function deleteCardFromButton(button) {
      const card = button.closest("tr, li, thread-card");
      if (!card) {
        return;
      }

      const unwrap = obj => {
        try {
          return obj && obj.wrappedJSObject ? obj.wrappedJSObject : obj;
        } catch (err) {
          return obj;
        }
      };

      const contentWin = button.ownerDocument.defaultView;
      const realContentWin = unwrap(contentWin);
      const rawCard = unwrap(card);
      const dbView = unwrap(realContentWin?.gDBView || contentWin?.gDBView);
      let targetViewIndex = null;

      const candidateViewIndices = [
        rawCard?._index,
        rawCard?.index,
        card._index,
        card.index,
      ];
      for (const candidate of candidateViewIndices) {
        if (Number.isInteger(candidate) && candidate >= 0) {
          targetViewIndex = candidate;
          break;
        }
      }

      let targetMsg = null;
      try {
        if (dbView && targetViewIndex !== null && typeof dbView.getMsgHdrAt === "function") {
          targetMsg = dbView.getMsgHdrAt(targetViewIndex);
        }
      } catch (err) {
        console.warn("QuickDelete: gDBView lookup failed", err);
      }

      try {
        targetMsg = targetMsg ||
          rawCard.message ||
          rawCard.messageKey ||
          rawCard.messageDisplayItem?.message ||
          rawCard._instance?.message ||
          rawCard._instance?.messageDisplayItem?.message;
      } catch (err) {
        console.warn("QuickDelete: Property access failed", err);
      }

      if (!targetMsg) {
        try {
          const ariaIndex = card.getAttribute("aria-rowindex") || card.getAttribute("aria-posinset");
          if (targetViewIndex === null && ariaIndex) {
            const viewIndex = parseInt(ariaIndex, 10) - 1;
            if (viewIndex >= 0) {
              targetViewIndex = viewIndex;
            }
          }

          if (dbView && targetViewIndex !== null) {
            targetMsg = dbView.getMsgHdrAt(targetViewIndex);
          }
        } catch (err) {
          console.error("QuickDelete: ARIA Index Error", err);
        }
      }

      if (targetMsg) {
        try {
          const msgHdr = targetMsg;
          if (msgHdr?.folder?.deleteMessages) {
            msgHdr.folder.deleteMessages([msgHdr], null, false, false, null, true);
            return;
          }
        } catch (err) {
          console.error("QuickDelete: Direct delete failed", err);
        }
      }
      console.error("QuickDelete: No message header found for clicked card.");
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

    function ensureDeleteButtons(doc) {
      for (const row of doc.querySelectorAll("[is='thread-card'], tr.thread-card, li.thread-card")) {
        const container = row.querySelector(".card-container") || row;
        if (!container.querySelector(`:scope > .${buttonClass}`)) {
          container.appendChild(createDeleteButton(doc));
        }
      }
    }

    function observeThreadCards(doc) {
      if (doc._qcdButtonObserver) {
        return;
      }

      let scheduled = false;
      const scheduleEnsureButtons = () => {
        if (scheduled) {
          return;
        }
        scheduled = true;
        doc.defaultView.requestAnimationFrame(() => {
          scheduled = false;
          ensureDeleteButtons(doc);
        });
      };

      doc._qcdButtonObserver = new doc.defaultView.MutationObserver(() => {
        scheduleEnsureButtons();
      });
      doc._qcdButtonObserver.observe(doc.body, {
        childList: true,
        subtree: true,
      });
    }

    context.callOnClose({
      close() {
        const windows = Array.from(Services.wm.getEnumerator("mail:3pane"));
        for (const window of windows) {
          for (const nativeTab of window.gTabmail.tabInfo.filter(t => t.mode.name === "mail3PaneTab")) {
            const doc = nativeTab?.chromeBrowser?.contentDocument;
            if (!doc) {
              continue;
            }
            const style = doc.getElementById(styleId);
            if (style) {
              style.remove();
            }
            if (doc._quickDeleteMouseDownHandler) {
              doc.removeEventListener("mousedown", doc._quickDeleteMouseDownHandler, true);
              delete doc._quickDeleteMouseDownHandler;
            }
            if (doc._qcdButtonObserver) {
              doc._qcdButtonObserver.disconnect();
              delete doc._qcdButtonObserver;
            }
            for (const button of doc.querySelectorAll(`.${buttonClass}`)) {
              button.remove();
            }
          }
        }
      }
    });

    return {
      cardModifier: {
        async add(tabId) {
          const nativeTab = context.extension.tabManager.get(tabId).nativeTab;
          const doc = nativeTab?.chromeBrowser?.contentDocument;
          if (!doc) {
            return;
          }

          await waitForThreadCards(doc);

          addDynamicCSS(doc, styleId, cssText);
          ensureDeleteButtons(doc);
          observeThreadCards(doc);

          if (doc._quickDeleteMouseDownHandler) {
            doc.removeEventListener("mousedown", doc._quickDeleteMouseDownHandler, true);
          }
          doc._quickDeleteMouseDownHandler = e => {
            const button = e.target.closest(`.${buttonClass}`);
            if (!button) {
              return;
            }
            e.preventDefault();
            e.stopImmediatePropagation();
          };
          doc.addEventListener("mousedown", doc._quickDeleteMouseDownHandler, true);

        },
      }
    };
  }
};
