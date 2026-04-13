import { getSpellConfig } from "../module.mjs";
import { openSpellConfigDialog } from "./spell-config-dialog.mjs";

const HEADER_BUTTON_CLASS = "multi-hit-spell-lvl-scaler-open-button";

function registerItemSheetHeaderButton() {
  Hooks.on("renderItemSheet5e", onRenderItemSheet5e);
}

function getRootElement(app, html) {
  if (app?.element instanceof HTMLElement) {
    return app.element;
  }

  if (app?.element?.[0] instanceof HTMLElement) {
    return app.element[0];
  }

  if (html instanceof HTMLElement) {
    return html;
  }

  if (html?.[0] instanceof HTMLElement) {
    return html[0];
  }

  return null;
}

function findHeaderContainer(root) {
  if (!root) {
    return null;
  }

  const applicationRoot = root.matches?.(".application") ? root : root.closest?.(".application") ?? root;
  const header = applicationRoot.querySelector?.(".window-header");

  if (!header) {
    return null;
  }

  const closeControl = header.querySelector('[data-action="close"], .header-control.close, .window-control.close, .close');

  return {
    header,
    closeControl,
    insertionParent: closeControl?.parentElement ?? header
  };
}

function localizeText(englishText, frenchText) {
  return game?.i18n?.lang === "fr" ? frenchText : englishText;
}

function listItemActivities(item) {
  return Array.from(item?.system?.activities ?? []).map((entry) => {
    const activity = Array.isArray(entry) ? entry[1] : entry;

    return {
      id: typeof activity?.id === "string" ? activity.id : "",
      name: typeof activity?.name === "string" && activity.name ? activity.name : (activity?.id ?? "")
    };
  }).filter((activity) => activity.id);
}

function getConfigState(item) {
  const config = getSpellConfig(item);
  const activities = listItemActivities(item);
  const hasHitActivity = Boolean(config.hitActivityId);
  const hitActivityExists = hasHitActivity && activities.some((activity) => activity.id === config.hitActivityId);
  const hasValidCounts = Number.isInteger(config.baseTotalHits) && (config.baseTotalHits >= 1)
    && Number.isInteger(config.hitsPerSlotLevel) && (config.hitsPerSlotLevel >= 0);

  if (!config.enabled) {
    return {
      status: "disabled",
      tooltip: localizeText(
        "Multi-Hit disabled",
        "Multi-Hit desactive"
      )
    };
  }

  if (hitActivityExists && hasValidCounts) {
    return {
      status: "valid",
      tooltip: localizeText(
        "Multi-Hit enabled and ready",
        "Multi-Hit actif et configuration valide"
      )
    };
  }

  return {
    status: "invalid",
    tooltip: localizeText(
      "Multi-Hit enabled but configuration is incomplete",
      "Multi-Hit actif mais configuration incomplete"
    )
  };
}

async function onRenderItemSheet5e(app, html) {
  const item = app?.item ?? app?.document ?? app?.object;
  const root = getRootElement(app, html);
  const headerRefs = findHeaderContainer(root);

  if (!item || (item.type !== "spell") || !headerRefs) {
    return;
  }

  headerRefs.insertionParent.querySelector(`.${HEADER_BUTTON_CLASS}`)?.remove();

  const state = getConfigState(item);
  const buttonTag = headerRefs.closeControl?.tagName?.toLowerCase?.() || "button";
  const button = document.createElement(buttonTag);

  button.classList.add(
    "header-control",
    HEADER_BUTTON_CLASS,
    `is-${state.status}`
  );
  button.setAttribute(
    "aria-label",
    localizeText("Open Multi-Hit configuration", "Ouvrir la configuration Multi-Hit")
  );
  button.title = state.tooltip;

  if (buttonTag === "button") {
    button.type = "button";
  } else {
    button.href = "#";
  }

  button.innerHTML = '<i class="fa-solid fa-crosshairs" aria-hidden="true"></i>';
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await openSpellConfigDialog(item);
  });

  if (headerRefs.closeControl) {
    headerRefs.insertionParent.insertBefore(button, headerRefs.closeControl);
  } else {
    headerRefs.insertionParent.append(button);
  }
}

export { registerItemSheetHeaderButton };
