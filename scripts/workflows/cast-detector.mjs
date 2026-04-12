import { debug, getSpellConfig, isSpellConfigEnabled } from "../module.mjs";
import { createCastContext } from "../runtime/cast-context.mjs";
import { computeExtraHitCount } from "./extra-hit-count.mjs";

const CAST_DETECTOR_HOOK = "dnd5e.postUseActivity";

let castDetectorRegistered = false;

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

function resolveActor(activity, results) {
  const speaker = results?.message?.speaker ?? null;

  if (speaker?.actor) {
    const actorFromSpeaker = game.actors?.get?.(speaker.actor) ?? null;

    if (actorFromSpeaker) {
      return {
        actor: actorFromSpeaker,
        source: "message.speaker.actor"
      };
    }
  }

  if (speaker?.scene && speaker?.token) {
    const tokenDocument = game.scenes?.get?.(speaker.scene)?.tokens?.get?.(speaker.token) ?? null;

    if (tokenDocument?.actor) {
      return {
        actor: tokenDocument.actor,
        source: "message.speaker.token.actor"
      };
    }
  }

  if (activity?.actor) {
    return {
      actor: activity.actor,
      source: "activity.actor"
    };
  }

  if (activity?.item?.actor) {
    return {
      actor: activity.item.actor,
      source: "activity.item.actor"
    };
  }

  return {
    actor: null,
    source: "unresolved"
  };
}

function resolveToken(activity, actor, results) {
  const speaker = results?.message?.speaker ?? null;

  if (speaker?.scene && speaker?.token) {
    const tokenDocument = game.scenes?.get?.(speaker.scene)?.tokens?.get?.(speaker.token) ?? null;

    if (tokenDocument?.object) {
      return {
        token: tokenDocument.object,
        source: "message.speaker.token.object"
      };
    }

    if (tokenDocument) {
      return {
        token: tokenDocument,
        source: "message.speaker.token.document"
      };
    }
  }

  const activeToken = actor?.getActiveTokens?.()?.[0] ?? null;

  if (activeToken) {
    return {
      token: activeToken,
      source: "actor.getActiveTokens()[0]"
    };
  }

  if (actor?.token) {
    return {
      token: actor.token,
      source: "actor.token"
    };
  }

  if (activity?.token) {
    return {
      token: activity.token,
      source: "activity.token"
    };
  }

  return {
    token: null,
    source: "unresolved"
  };
}

function resolveItem(activity, actor) {
  return actor?.items?.get?.(activity?.item?.id)
    ?? activity?.item
    ?? null;
}

function resolveActivity(activity, item) {
  return item?.system?.activities?.get?.(activity?.id)
    ?? activity
    ?? null;
}

function resolveSpellLevel(activity, item, actor, usageConfig, results) {
  const messageSpellLevel = normalizeNonNegativeInteger(
    results?.message?.flags?.dnd5e?.use?.spellLevel
      ?? results?.message?.data?.flags?.dnd5e?.use?.spellLevel,
    null
  );

  if (messageSpellLevel !== null) {
    return {
      value: messageSpellLevel,
      source: "message.flags.dnd5e.use.spellLevel"
    };
  }

  const spellSlot = usageConfig?.spell?.slot;

  if (typeof spellSlot === "number") {
    return {
      value: normalizeNonNegativeInteger(spellSlot, null),
      source: "usageConfig.spell.slot:number"
    };
  }

  if (typeof spellSlot === "string" && spellSlot) {
    const actorSpellLevel = normalizeNonNegativeInteger(actor?.system?.spells?.[spellSlot]?.level, null);

    if (actorSpellLevel !== null) {
      return {
        value: actorSpellLevel,
        source: `actor.system.spells.${spellSlot}.level`
      };
    }

    const parsedLevel = normalizeNonNegativeInteger(spellSlot.match(/\d+/)?.[0], null);

    if (parsedLevel !== null) {
      return {
        value: parsedLevel,
        source: "usageConfig.spell.slot:string"
      };
    }
  }

  const itemLevel = normalizeNonNegativeInteger(item?.system?.level, null);
  const scaling = normalizeNonNegativeInteger(usageConfig?.scaling, null);

  if ((itemLevel !== null) && (scaling !== null)) {
    return {
      value: itemLevel + scaling,
      source: "item.system.level + usageConfig.scaling"
    };
  }

  if (itemLevel !== null) {
    return {
      value: itemLevel,
      source: "item.system.level"
    };
  }

  const activityLevel = normalizeNonNegativeInteger(activity?.spell?.level, null);

  if (activityLevel !== null) {
    return {
      value: activityLevel,
      source: "activity.spell.level"
    };
  }

  return {
    value: null,
    source: "unresolved"
  };
}

