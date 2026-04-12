import {
  COUNT_MODES,
  createSpellConfig,
  normalizeSpellConfig
} from "../module.mjs";

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

function resolveBaseLevel(item, spellConfig, castLevel) {
  const configuredBaseLevel = normalizeNonNegativeInteger(spellConfig?.slotScaling?.baseLevel, null);

  if (configuredBaseLevel !== null) {
    return {
      value: configuredBaseLevel,
      source: "config.slotScaling.baseLevel"
    };
  }

  const itemLevel = normalizeNonNegativeInteger(item?.system?.level, null);

  if (itemLevel !== null) {
    return {
      value: itemLevel,
      source: "item.system.level"
    };
  }

  return {
    value: normalizeNonNegativeInteger(castLevel, 0),
    source: "castLevel fallback"
  };
}

// Counts are expressed as extra hits after the base activity has already resolved normally.
// In slot-scaling mode, fixedCount acts as the baseline amount before per-slot increases are added.
export function computeExtraHitCount({
  item = null,
  spellConfig = null,
  castLevel = null
} = {}) {
  const config = normalizeSpellConfig(spellConfig ?? createSpellConfig());
  const normalizedCastLevel = normalizeNonNegativeInteger(castLevel, null);
  const fixedCount = normalizeNonNegativeInteger(config.fixedCount, 0);
  const baseHits = 1;

  if (config.countMode === COUNT_MODES.FIXED) {
    const extraHits = fixedCount;

    return {
      extraHits,
      totalHits: baseHits + extraHits,
      baseHits,
      mode: config.countMode,
      baseLevel: null,
      castLevel: normalizedCastLevel,
      fixedCount,
      scalingLevels: 0,
      perLevel: 0,
      countOnly: Boolean(config.slotScaling?.countOnly)
    };
  }

  const { value: baseLevel, source: baseLevelSource } = resolveBaseLevel(item, config, normalizedCastLevel);
  const effectiveCastLevel = normalizedCastLevel ?? normalizeNonNegativeInteger(item?.system?.level, 0);
  const perLevel = normalizeNonNegativeInteger(config.slotScaling?.perLevel, 0);
  const scalingLevels = Math.max(0, effectiveCastLevel - (baseLevel ?? effectiveCastLevel));
  const extraHits = fixedCount + (scalingLevels * perLevel);

  return {
    extraHits,
    totalHits: baseHits + extraHits,
    baseHits,
    mode: config.countMode,
    baseLevel,
    castLevel: effectiveCastLevel,
    baseLevelSource,
    scalingLevels,
    perLevel,
    fixedCount,
    countOnly: Boolean(config.slotScaling?.countOnly)
  };
}

export const calculateExtraHitCount = computeExtraHitCount;
