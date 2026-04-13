const LOCALIZATION_ROOT = "MULTI_HIT_SPELL_LVL_SCALER";

function resolveLocalizationKey(key) {
  const normalizedKey = String(key ?? "").trim();

  if (!normalizedKey) {
    return LOCALIZATION_ROOT;
  }

  return normalizedKey.startsWith(`${LOCALIZATION_ROOT}.`)
    ? normalizedKey
    : `${LOCALIZATION_ROOT}.${normalizedKey}`;
}

function interpolateFallback(template, data = {}) {
  return String(template ?? "").replace(/\{(\w+)\}/g, (match, key) => {
    if (Object.hasOwn(data, key)) {
      return String(data[key] ?? "");
    }

    return match;
  });
}

export function localize(key, fallback = "") {
  const localizationKey = resolveLocalizationKey(key);
  const localized = game?.i18n?.localize?.(localizationKey);

  if (typeof localized === "string" && localized !== localizationKey) {
    return localized;
  }

  return fallback || key;
}

export function formatLocalization(key, data = {}, fallback = "") {
  const localizationKey = resolveLocalizationKey(key);

  if (typeof game?.i18n?.format === "function" && game?.i18n?.has?.(localizationKey)) {
    return game.i18n.format(localizationKey, data);
  }

  return interpolateFallback(localize(localizationKey, fallback || key), data);
}
