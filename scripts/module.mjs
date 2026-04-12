import {
  clearExpiredCastContexts,
  deleteCastContext,
  listCastContexts,
  getCastContext,
  createCastContext
} from "./runtime/cast-context.mjs";
import { computeExtraHitCount } from "./workflows/extra-hit-count.mjs";
import {
  cancelCastContext,
  resolveNextExtraHit,
  resolveRemainingExtraHits
} from "./workflows/extra-hit-executor.mjs";

export const MODULE_ID = "multi-hit-spell-lvl-scaler";
export const MODULE_TITLE = "Multi-Hit Spell Level Scaler";
export const LOCALIZATION_ROOT = "MULTI_HIT_SPELL_LVL_SCALER";

export const SETTINGS = Object.freeze({
  DEBUG: "debug"
});

export const FLAG_KEY = "spellConfig";
export const FLAG_PATH = `flags.${MODULE_ID}.${FLAG_KEY}`;

export const COUNT_MODES = Object.freeze({
  FIXED: "fixed",
  SLOT_SCALING: "slot-scaling"
});

export const TARGETING_MODES = Object.freeze({
  RETARGET: "retarget",
  FOCUS: "focus"
});

export const RESOLUTION_MODES = Object.freeze({
  MANUAL: "manual",
  AUTO: "auto"
});

export const DEFAULT_SPELL_CONFIG = Object.freeze({
  enabled: false,
  baseActivityId: "",
  extraActivityId: "",
  countMode: COUNT_MODES.FIXED,
  fixedCount: 0,
  slotScaling: Object.freeze({
    baseLevel: null,
    perLevel: 1,
    countOnly: true
  }),
  promptLabel: "",
  targetingMode: TARGETING_MODES.RETARGET,
  resolutionMode: RESOLUTION_MODES.MANUAL
});

function cloneData(data) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(data);
  }

  return JSON.parse(JSON.stringify(data));
}

function normalizeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeInteger(value, fallback = 0) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(numericValue));
}

function normalizeNullableInteger(value, fallback = null) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(numericValue));
}

function normalizeEnum(value, allowedValues, fallback) {
  return Object.values(allowedValues).includes(value) ? value : fallback;
}

function getModule() {
  return game?.modules?.get?.(MODULE_ID) ?? null;
}

function getModuleVersion() {
  return getModule()?.version ?? "dev";
}

function getLogPrefix() {
  return `[${MODULE_ID} v${getModuleVersion()}]`;
}

export function isDebugEnabled() {
  const settingId = `${MODULE_ID}.${SETTINGS.DEBUG}`;

  if (!game?.settings?.settings?.has(settingId)) {
    return false;
  }

  return Boolean(game.settings.get(MODULE_ID, SETTINGS.DEBUG));
}

export function log(...args) {
  console.info(getLogPrefix(), ...args);
}

export function debug(...args) {
  if (!isDebugEnabled()) {
    return;
  }

  console.debug(`${getLogPrefix()}[debug]`, ...args);
}

export function warn(...args) {
  console.warn(getLogPrefix(), ...args);
}

export function error(...args) {
  console.error(getLogPrefix(), ...args);
}

export function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.DEBUG, {
    name: `${LOCALIZATION_ROOT}.Settings.Debug.Name`,
    hint: `${LOCALIZATION_ROOT}.Settings.Debug.Hint`,
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: (enabled) => {
      log(`Debug logs ${enabled ? "enabled" : "disabled"}.`);
    }
  });
}

export function normalizeSpellConfig(source = {}) {
  const defaults = cloneData(DEFAULT_SPELL_CONFIG);
  const slotScaling = source?.slotScaling ?? {};

  return {
    enabled: normalizeBoolean(source.enabled, defaults.enabled),
    baseActivityId: normalizeString(source.baseActivityId, defaults.baseActivityId),
    extraActivityId: normalizeString(source.extraActivityId, defaults.extraActivityId),
    countMode: normalizeEnum(source.countMode, COUNT_MODES, defaults.countMode),
    fixedCount: normalizeInteger(source.fixedCount, defaults.fixedCount),
    slotScaling: {
      baseLevel: normalizeNullableInteger(slotScaling.baseLevel, defaults.slotScaling.baseLevel),
      perLevel: normalizeInteger(slotScaling.perLevel, defaults.slotScaling.perLevel),
      countOnly: normalizeBoolean(slotScaling.countOnly, defaults.slotScaling.countOnly)
    },
    promptLabel: normalizeString(source.promptLabel, defaults.promptLabel),
    targetingMode: normalizeEnum(source.targetingMode, TARGETING_MODES, defaults.targetingMode),
    resolutionMode: normalizeEnum(source.resolutionMode, RESOLUTION_MODES, defaults.resolutionMode)
  };
}

export function createSpellConfig(overrides = {}) {
  return normalizeSpellConfig(overrides);
}

export function getSpellConfig(item) {
  const rawConfig = item?.getFlag?.(MODULE_ID, FLAG_KEY) ?? item?.flags?.[MODULE_ID]?.[FLAG_KEY] ?? {};
  return normalizeSpellConfig(rawConfig);
}

export function isSpellConfigEnabled(item) {
  return getSpellConfig(item).enabled;
}

export async function setSpellConfig(item, config = {}) {
  if (!item?.setFlag) {
    throw new Error(`${MODULE_TITLE} | The provided document cannot store module flags.`);
  }

  return item.setFlag(MODULE_ID, FLAG_KEY, normalizeSpellConfig(config));
}

export async function clearSpellConfig(item) {
  if (!item?.unsetFlag) {
    throw new Error(`${MODULE_TITLE} | The provided document cannot clear module flags.`);
  }

  return item.unsetFlag(MODULE_ID, FLAG_KEY);
}

export function createApi() {
  return Object.freeze({
    id: MODULE_ID,
    title: MODULE_TITLE,
    settings: SETTINGS,
    flags: Object.freeze({
      key: FLAG_KEY,
      path: FLAG_PATH
    }),
    enums: Object.freeze({
      countModes: COUNT_MODES,
      targetingModes: TARGETING_MODES,
      resolutionModes: RESOLUTION_MODES
    }),
    defaults: Object.freeze({
      spellConfig: createSpellConfig()
    }),
    runtime: Object.freeze({
      createCastContext,
      getCastContext,
      deleteCastContext,
      listCastContexts,
      clearExpiredCastContexts
    }),
    createSpellConfig,
    computeExtraHitCount,
    resolveNextExtraHit,
    resolveRemainingExtraHits,
    cancelCastContext,
    normalizeSpellConfig,
    getSpellConfig,
    isSpellConfigEnabled,
    setSpellConfig,
    clearSpellConfig,
    isDebugEnabled,
    log,
    debug,
    warn,
    error
  });
}

export function registerModuleApi() {
  const module = getModule();

  if (!module) {
    warn("Unable to register module API because the module manifest is not available yet.");
    return null;
  }

  const api = createApi();
  module.api = api;

  return api;
}
