import { formatLocalization, localize } from "../i18n.mjs";
import { getCastContext } from "../runtime/cast-context.mjs";
import {
  cancelCastContext,
  resolveNextExtraHit,
  resolveRemainingExtraHits
} from "./extra-hit-executor.mjs";

const MODULE_ID = "multi-hit-spell-lvl-scaler";
const OPEN_PROMPTS = new Map();
const DialogV2 = foundry?.applications?.api?.DialogV2 ?? null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function closePrompt(contextId) {
  const existingPrompt = OPEN_PROMPTS.get(contextId);

  if (!existingPrompt) {
    return;
  }

  OPEN_PROMPTS.delete(contextId);
  existingPrompt.close();
}

function buildPromptContent(context) {
  const totalHits = context.totalHits ?? context.extraHitsTotal ?? 0;
  const hitsRemaining = context.hitsRemaining ?? context.extraHitsRemaining ?? 0;
  const itemName = context.item?.name ?? localize("Ui.ExtraHitPrompt.FallbackSpellName", "Configured spell");

  return `
    <div class="${MODULE_ID}-extra-hit-prompt">
      <p><strong>${escapeHtml(itemName)}</strong></p>
      <p>${escapeHtml(formatLocalization(
        "Ui.ExtraHitPrompt.RemainingHits",
        { hitsRemaining, totalHits },
        "Hits remaining: {hitsRemaining} / {totalHits}"
      ))}</p>
      <p>${escapeHtml(localize("Ui.ExtraHitPrompt.NextHitHint", "Next Hit uses the currently selected target."))}</p>
      <p>${escapeHtml(localize("Ui.ExtraHitPrompt.ResolveAllHint", "Resolve All spends 1 hit per selected target, or all remaining hits on the only selected target."))}</p>
      <p>${escapeHtml(localize("Ui.ExtraHitPrompt.SelectionHint", "Your selection must never exceed the number of available hits."))}</p>
    </div>
  `;
}

async function handleNext(contextId) {
  const result = await resolveNextExtraHit(contextId);

  if (result.context) {
    promptExtraHitResolution(contextId);
  }
}

async function handleResolveAll(contextId) {
  const result = await resolveRemainingExtraHits(contextId);

  if (!result.completed && getCastContext(contextId)) {
    promptExtraHitResolution(contextId);
  }
}

async function handleCancel(contextId) {
  cancelCastContext(contextId);
}

export function promptExtraHitResolution(contextId) {
  const context = getCastContext(contextId);

  if (!context) {
    closePrompt(contextId);
    return null;
  }

  if (context.userId && (context.userId !== game?.user?.id) && !game?.user?.isGM) {
    return null;
  }

  closePrompt(contextId);

  const buttons = [
    {
      action: "next",
      label: localize("Ui.ExtraHitPrompt.NextHit", "Next Hit"),
      callback: async () => handleNext(contextId)
    },
    {
      action: "resolveAll",
      label: localize("Ui.ExtraHitPrompt.ResolveAll", "Resolve All"),
      callback: async () => handleResolveAll(contextId)
    },
    {
      action: "cancel",
      label: localize("Ui.ExtraHitPrompt.Cancel", "Cancel"),
      callback: async () => handleCancel(contextId)
    }
  ];

  const prompt = new DialogV2({
    window: {
      title: formatLocalization(
        "Ui.ExtraHitPrompt.Title",
        {
          itemName: context.item?.name ?? context.id
        },
        "Remaining hits: {itemName}"
      )
    },
    content: buildPromptContent(context),
    buttons,
    position: {
      width: 360
    },
    modal: false,
    close: () => {
      OPEN_PROMPTS.delete(contextId);
    }
  });

  OPEN_PROMPTS.set(contextId, prompt);
  prompt.render({ force: true });

  return prompt;
}
