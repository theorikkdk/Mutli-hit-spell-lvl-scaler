import {
  deleteCastContext,
  getCastContext,
  updateCastContext
} from "../runtime/cast-context.mjs";

const MODULE_ID = "multi-hit-spell-lvl-scaler";
const DEBUG_SETTING = "debug";

function getModuleVersion() {
  return game?.modules?.get?.(MODULE_ID)?.version ?? "dev";
}

function getLogPrefix() {
  return `[${MODULE_ID} v${getModuleVersion()}]`;
}

function isDebugEnabled() {
  const settingId = `${MODULE_ID}.${DEBUG_SETTING}`;

  if (!game?.settings?.settings?.has(settingId)) {
    return false;
  }

  return Boolean(game.settings.get(MODULE_ID, DEBUG_SETTING));
}

function debug(...args) {
  if (!isDebugEnabled()) {
    return;
  }

  console.debug(`${getLogPrefix()}[debug]`, ...args);
}

function warn(...args) {
  console.warn(getLogPrefix(), ...args);
}

function info(...args) {
  console.info(getLogPrefix(), ...args);
}

function normalizeNonNegativeInteger(value, fallback = null) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(numericValue));
}

function cloneData(data) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(data);
  }

  return JSON.parse(JSON.stringify(data));
}

function summarizeToken(token) {
  const tokenDocument = token?.document ?? token;

  if (!tokenDocument) {
    return null;
  }

  return {
    id: typeof tokenDocument.id === "string" ? tokenDocument.id : null,
    uuid: typeof tokenDocument.uuid === "string" ? tokenDocument.uuid : null,
    name: typeof tokenDocument.name === "string" ? tokenDocument.name : ""
  };
}

function summarizeActivity(activity) {
  if (!activity) {
    return null;
  }

  return {
    id: typeof activity.id === "string" ? activity.id : null,
    uuid: typeof activity.uuid === "string" ? activity.uuid : null,
    name: typeof activity.name === "string" ? activity.name : "",
    type: typeof activity.type === "string" ? activity.type : ""
  };
}

function notifyWarn(message, details = undefined) {
  warn(message, details);
  ui.notifications?.warn?.(message);
}

function notifyInfo(message, details = undefined) {
  info(message, details);
  ui.notifications?.info?.(message);
}

function canCurrentUserManageContext(context) {
  if (!context?.userId) {
    return true;
  }

  return (game?.user?.id === context.userId) || Boolean(game?.user?.isGM);
}

function createTokenSnapshot(token) {
  const tokenDocument = token?.document ?? token;

  if (!tokenDocument?.uuid) {
    return null;
  }

  return {
    tokenId: typeof tokenDocument.id === "string" ? tokenDocument.id : null,
    tokenUuid: tokenDocument.uuid,
    actorUuid: typeof tokenDocument.actor?.uuid === "string" ? tokenDocument.actor.uuid : null,
    sceneId: typeof tokenDocument.parent?.id === "string" ? tokenDocument.parent.id : null,
    name: typeof tokenDocument.name === "string"
      ? tokenDocument.name
      : (typeof tokenDocument.actor?.name === "string" ? tokenDocument.actor.name : "")
  };
}

function getCurrentUserTargetSnapshots() {
  return Array.from(game?.user?.targets ?? [], (token) => createTokenSnapshot(token)).filter(Boolean);
}

async function resolveTokenDocumentFromSnapshot(snapshot) {
  if (!snapshot) {
    return null;
  }

  if (typeof snapshot.tokenUuid === "string" && snapshot.tokenUuid) {
    const tokenFromUuid = await fromUuid(snapshot.tokenUuid);

    if (tokenFromUuid) {
      return tokenFromUuid.document ?? tokenFromUuid;
    }
  }

  if (snapshot.sceneId && snapshot.tokenId) {
    return game.scenes?.get?.(snapshot.sceneId)?.tokens?.get?.(snapshot.tokenId) ?? null;
  }

  return null;
}

