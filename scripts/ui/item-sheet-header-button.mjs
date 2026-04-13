import { localize } from "../i18n.mjs";
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

function getMultiHitIconMarkup() {
  return `
    <svg
      class="multi-hit-spell-lvl-scaler-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.4">
        <path d="M2.0 12.4 C4.0 11.0, 5.7 9.6, 7.3 7.8" opacity="0.35"></path>
        <path d="M3.2 10.7 C5.1 9.7, 6.5 8.6, 7.9 6.9" opacity="0.6"></path>
        <path d="M4.9 9.0 C6.4 8.2, 7.6 7.0, 8.8 5.5"></path>
      </g>
      <g fill="currentColor">
        <path d="M10.9 3.1 L12.0 4.3 L13.7 4.1 L12.8 5.6 L13.6 7.0 L11.9 6.7 L10.6 7.7 L10.5 6.0 L9.1 5.1 L10.8 4.7 Z"></path>
      </g>
    </svg>
  `;
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
      tooltip: localize("Ui.HeaderButton.TooltipDisabled", "Multi-Hit disabled")
    };
  }

  if (hitActivityExists && hasValidCounts) {
    return {
      status: "valid",
      tooltip: localize("Ui.HeaderButton.TooltipValid", "Multi-Hit enabled and ready")
    };
  }

  return {
    status: "invalid",
    tooltip: localize("Ui.HeaderButton.TooltipInvalid", "Multi-Hit enabled, but setup is incomplete")
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
    localize("Ui.HeaderButton.AriaLabel", "Open Multi-Hit configuration")
  );
  button.title = state.tooltip;

  if (buttonTag === "button") {
    button.type = "button";
  } else {
    button.href = "#";
  }

  button.innerHTML = getMultiHitIconMarkup();
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
