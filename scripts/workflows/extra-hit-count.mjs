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

function buildHitSummary({
  totalHits,
  mode,
  baseLevel,
  castLevel,
  fixedCount,
  scalingLevels,
  perLevel,
  countOnly,
  baseLevelSource = undefined
} = {}) {
  const normalizedTotalHits = Math.max(1, normalizeNonNegativeInteger(totalHits, 1) ?? 1);
  const legacyExtraHits = Math.max(0, normalizedTotalHits - 1);

  return {
    totalHits: normalizedTotalHits,
    extraHits: legacyExtraHits,
    mode,
    baseLevel,
    castLevel,
    fixedCount,
    scalingLevels,
    perLevel,
    countOnly,
    ...(baseLevelSource ? { baseLevelSource } : {})
  };
}

// The canonical result is now a pool of total hits.
// `extraHits` remains as a legacy alias so existing configs and console calls stay usable.
export function computeExtraHitCount({
  item = null,
  spellConfig = null,
  castLevel = null
} = {}) {
  const config = normalizeSpellConfig(spellConfig ?? createSpellConfig());
  const normalizedCastLevel = normalizeNonNegativeInteger(castLevel, null);
  const fixedCount = normalizeNonNegativeInteger(config.fixedCount, 0);

  if (config.countMode === COUNT_MODES.FIXED) {
    return buildHitSummary({
      totalHits: 1 + fixedCount,
      mode: config.countMode,
      baseLevel: null,
      castLevel: normalizedCastLevel,
      fixedCount,
      scalingLevels: 0,
      perLevel: 0,
      countOnly: Boolean(config.slotScaling?.countOnly)
    });
  }

  const { value: baseLevel, source: baseLevelSource } = resolveBaseLevel(item, config, normalizedCastLevel);
  const effectiveCastLevel = normalizedCastLevel ?? normalizeNonNegativeInteger(item?.system?.level, 0);
  const perLevel = normalizeNonNegativeInteger(config.slotScaling?.perLevel, 0);
  const scalingLevels = Math.max(0, effectiveCastLevel - (baseLevel ?? effectiveCastLevel));
  const configuredHitBonus = fixedCount + (scalingLevels * perLevel);

  return buildHitSummary({
    totalHits: 1 + configuredHitBonus,
    mode: config.countMode,
    baseLevel,
    castLevel: effectiveCastLevel,
    baseLevelSource,
    scalingLevels,
    perLevel,
    fixedCount,
    countOnly: Boolean(config.slotScaling?.countOnly)
  });
}

export const calculateExtraHitCount = computeExtraHitCount;
