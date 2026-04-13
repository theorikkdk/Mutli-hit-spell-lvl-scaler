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
  const totalHits = context.totalHits ?? context.extraHitsTotal ?? 0;
  const hitsRemaining = context.hitsRemaining ?? context.extraHitsRemaining ?? 0;

  return `
    <div class="${MODULE_ID}-extra-hit-prompt">
      <p><strong>${context.item?.name ?? "Configured spell"}</strong></p>
      <p>Hits restants : <strong>${hitsRemaining}</strong> / ${totalHits}</p>
      <p>Mode de resolution : <strong>${context.resolutionMode ?? "unknown"}</strong></p>
      <p>Next Hit utilise la cible actuellement selectionnee.</p>
      <p>Resolve All consomme 1 hit par cible selectionnee, ou tous les hits restants sur l'unique cible selectionnee.</p>
      <p>La selection ne doit jamais depasser le nombre de hits disponibles.</p>
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
      action: "resolveAll",
      label: "Resolve All",
      callback: async () => handleResolveAll(contextId)
    },
    {
      action: "cancel",
      label: "Cancel",
      callback: async () => handleCancel(contextId)
    }
  ];

  const prompt = new DialogV2({
    window: {
      title: `Hits: ${context.item?.name ?? context.id}`
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
