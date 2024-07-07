import BattleScene from "../../battle-scene";
import {ModSetting} from "../../system/settings/mod-settings";
import { Mode } from "../ui";
import AbstractSettingsUiHandler from "./abstract-settings-ui-handler";

export default class ModSettingsUiHandler extends AbstractSettingsUiHandler {
  /**
   * Creates an instance of SettingsGamepadUiHandler.
   *
   * @param scene - The BattleScene instance.
   * @param mode - The UI mode, optional.
   */
  constructor(scene: BattleScene, mode?: Mode) {
    super(scene, mode);
    this.title = "Mods";
    this.settings = ModSetting;
    this.localStorageKey = "settings_mods";
  }
}
