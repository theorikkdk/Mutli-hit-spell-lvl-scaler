import { getSpellConfig, setSpellConfig } from "../module.mjs";

const DialogV2 = foundry?.applications?.api?.DialogV2 ?? null;

function localizeText(englishText, frenchText) {
  return game?.i18n?.lang === "fr" ? frenchText : englishText;
}

function listItemActivities(item) {
  return Array.from(item?.system?.activities ?? []).map((entry) => {
    const activity = Array.isArray(entry) ? entry[1] : entry;

    return {
      id: typeof activity?.id === "string" ? activity.id : "",
      name: typeof activity?.name === "string" && activity.name ? activity.name : (activity?.id ?? "")
    };
  }).filter((activity) => activity.id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildActivityOptions(item, config) {
  const activities = listItemActivities(item);
  const options = [{
    value: "",
    label: localizeText("Select an activity", "Selectionner une activite"),
    selected: !config.hitActivityId
  }];

  for (const activity of activities) {
    options.push({
      value: activity.id,
      label: activity.name || activity.id,
      selected: activity.id === config.hitActivityId
    });
  }

  if (config.hitActivityId && !activities.some((activity) => activity.id === config.hitActivityId)) {
    options.push({
      value: config.hitActivityId,
      label: localizeText(`Unknown activity (${config.hitActivityId})`, `Activite inconnue (${config.hitActivityId})`),
      selected: true
    });
  }

  return {
    activities,
    options
  };
}

function buildDialogContent(item, config) {
  const { activities, options } = buildActivityOptions(item, config);
  const spellLevel = Number.isInteger(item?.system?.level) ? item.system.level : Number(item?.system?.level ?? 0) || 0;
  const activityOptionsMarkup = options.map((option) => {
    const selected = option.selected ? ' selected="selected"' : "";
    return `<option value="${escapeHtml(option.value)}"${selected}>${escapeHtml(option.label)}</option>`;
  }).join("");

  return `
    <form class="multi-hit-spell-lvl-scaler-config-form">
      <div class="form-group">
        <label>${escapeHtml(localizeText("Enable Multi-Hit", "Activer Multi-Hit"))}</label>
        <input type="checkbox" name="enabled"${config.enabled ? ' checked="checked"' : ""}>
      </div>
      <div class="form-group">
        <label>${escapeHtml(localizeText("Hit Activity", "Activite de hit"))}</label>
        <select name="hitActivityId">
          ${activityOptionsMarkup}
        </select>
        <p class="hint">
          ${escapeHtml(
            activities.length
              ? localizeText("Each hit reuses this activity.", "Chaque hit reutilise cette activite.")
              : localizeText(
                "No activities are currently available on this spell.",
                "Aucune activite n'est actuellement disponible sur ce sort."
              )
          )}
        </p>
      </div>
      <div class="form-group">
        <label>${escapeHtml(localizeText("Base Total Hits", "Nombre total de hits de base"))}</label>
        <input type="number" name="baseTotalHits" min="1" step="1" value="${escapeHtml(config.baseTotalHits)}">
      </div>
      <div class="form-group">
        <label>${escapeHtml(localizeText("Hits Per Slot Level", "Hits par niveau de slot"))}</label>
        <input type="number" name="hitsPerSlotLevel" min="0" step="1" value="${escapeHtml(config.hitsPerSlotLevel)}">
      </div>
      <p class="hint multi-hit-spell-lvl-scaler-derived-base-level">
        ${escapeHtml(localizeText(
          `Base level is derived automatically from spell level ${spellLevel}.`,
          `Le niveau de base est derive automatiquement du niveau du sort ${spellLevel}.`
        ))}
      </p>
    </form>
  `;
}

function readDialogForm(form) {
  if (!(form instanceof HTMLFormElement)) {
    return null;
  }

  const formData = new (foundry.applications.ux?.FormDataExtended ?? FormDataExtended)(form).object ?? {};
  const enabled = Boolean(form.querySelector('[name="enabled"]')?.checked ?? formData.enabled);
  const hitActivityId = String(formData.hitActivityId ?? "").trim();
  const baseTotalHits = Math.max(1, Math.trunc(Number(formData.baseTotalHits ?? 1) || 1));
  const hitsPerSlotLevel = Math.max(0, Math.trunc(Number(formData.hitsPerSlotLevel ?? 0) || 0));

  return {
    enabled,
    hitActivityId,
    baseTotalHits,
    hitsPerSlotLevel
  };
}

function buildSavePayload(form) {
  const data = readDialogForm(form);

  if (!data) {
    return null;
  }

  return {
    action: "save",
    data
  };
}

function isSavePayload(payload) {
  return Boolean(
    payload
    && (typeof payload === "object")
    && (payload.action === "save")
    && payload.data
    && (typeof payload.data === "object")
  );
}

async function openSpellConfigDialog(item) {
  if (!DialogV2?.wait || !item?.setFlag || (item.type !== "spell")) {
    return null;
  }

  const config = getSpellConfig(item);
  const content = buildDialogContent(item, config);
  const result = await DialogV2.wait({
    window: {
      title: localizeText(
        `Multi-Hit: ${item.name ?? "Spell"}`,
        `Multi-Hit : ${item.name ?? "Sort"}`
      )
    },
    content,
    buttons: [
      {
        action: "save",
        label: localizeText("Save", "Enregistrer"),
        default: true,
        callback: (event, button) => buildSavePayload(button?.form ?? null)
      },
      {
        action: "cancel",
        label: localizeText("Cancel", "Annuler"),
        callback: () => null
      }
    ],
    modal: true,
    rejectClose: false,
    position: {
      width: 420
    }
  });

  if (!isSavePayload(result)) {
    return null;
  }

  const formData = result.data;

  await setSpellConfig(item, {
    enabled: formData.enabled,
    hitActivityId: formData.hitActivityId,
    baseLevel: item.system?.level ?? 0,
    baseTotalHits: formData.baseTotalHits,
    hitsPerSlotLevel: formData.hitsPerSlotLevel,
    promptLabel: ""
  });

  ui.notifications?.info?.(
    localizeText("Multi-Hit configuration saved.", "Configuration Multi-Hit enregistree.")
  );

  return getSpellConfig(item);
}

export { openSpellConfigDialog };
