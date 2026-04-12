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
  results = {},
  userId = null,
  createdFrom = "runtime"
} = {}) {
  clearExpiredCastContexts();

  const extraHitsTotal = normalizeNonNegativeInteger(extraHitSummary?.extraHits, 0);

  if (extraHitsTotal <= 0) {
    return null;
  }

  const createdAtMs = Date.now();
  const itemLevel = normalizeNonNegativeInteger(item?.system?.level, null);
  const tokenDocument = token?.document ?? token ?? null;
  const castLevel = normalizeNonNegativeInteger(
    spellLevel ?? extraHitSummary?.castLevel,
    itemLevel
  );
  const baseActivityId = (typeof spellConfig?.baseActivityId === "string" && spellConfig.baseActivityId.trim())
    ? spellConfig.baseActivityId.trim()
    : (typeof activity?.id === "string" ? activity.id : null);
  const extraActivityId = (typeof spellConfig?.extraActivityId === "string" && spellConfig.extraActivityId.trim())
    ? spellConfig.extraActivityId.trim()
    : null;
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
    baseActivityId,
    extraActivityId,
    castLevel,
    extraHitsTotal,
    extraHitsRemaining: extraHitsTotal,
    targetingMode: typeof spellConfig?.targetingMode === "string" ? spellConfig.targetingMode : null,
    resolutionMode: typeof spellConfig?.resolutionMode === "string" ? spellConfig.resolutionMode : null,
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
    extraHits: cloneData(extraHitSummary ?? { extraHits: 0 }),
    results: {
      messageId: typeof results?.message?.id === "string" ? results.message.id : null,
      messageUuid: typeof results?.message?.uuid === "string" ? results.message.uuid : null,
      templateCount: Array.isArray(results?.templates) ? results.templates.length : 0,
      effectCount: Array.isArray(results?.effects) ? results.effects.length : 0
    }
  };

  ACTIVE_CAST_CONTEXTS.set(context.id, context);

  return cloneData(context);
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