async function resolveContextDocuments(context) {
  const item = context?.itemUuid ? await fromUuid(context.itemUuid) : null;
  const actor = item?.actor ?? (context?.actorUuid ? await fromUuid(context.actorUuid) : null);
  const extraActivity = item?.system?.activities?.get?.(context?.extraActivityId) ?? null;

  return {
    item,
    actor,
    extraActivity
  };
}

function checkSingleTargetSupport(activity) {
  const templateType = activity?.target?.template?.type ?? "";

  if (templateType) {
    return {
      ok: false,
      reason: "template-targeting-not-supported",
      details: {
        templateType
      }
    };
  }

  const rawTargetCount = activity?.target?.affects?.count;
  const targetCount = normalizeNonNegativeInteger(rawTargetCount, 1) ?? 1;

  if (targetCount > 1) {
    return {
      ok: false,
      reason: "multi-target-extra-hit-not-supported",
      details: {
        targetCount
      }
    };
  }

  return {
    ok: true,
    targetCount: 1
  };
}

async function setUserTargetSnapshots(targetSnapshots) {
  const resolvedTokenDocuments = [];

  for (const snapshot of targetSnapshots) {
    const tokenDocument = await resolveTokenDocumentFromSnapshot(snapshot);

    if (tokenDocument) {
      resolvedTokenDocuments.push(tokenDocument);
    }
  }

  const tokenIds = resolvedTokenDocuments
    .map((tokenDocument) => tokenDocument.id)
    .filter((tokenId) => typeof tokenId === "string" && tokenId);

  if (typeof game?.user?.updateTokenTargets === "function") {
    await game.user.updateTokenTargets(tokenIds);
    return resolvedTokenDocuments;
  }

  for (const targetedToken of game?.user?.targets ?? []) {
    targetedToken.setTarget?.(false, {
      user: game.user,
      releaseOthers: false,
      groupSelection: true
    });
  }

  for (const tokenDocument of resolvedTokenDocuments) {
    const tokenObject = tokenDocument.object ?? tokenDocument;
    tokenObject.setTarget?.(true, {
      user: game.user,
      releaseOthers: false,
      groupSelection: true
    });
  }

  return resolvedTokenDocuments;
}

async function withTemporaryUserTargets(targetSnapshots, callback) {
  const previousTargets = getCurrentUserTargetSnapshots();

  await setUserTargetSnapshots(targetSnapshots);

  try {
    return await callback();
  } finally {
    await setUserTargetSnapshots(previousTargets);
  }
}

async function resolveFocusTargetSnapshot(context) {
  const initialTargets = Array.isArray(context?.initialTargets) ? context.initialTargets : [];

  if (!initialTargets.length) {
    return {
      ok: false,
      reason: "focus-target-missing",
      message: "No initial target is available for focus mode."
    };
  }

  if (initialTargets.length > 1) {
    return {
      ok: false,
      reason: "focus-target-ambiguous",
      message: "Focus mode requires exactly one initial target for extra hits.",
      details: {
        initialTargets
      }
    };
  }

  const tokenDocument = await resolveTokenDocumentFromSnapshot(initialTargets[0]);

  if (!tokenDocument) {
    return {
      ok: false,
      reason: "focus-target-unresolved",
      message: "The initial focus target could not be resolved anymore.",
      details: {
        initialTargets
      }
    };
  }

  return {
    ok: true,
    source: "context.initialTargets",
    target: createTokenSnapshot(tokenDocument)
  };
}

function resolveRetargetTargetSnapshot() {
  const currentTargets = getCurrentUserTargetSnapshots();

  if (!currentTargets.length) {
    return {
      ok: false,
      reason: "retarget-target-missing",
      message: "Select exactly one target before resolving the next extra hit."
    };
  }

  if (currentTargets.length > 1) {
    return {
      ok: false,
      reason: "retarget-target-ambiguous",
      message: "Only one target can be selected when resolving a single extra hit.",
      details: {
        currentTargets
      }
    };
  }

  return {
    ok: true,
    source: "game.user.targets",
    target: currentTargets[0]
  };
}

