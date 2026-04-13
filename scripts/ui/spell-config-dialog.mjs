import { formatLocalization, localize } from "../i18n.mjs";
import { getSpellConfig, setSpellConfig } from "../module.mjs";

const DialogV2 = foundry?.applications?.api?.DialogV2 ?? null;

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
    label: localize("Ui.SpellConfig.SelectActivity", "Select an activity"),
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
      label: formatLocalization(
        "Ui.SpellConfig.UnknownActivity",
        { activityId: config.hitActivityId },
        "Unknown activity ({activityId})"
      ),
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
        <label>${escapeHtml(localize("Ui.SpellConfig.Enable", "Enable Multi-Hit"))}</label>
        <input type="checkbox" name="enabled"${config.enabled ? ' checked="checked"' : ""}>
      </div>
      <div class="form-group">
        <label>${escapeHtml(localize("Ui.SpellConfig.HitActivity", "Hit activity"))}</label>
        <select name="hitActivityId">
          ${activityOptionsMarkup}
        </select>
        <p class="hint">
          ${escapeHtml(
            activities.length
              ? localize("Ui.SpellConfig.ActivityHintAvailable", "Each hit reuses this activity.")
              : localize(
                "Ui.SpellConfig.ActivityHintMissing",
                "No activities are currently available on this spell."
              )
          )}
        </p>
      </div>
      <div class="form-group">
        <label>${escapeHtml(localize("Ui.SpellConfig.BaseTotalHits", "Base total hits"))}</label>
        <input type="number" name="baseTotalHits" min="1" step="1" value="${escapeHtml(config.baseTotalHits)}">
      </div>
      <div class="form-group">
        <label>${escapeHtml(localize("Ui.SpellConfig.HitsPerSlotLevel", "Hits per slot level"))}</label>
        <input type="number" name="hitsPerSlotLevel" min="0" step="1" value="${escapeHtml(config.hitsPerSlotLevel)}">
      </div>
      <p class="hint multi-hit-spell-lvl-scaler-derived-base-level">
        ${escapeHtml(formatLocalization(
          "Ui.SpellConfig.DerivedBaseLevel",
          { spellLevel },
          "Base spell level is derived automatically from spell level {spellLevel}."
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
      title: formatLocalization(
        "Ui.SpellConfig.Title",
        {
          itemName: item.name ?? localize("Ui.SpellConfig.FallbackSpellName", "Spell")
        },
        "Multi-Hit: {itemName}"
      )
    },
    content,
    buttons: [
      {
        action: "save",
        label: localize("Ui.SpellConfig.Save", "Save"),
        default: true,
        callback: (event, button) => buildSavePayload(button?.form ?? null)
      },
      {
        action: "cancel",
        label: localize("Ui.SpellConfig.Cancel", "Cancel"),
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
    localize("Ui.SpellConfig.Saved", "Multi-Hit configuration saved.")
  );

  return getSpellConfig(item);
}

export { openSpellConfigDialog };
