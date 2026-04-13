import {
  MODULE_ID,
  createSpellConfig,
  debug,
  log,
  registerModuleApi,
  registerSettings
} from "./module.mjs";
import { registerItemSheetHeaderButton } from "./ui/item-sheet-header-button.mjs";
import { registerCastDetector } from "./workflows/cast-detector.mjs";

Hooks.once("init", () => {
  registerSettings();
  registerItemSheetHeaderButton();

  const api = registerModuleApi();

  log("init");
  debug("Registered module API.", api);
  debug("Default spell config template.", createSpellConfig());
});

Hooks.once("setup", () => {
  registerCastDetector();
  log("setup");
});

Hooks.once("ready", () => {
  const activeModule = game.modules.get(MODULE_ID);

  log("ready");
  debug("Module metadata.", {
    active: activeModule?.active ?? false,
    version: activeModule?.version ?? "dev"
  });
});