function shouldHandleActivity(item, activity, spellConfig) {
  if (!item || item.type !== "spell") {
    return false;
  }

  if (!spellConfig?.enabled) {
    return false;
  }

  if (spellConfig.baseActivityId && (activity?.id !== spellConfig.baseActivityId)) {
    return false;
  }

  return true;
}

function resolveUserId(results) {
  const messageUser = results?.message?.user;

  if (typeof messageUser === "string" && messageUser) {
    return messageUser;
  }

  if (typeof messageUser?.id === "string" && messageUser.id) {
    return messageUser.id;
  }

  if (typeof game?.user?.id === "string" && game.user.id) {
    return game.user.id;
  }

  return null;
}

function onPostUseActivity(activity, usageConfig = {}, results = {}) {
  const actorResolution = resolveActor(activity, results);
  const item = resolveItem(activity, actorResolution.actor);
  const spellConfig = item ? getSpellConfig(item) : null;

  if (!isSpellConfigEnabled(item)) {
    return;
  }

  if (spellConfig?.baseActivityId && (activity?.id !== spellConfig.baseActivityId)) {
    debug("Skipping configured spell cast because the used activity does not match baseActivityId.", {
      item: summarizeDocument(item, "item"),
      activity: summarizeDocument(activity, "activity"),
      configuredBaseActivityId: spellConfig.baseActivityId
    });
    return;
  }

  if (!shouldHandleActivity(item, activity, spellConfig)) {
    return;
  }

  const resolvedActivity = resolveActivity(activity, item);
  const tokenResolution = resolveToken(resolvedActivity, actorResolution.actor, results);
  const spellLevel = resolveSpellLevel(resolvedActivity, item, actorResolution.actor, usageConfig, results);
  const extraHitSummary = computeExtraHitCount({
    item,
    spellConfig,
    castLevel: spellLevel.value
  });

  if (extraHitSummary.extraHits <= 0) {
    debug("Skipping configured spell cast because it produces no extra hits.", {
      item: summarizeDocument(item, "item"),
      activity: summarizeDocument(resolvedActivity, "activity"),
      extraHitSummary
    });
    return;
  }

  const castContext = createCastContext({
    activity: resolvedActivity,
    actor: actorResolution.actor,
    item,
    token: tokenResolution.token,
    spellConfig,
    usageConfig,
    spellLevel: spellLevel.value,
    extraHitSummary,
    results,
    userId: resolveUserId(results),
    createdFrom: CAST_DETECTOR_HOOK
  });

  if (!castContext) {
    return;
  }

  debug("Detected configured spell cast.", {
    hook: CAST_DETECTOR_HOOK,
    contextId: castContext.id,
    item: summarizeDocument(item, "item"),
    activity: summarizeDocument(resolvedActivity, "activity"),
    actor: summarizeDocument(actorResolution.actor, "actor"),
    actorSource: actorResolution.source,
    token: summarizeToken(tokenResolution.token),
    tokenSource: tokenResolution.source,
    spellLevel,
    extraHits: extraHitSummary,
    spellConfig,
    message: {
      id: typeof results?.message?.id === "string" ? results.message.id : null,
      uuid: typeof results?.message?.uuid === "string" ? results.message.uuid : null
    },
    castContext
  });
}

// Observe finalized activity usage rather than altering dnd5e execution before we need to.
export function registerCastDetector() {
  if (castDetectorRegistered) {
    return false;
  }

  Hooks.on(CAST_DETECTOR_HOOK, onPostUseActivity);
  castDetectorRegistered = true;

  debug("Registered cast detector hook.", {
    hook: CAST_DETECTOR_HOOK
  });

  return true;
}
