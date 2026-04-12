import { getCastContext } from "../runtime/cast-context.mjs";
import {
  cancelCastContext,
  resolveNextExtraHit,
  resolveRemainingExtraHits
} from "./extra-hit-executor.mjs";

const MODULE_ID = "multi-hit-spell-lvl-scaler";
const OPEN_PROMPTS = new Map();
const DialogV2 = foundry?.applications?.api?.DialogV2 ?? null;

function closePrompt(contextId) {
  const existingPrompt = OPEN_PROMPTS.get(contextId);

  if (!existingPrompt) {
    return;
  }

  OPEN_PROMPTS.delete(contextId);
  existingPrompt.close();
}

function buildPromptContent(context) {
  const modeHint = context.targetingMode === "focus"
    ? "Focus : le prochain hit reutilisera la cible initiale."
    : "Retarget : change la cible actuelle avant de cliquer sur le hit suivant.";

  return `
    <div class="${MODULE_ID}-extra-hit-prompt">
      <p><strong>${context.item?.name ?? "Configured spell"}</strong></p>
      <p>Hits supplementaires restants : <strong>${context.extraHitsRemaining}</strong> / ${context.extraHitsTotal}</p>
      <p>Mode de ciblage : <strong>${context.targetingMode ?? "unknown"}</strong></p>
      <p>Mode de resolution : <strong>${context.resolutionMode ?? "unknown"}</strong></p>
      <p>${modeHint}</p>
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
      label: "Next Hit",
      callback: async () => handleNext(contextId)
    },
    {
      action: "cancel",
      label: "Cancel",
      callback: async () => handleCancel(contextId)
    }
  ];

  if (context.targetingMode === "focus") {
    buttons.splice(1, 0, {
      action: "resolveAll",
      label: "Resolve All",
      callback: async () => handleResolveAll(contextId)
    });
  }

  const prompt = new DialogV2({
    window: {
      title: `Extra Hits: ${context.item?.name ?? context.id}`
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