async function resolveTargetForContext(context) {
  switch (context?.targetingMode) {
    case "focus":
      return resolveFocusTargetSnapshot(context);
    case "retarget":
      return resolveRetargetTargetSnapshot();
    default:
      return {
        ok: false,
        reason: "unsupported-targeting-mode",
        message: `Unsupported targeting mode "${context?.targetingMode ?? "unknown"}" for phase 2B1.`
      };
  }
}

function getSpellSlotForContext(context, item) {
  if (typeof context?.spell?.slot === "string" && context.spell.slot) {
    return context.spell.slot;
  }

  if (typeof context?.spell?.slot === "number") {
    return context.spell.slot;
  }

  const castLevel = normalizeNonNegativeInteger(context?.castLevel, null);

  if (castLevel === null) {
    return null;
  }

  const spellcastingModel = CONFIG.DND5E.spellcasting?.[item?.system?.method];
  return spellcastingModel?.getSpellSlotKey?.(castLevel) ?? `spell${castLevel}`;
}

// Keep non-consumption options isolated so we can adjust dnd5e integration later without touching the executor flow.
function buildExtraHitUsageConfig(context, item, options = {}) {
  return {
    consume: false,
    create: false,
    concentration: {
      begin: false,
      end: false
    },
    scaling: normalizeNonNegativeInteger(context?.spell?.scaling, 0) ?? 0,
    spell: {
      slot: getSpellSlotForContext(context, item)
    },
    subsequentActions: options.subsequentActions ?? true,
    event: options.event,
    [MODULE_ID]: {
      isExtraHit: true,
      contextId: context.id
    }
  };
}

function buildExtraHitDialogConfig(options = {}) {
  return {
    configure: false,
    options: options.dialogOptions ?? {}
  };
}

function buildExtraHitMessageConfig(context, targetSnapshot, options = {}) {
  const extraHitIndex = Math.max(1, (context.extraHitsTotal - context.extraHitsRemaining) + 1);

  return {
    create: options.createMessage ?? true,
    data: {
      flags: {
        [MODULE_ID]: {
          extraHit: {
            contextId: context.id,
            extraHitIndex,
            target: cloneData(targetSnapshot)
          }
        }
      }
    }
  };
}

function buildFailureResult(contextId, context, reason, message, details = undefined) {
  if (message) {
    notifyWarn(message, details);
  } else if (details !== undefined) {
    warn(`Extra hit resolution failed: ${reason}.`, details);
  } else {
    warn(`Extra hit resolution failed: ${reason}.`);
  }

  return {
    ok: false,
    contextId,
    context,
    reason,
    message,
    details
  };
}

export function cancelCastContext(contextId) {
  const existingContext = getCastContext(contextId);
  const deleted = deleteCastContext(contextId);

  if (deleted) {
    notifyInfo("Extra hit context canceled.", {
      contextId
    });
  }

  return {
    ok: deleted,
    contextId,
    context: existingContext
  };
}

