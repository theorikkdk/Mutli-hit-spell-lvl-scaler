const ACTIVE_CAST_CONTEXTS = new Map();
const CAST_CONTEXT_TTL_MS = 15 * 60 * 1000;

function cloneData(data) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(data);
  }

  return JSON.parse(JSON.stringify(data));
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

function createContextId() {
  return foundry?.utils?.randomID?.()
    ?? globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function mergeData(target, source) {
  if (foundry?.utils?.mergeObject) {
    return foundry.utils.mergeObject(target, source, {
      inplace: false,
      insertKeys: true,
      insertValues: true,
      overwrite: true,
      recursive: true
    });
  }

  return {
    ...target,
    ...source
  };
}

function summarizeDocument(document, fallbackType = "document") {
  if (!document) {
    return null;
  }

  return {
    id: typeof document.id === "string" ? document.id : null,
    uuid: typeof document.uuid === "string" ? document.uuid : null,
    name: typeof document.name === "string" ? document.name : "",
    type: typeof document.type === "string" ? document.type : fallbackType
  };
}

function summarizeToken(token) {
  const tokenDocument = token?.document ?? token;

  if (!tokenDocument) {
    return null;
  }

  return {
    id: typeof tokenDocument.id === "string" ? tokenDocument.id : null,
    uuid: typeof tokenDocument.uuid === "string" ? tokenDocument.uuid : null,
    name: typeof tokenDocument.name === "string" ? tokenDocument.name : "",
    sceneId: typeof tokenDocument.parent?.id === "string" ? tokenDocument.parent.id : null,
    sceneName: typeof tokenDocument.parent?.name === "string" ? tokenDocument.parent.name : ""
  };
}

function normalizeContextState(context = {}) {
  const hitActivityId = typeof context.hitActivityId === "string" && context.hitActivityId
    ? context.hitActivityId
    : (typeof context.extraActivityId === "string" && context.extraActivityId)
      ? context.extraActivityId
      : (typeof context.baseActivityId === "string" && context.baseActivityId)
        ? context.baseActivityId
        : null;
  const totalHits = Math.max(
    1,
    normalizeNonNegativeInteger(
      context.totalHits ?? context.extraHitsTotal,
      1
    ) ?? 1
  );
  const hitsRemaining = Math.min(
    totalHits,
    Math.max(
      0,
      normalizeNonNegativeInteger(
        context.hitsRemaining ?? context.extraHitsRemaining,
        totalHits
      ) ?? totalHits
    )
  );

  return {
    ...context,
    hitActivityId,
    baseActivityId: hitActivityId,
    extraActivityId: hitActivityId,
    totalHits,
    hitsRemaining,
    hitsResolved: Math.max(0, totalHits - hitsRemaining),
    extraHitsTotal: totalHits,
    extraHitsRemaining: hitsRemaining
  };
}

export function clearExpiredCastContexts(now = Date.now()) {
  let removedCount = 0;

  for (const [contextId, context] of ACTIVE_CAST_CONTEXTS.entries()) {
    if ((context.expiresAtMs ?? 0) > now) {
      continue;
    }

    ACTIVE_CAST_CONTEXTS.delete(contextId);
    removedCount += 1;
  }

  return removedCount;
}

// Contexts remain runtime-only and expire automatically to keep phase 2A observable but disposable.
export function createCastContext({
  activity = null,
  actor = null,
  item = null,
  token = null,
  spellConfig = {},
  usageConfig = {},
  spellLevel = null,
  extraHitSummary = {},
  resolvedHitCount = 1,
  results = {},
  userId = null,
  createdFrom = "runtime"
} = {}) {
  clearExpiredCastContexts();

  const totalHits = Math.max(1, normalizeNonNegativeInteger(extraHitSummary?.totalHits, 1) ?? 1);
  const normalizedResolvedHitCount = Math.min(
    totalHits,
    Math.max(0, normalizeNonNegativeInteger(resolvedHitCount, 0) ?? 0)
  );
  const hitsRemaining = Math.max(0, totalHits - normalizedResolvedHitCount);

  if (hitsRemaining <= 0) {
    return null;
  }

  const createdAtMs = Date.now();
  const itemLevel = normalizeNonNegativeInteger(item?.system?.level, null);
  const tokenDocument = token?.document ?? token ?? null;
  const castLevel = normalizeNonNegativeInteger(
    spellLevel ?? extraHitSummary?.castLevel,
    itemLevel
  );
  const hitActivityId = (typeof spellConfig?.hitActivityId === "string" && spellConfig.hitActivityId.trim())
    ? spellConfig.hitActivityId.trim()
    : (typeof spellConfig?.extraActivityId === "string" && spellConfig.extraActivityId.trim())
      ? spellConfig.extraActivityId.trim()
      : (typeof spellConfig?.baseActivityId === "string" && spellConfig.baseActivityId.trim())
        ? spellConfig.baseActivityId.trim()
        : (typeof activity?.id === "string" ? activity.id : null);
  const resolvedUserId = (typeof userId === "string" && userId)
    ? userId
    : (typeof game?.user?.id === "string" ? game.user.id : null);

  const context = {
    id: createContextId(),
    createdAt: new Date(createdAtMs).toISOString(),
    createdAtMs,
    expiresAtMs: createdAtMs + CAST_CONTEXT_TTL_MS,
    createdFrom,
    itemUuid: typeof item?.uuid === "string" ? item.uuid : null,
    actorUuid: typeof actor?.uuid === "string" ? actor.uuid : null,
    tokenUuid: typeof tokenDocument?.uuid === "string" ? tokenDocument.uuid : null,
    hitActivityId,
    baseActivityId: hitActivityId,
    extraActivityId: hitActivityId,
    castLevel,
    totalHits,
    hitsResolved: normalizedResolvedHitCount,
    hitsRemaining,
    extraHitsTotal: totalHits,
    extraHitsRemaining: hitsRemaining,
    resolutionMode: typeof spellConfig?.resolutionMode === "string" ? spellConfig.resolutionMode : "manual",
    userId: resolvedUserId,
    lifecycle: {
      phase: "detected"
    },
    item: summarizeDocument(item, "item"),
    activity: summarizeDocument(activity, "activity"),
    actor: summarizeDocument(actor, "actor"),
    token: summarizeToken(token),
    spell: {
      itemLevel,
      castLevel,
      slot: usageConfig?.spell?.slot ?? null,
      scaling: normalizeNonNegativeInteger(usageConfig?.scaling, 0)
    },
    spellConfig: cloneData(spellConfig ?? {}),
    usage: cloneData({
      spell: usageConfig?.spell ?? null,
      scaling: usageConfig?.scaling ?? null,
      consume: usageConfig?.consume ?? null,
      concentration: usageConfig?.concentration ?? null
    }),
    extraHits: cloneData({
      ...(extraHitSummary ?? {}),
      totalHits,
      hitsResolved: normalizedResolvedHitCount,
      hitsRemaining,
      extraHits: Math.max(0, totalHits - 1)
    }),
    results: {
      messageId: typeof results?.message?.id === "string" ? results.message.id : null,
      messageUuid: typeof results?.message?.uuid === "string" ? results.message.uuid : null,
      templateCount: Array.isArray(results?.templates) ? results.templates.length : 0,
      effectCount: Array.isArray(results?.effects) ? results.effects.length : 0
    }
  };

  const normalizedContext = normalizeContextState(context);
  ACTIVE_CAST_CONTEXTS.set(normalizedContext.id, normalizedContext);

  return cloneData(normalizedContext);
}

export function updateCastContext(contextId, changes = {}) {
  if (!contextId) {
    return null;
  }

  clearExpiredCastContexts();

  const existingContext = ACTIVE_CAST_CONTEXTS.get(contextId);

  if (!existingContext) {
    return null;
  }

  const nextContext = normalizeContextState(
    mergeData(cloneData(existingContext), cloneData(changes ?? {}))
  );
  ACTIVE_CAST_CONTEXTS.set(contextId, nextContext);

  return cloneData(nextContext);
}

export function getCastContext(contextId) {
  if (!contextId) {
    return null;
  }

  clearExpiredCastContexts();

  const context = ACTIVE_CAST_CONTEXTS.get(contextId);
  return context ? cloneData(context) : null;
}

export function listCastContexts() {
  clearExpiredCastContexts();
  return Array.from(ACTIVE_CAST_CONTEXTS.values(), (context) => cloneData(context));
}

export function deleteCastContext(contextId) {
  return ACTIVE_CAST_CONTEXTS.delete(contextId);
}
