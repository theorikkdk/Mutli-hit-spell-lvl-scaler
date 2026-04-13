import { createSpellConfig, normalizeSpellConfig } from "../module.mjs";

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
  const configuredBaseLevel = normalizeNonNegativeInteger(spellConfig?.baseLevel, null);

  if (configuredBaseLevel !== null) {
    return {
      value: configuredBaseLevel,
      source: "config.baseLevel"
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
  baseTotalHits,
  hitsPerSlotLevel,
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
    baseTotalHits,
    hitsPerSlotLevel,
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
  const { value: baseLevel, source: baseLevelSource } = resolveBaseLevel(item, config, normalizedCastLevel);
  const effectiveCastLevel = normalizedCastLevel ?? normalizeNonNegativeInteger(item?.system?.level, 0);
  const baseTotalHits = Math.max(1, normalizeNonNegativeInteger(config.baseTotalHits, 1) ?? 1);
  const perLevel = normalizeNonNegativeInteger(config.hitsPerSlotLevel, 0);
  const scalingLevels = Math.max(0, effectiveCastLevel - (baseLevel ?? effectiveCastLevel));
  const totalHits = Math.max(1, baseTotalHits + (scalingLevels * perLevel));

  return buildHitSummary({
    totalHits,
    mode: "total-hit-pool",
    baseLevel,
    castLevel: effectiveCastLevel,
    baseTotalHits,
    hitsPerSlotLevel: perLevel,
    baseLevelSource,
    scalingLevels,
    perLevel,
    fixedCount: Math.max(0, baseTotalHits - 1),
    countOnly: false
  });
}

export const calculateExtraHitCount = computeExtraHitCount;