export async function resolveNextExtraHit(contextId, options = {}) {
  const context = getCastContext(contextId);

  if (!context) {
    return buildFailureResult(contextId, null, "missing-context", "The extra hit context no longer exists.");
  }

  if (!canCurrentUserManageContext(context)) {
    return buildFailureResult(
      contextId,
      context,
      "forbidden-user",
      "Only the user who created this cast context can resolve its extra hits."
    );
  }

  if (context.resolutionMode !== "manual") {
    return buildFailureResult(
      contextId,
      context,
      "unsupported-resolution-mode",
      `Resolution mode "${context.resolutionMode ?? "unknown"}" is not supported in phase 2B1.`
    );
  }

  if ((normalizeNonNegativeInteger(context.extraHitsRemaining, 0) ?? 0) <= 0) {
    deleteCastContext(contextId);
    return buildFailureResult(contextId, null, "no-extra-hits-remaining", "No extra hits remain for this cast context.");
  }

  const { item, actor, extraActivity } = await resolveContextDocuments(context);

  if (!item || !actor || !extraActivity) {
    return buildFailureResult(
      contextId,
      context,
      "missing-documents",
      "The spell item or extra activity could not be resolved for the extra hit.",
      {
        itemUuid: context.itemUuid,
        actorUuid: context.actorUuid,
        extraActivityId: context.extraActivityId
      }
    );
  }

  const targetSupport = checkSingleTargetSupport(extraActivity);

  if (!targetSupport.ok) {
    return buildFailureResult(
      contextId,
      context,
      targetSupport.reason,
      "Phase 2B1 only supports mono-target extra-hit activities.",
      {
        activity: summarizeActivity(extraActivity),
        ...targetSupport.details
      }
    );
  }

  const targetResolution = await resolveTargetForContext(context);

  if (!targetResolution.ok) {
    debug("Unable to resolve a valid target for the next extra hit.", {
      contextId,
      targetingMode: context.targetingMode,
      targetResolution
    });

    return buildFailureResult(
      contextId,
      context,
      targetResolution.reason,
      targetResolution.message,
      targetResolution.details
    );
  }

  const targetSnapshot = targetResolution.target;
  const usageConfig = buildExtraHitUsageConfig(context, item, options);
  const dialogConfig = buildExtraHitDialogConfig(options);
  const messageConfig = buildExtraHitMessageConfig(context, targetSnapshot, options);

  let results = null;

  if (context.targetingMode === "focus") {
    results = await withTemporaryUserTargets([targetSnapshot], async () => {
      return extraActivity.use(usageConfig, dialogConfig, messageConfig);
    });
  } else {
    results = await extraActivity.use(usageConfig, dialogConfig, messageConfig);
  }

  if (!results) {
    return buildFailureResult(
      contextId,
      context,
      "activity-use-cancelled",
      "The extra hit was not resolved because the dnd5e activity did not complete."
    );
  }

  const nextRemaining = Math.max(0, context.extraHitsRemaining - 1);
  const nextContext = nextRemaining > 0
    ? updateCastContext(contextId, {
      extraHitsRemaining: nextRemaining,
      lifecycle: {
        phase: "active",
        lastResolvedAt: new Date().toISOString(),
        lastResolvedTarget: cloneData(targetSnapshot)
      },
      lastResolvedTarget: cloneData(targetSnapshot),
      lastResolvedMessageId: typeof results?.message?.id === "string" ? results.message.id : null
    })
    : null;

  if (nextRemaining === 0) {
    deleteCastContext(contextId);
  }

  debug("Resolved one extra hit.", {
    contextId,
    targetingMode: context.targetingMode,
    targetSource: targetResolution.source,
    target: targetSnapshot,
    extraActivity: summarizeActivity(extraActivity),
    results: {
      messageId: typeof results?.message?.id === "string" ? results.message.id : null,
      messageUuid: typeof results?.message?.uuid === "string" ? results.message.uuid : null
    },
    nextRemaining
  });

  return {
    ok: true,
    contextId,
    context: nextContext,
    target: targetSnapshot,
    results,
    completed: nextRemaining === 0,
    remaining: nextRemaining
  };
}

export async function resolveRemainingExtraHits(contextId, options = {}) {
  const iterations = [];

  while (true) {
    const currentContext = getCastContext(contextId);

    if (!currentContext) {
      return {
        ok: true,
        contextId,
        context: null,
        iterations,
        completed: true
      };
    }

    const result = await resolveNextExtraHit(contextId, options);
    iterations.push(result);

    if (!result.ok) {
      return {
        ok: false,
        contextId,
        context: getCastContext(contextId),
        iterations,
        completed: false,
        reason: result.reason
      };
    }

    if (result.completed) {
      return {
        ok: true,
        contextId,
        context: null,
        iterations,
        completed: true
      };
    }
  }
}
