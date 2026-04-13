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

function getContextTotalHits(context) {
  return Math.max(
    1,
    normalizeNonNegativeInteger(
      context?.totalHits ?? context?.extraHitsTotal,
      1
    ) ?? 1
  );
}

function getContextHitsRemaining(context) {
  return Math.min(
    getContextTotalHits(context),
    Math.max(
      0,
      normalizeNonNegativeInteger(
        context?.hitsRemaining ?? context?.extraHitsRemaining,
        0
      ) ?? 0
    )
  );
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

function getCurrentCanvasSceneId() {
  return canvas?.scene?.id ?? null;
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

async function applyUserTargetSnapshots(targetSnapshots = []) {
  const snapshots = Array.isArray(targetSnapshots) ? targetSnapshots : [];
  const activeSceneId = getCurrentCanvasSceneId();

  for (const snapshot of snapshots) {
    if (!snapshot?.tokenId) {
      return {
        ok: false,
        reason: "selected-target-unresolved",
        message: "A selected target could not be resolved anymore.",
        details: {
          targetSnapshot: snapshot
        }
      };
    }

    if (activeSceneId && snapshot.sceneId && (snapshot.sceneId !== activeSceneId)) {
      return {
        ok: false,
        reason: "selected-target-off-scene",
        message: "The selected target is not on the active scene anymore.",
        details: {
          activeSceneId,
          targetSnapshot: snapshot
        }
      };
    }
  }

  if (typeof game?.user?.updateTokenTargets === "function") {
    await game.user.updateTokenTargets(snapshots.map((snapshot) => snapshot.tokenId));

    return {
      ok: true,
      source: "game.user.updateTokenTargets"
    };
  }

  const currentTargets = Array.from(game?.user?.targets ?? []);

  for (const token of currentTargets) {
    if (typeof token?.setTarget === "function") {
      token.setTarget(false, {
        user: game.user,
        releaseOthers: false,
        groupSelection: true
      });
    }
  }

  for (const [index, snapshot] of snapshots.entries()) {
    const tokenDocument = await resolveTokenDocumentFromSnapshot(snapshot);
    const tokenObject = tokenDocument?.object ?? tokenDocument ?? null;

    if (typeof tokenObject?.setTarget !== "function") {
      return {
        ok: false,
        reason: "selected-target-unresolved",
        message: "A selected target could not be resolved anymore.",
        details: {
          targetSnapshot: snapshot
        }
      };
    }

    tokenObject.setTarget(true, {
      user: game.user,
      releaseOthers: index === 0,
      groupSelection: true
    });
  }

  return {
    ok: true,
    source: "token.setTarget"
  };
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

function resolveSelectedTargetSnapshot() {
  const currentTargets = getCurrentUserTargetSnapshots();

  if (!currentTargets.length) {
    return {
      ok: false,
      reason: "selected-target-missing",
      message: "Select exactly one target before resolving the next extra hit."
    };
  }

  if (currentTargets.length > 1) {
    return {
      ok: false,
      reason: "selected-target-ambiguous",
      message: "Only one target can be selected when resolving a single extra hit.",
      details: {
        currentTargets
      }
    };
  }

  return {
    ok: true,
    source: "game.user.targets.current",
    target: currentTargets[0]
  };
}

async function resolveTargetForExtraHit(options = {}) {
  if (options.targetSnapshot) {
    const tokenDocument = await resolveTokenDocumentFromSnapshot(options.targetSnapshot);

    if (!tokenDocument) {
      return {
        ok: false,
        reason: "selected-target-unresolved",
        message: "The selected target could not be resolved anymore.",
        details: {
          targetSnapshot: options.targetSnapshot
        }
      };
    }

    return {
      ok: true,
      source: "options.targetSnapshot",
      target: createTokenSnapshot(tokenDocument)
    };
  }

  return resolveSelectedTargetSnapshot();
}

function resolveTargetSnapshotsForRemainingExtraHits(context, options = {}) {
  const remaining = getContextHitsRemaining(context);
  const currentTargets = getCurrentUserTargetSnapshots().map((snapshot) => cloneData(snapshot));

  if (Array.isArray(options.targetSnapshots) && options.targetSnapshots.length) {
    const targets = options.targetSnapshots.map((snapshot) => cloneData(snapshot));

    if (targets.length === 1) {
      return {
        ok: true,
        source: "options.targetSnapshots.repeat",
        targets: Array.from({ length: remaining }, () => cloneData(targets[0])),
        restoreTargetSnapshots: currentTargets,
        distribution: "repeat-single"
      };
    }

    if (targets.length > remaining) {
      return {
        ok: false,
        reason: "selected-targets-exceed-remaining",
        message: `You selected ${targets.length} targets but only ${remaining} hit(s) remain. Reduce your selection and try again.`,
        details: {
          selectedCount: targets.length,
          remaining
        }
      };
    }

    return {
      ok: true,
      source: "options.targetSnapshots.sequence",
      targets,
      restoreTargetSnapshots: currentTargets,
      distribution: "one-per-target",
      selectedCount: targets.length
    };
  }

  if (options.targetSnapshot) {
    return {
      ok: true,
      source: "options.targetSnapshot.repeat",
      targets: Array.from({ length: remaining }, () => cloneData(options.targetSnapshot)),
      restoreTargetSnapshots: currentTargets,
      distribution: "repeat-single"
    };
  }

  if (!currentTargets.length) {
    return {
      ok: false,
      reason: "selected-target-missing",
      message: "Select at least one target before resolving remaining extra hits."
    };
  }

  if (currentTargets.length === 1) {
    return {
      ok: true,
      source: "game.user.targets.current.single",
      targets: Array.from({ length: remaining }, () => cloneData(currentTargets[0])),
      restoreTargetSnapshots: currentTargets,
      distribution: "repeat-single"
    };
  }

  if (currentTargets.length > remaining) {
    return {
      ok: false,
      reason: "selected-targets-exceed-remaining",
      message: `You selected ${currentTargets.length} targets but only ${remaining} hit(s) remain. Reduce your selection and try again.`,
      details: {
        selectedCount: currentTargets.length,
        remaining
      }
    };
  }

  return {
    ok: true,
    source: "game.user.targets.current.multiple",
    targets: currentTargets,
    restoreTargetSnapshots: currentTargets,
    distribution: "one-per-target",
    selectedCount: currentTargets.length
  };
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
  const totalHits = getContextTotalHits(context);
  const hitsRemaining = getContextHitsRemaining(context);
  const hitIndex = Math.max(1, (totalHits - hitsRemaining) + 1);

  return {
    create: options.createMessage ?? true,
    data: {
      flags: {
        [MODULE_ID]: {
          extraHit: {
            contextId: context.id,
            hitIndex,
            extraHitIndex: hitIndex,
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

async function useExtraActivityForTarget(context, item, extraActivity, targetSnapshot, options = {}) {
  const restoreTargetSnapshots = Array.isArray(options.restoreTargetSnapshots)
    ? options.restoreTargetSnapshots.map((snapshot) => cloneData(snapshot))
    : getCurrentUserTargetSnapshots().map((snapshot) => cloneData(snapshot));
  const selectionResult = await applyUserTargetSnapshots([targetSnapshot]);

  if (!selectionResult.ok) {
    return selectionResult;
  }

  try {
    const usageConfig = buildExtraHitUsageConfig(context, item, options);
    const dialogConfig = buildExtraHitDialogConfig(options);
    const messageConfig = buildExtraHitMessageConfig(context, targetSnapshot, options);
    const results = await extraActivity.use(usageConfig, dialogConfig, messageConfig);

    return {
      ok: true,
      results
    };
  } finally {
    const restoreResult = await applyUserTargetSnapshots(restoreTargetSnapshots);

    if (!restoreResult.ok) {
      debug("Unable to restore user target selection after extra hit resolution.", {
        contextId: context?.id ?? null,
        restoreTargetSnapshots,
        restoreResult
      });
    }
  }
}

export function cancelCastContext(contextId) {
  const existingContext = getCastContext(contextId);
  const deleted = deleteCastContext(contextId);

  if (deleted) {
    notifyInfo("Cast context canceled.", {
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

  if (getContextHitsRemaining(context) <= 0) {
    deleteCastContext(contextId);
    return buildFailureResult(contextId, null, "no-hits-remaining", "No hits remain for this cast context.");
  }

  const { item, actor, extraActivity } = await resolveContextDocuments(context);

  if (!item || !actor || !extraActivity) {
    return buildFailureResult(
      contextId,
      context,
      "missing-documents",
      "The spell item or hit activity could not be resolved for this cast context.",
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
      "This module currently supports only mono-target hit activities.",
      {
        activity: summarizeActivity(extraActivity),
        ...targetSupport.details
      }
    );
  }

  const targetResolution = await resolveTargetForExtraHit(options);

  if (!targetResolution.ok) {
    debug("Unable to resolve a valid target for the next extra hit.", {
      contextId,
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
  const useResult = await useExtraActivityForTarget(context, item, extraActivity, targetSnapshot, options);

  if (!useResult.ok) {
    debug("Unable to apply the temporary target selection for the next extra hit.", {
      contextId,
      useResult
    });

    return buildFailureResult(
      contextId,
      context,
      useResult.reason,
      useResult.message,
      useResult.details
    );
  }

  const { results } = useResult;

  if (!results) {
    return buildFailureResult(
      contextId,
      context,
      "activity-use-cancelled",
      "The extra hit was not resolved because the dnd5e activity did not complete."
    );
  }

  const nextRemaining = Math.max(0, getContextHitsRemaining(context) - 1);
  const nextContext = nextRemaining > 0
    ? updateCastContext(contextId, {
      hitsRemaining: nextRemaining,
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

  if (getContextHitsRemaining(context) <= 0) {
    deleteCastContext(contextId);
    return buildFailureResult(contextId, null, "no-hits-remaining", "No hits remain for this cast context.");
  }

  const targetSequence = resolveTargetSnapshotsForRemainingExtraHits(context, options);

  if (!targetSequence.ok) {
    debug("Unable to resolve valid targets for resolving remaining extra hits.", {
      contextId,
      targetSequence
    });

    const failure = buildFailureResult(
      contextId,
      context,
      targetSequence.reason,
      targetSequence.message,
      targetSequence.details
    );

    return {
      ...failure,
      iterations,
      completed: false
    };
  }

  debug("Resolving remaining extra hits with a prepared target sequence.", {
    contextId,
    distribution: targetSequence.distribution,
    source: targetSequence.source,
    selectedCount: targetSequence.selectedCount ?? targetSequence.targets.length,
    resolvedCount: targetSequence.targets.length,
    limited: false
  });

  for (const targetSnapshot of targetSequence.targets) {
    const result = await resolveNextExtraHit(contextId, {
      ...options,
      targetSnapshot,
      restoreTargetSnapshots: targetSequence.restoreTargetSnapshots
    });
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
      break;
    }
  }

  const currentContext = getCastContext(contextId);

  return {
    ok: true,
    contextId,
    context: currentContext,
    iterations,
    completed: !currentContext
  };
}
