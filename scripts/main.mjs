import {
  MODULE_ID,
  createSpellConfig,
  debug,
  log,
  registerModuleApi,
  registerSettings
} from "./module.mjs";

Hooks.once("init", () => {
  registerSettings();

  const api = registerModuleApi();

  log("init");
  debug("Registered module API.", api);
  debug("Default spell config template.", createSpellConfig());
});

Hooks.once("setup", () => {
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
