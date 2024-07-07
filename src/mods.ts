import { PlayerPokemon, PokemonMove } from "./field/pokemon";
import BattleScene, { starterColors } from "./battle-scene";
import { LevelMoves } from "./data/pokemon-level-moves";
import { Moves } from "./enums/moves";
import { speciesEggMoves } from "./data/egg-moves";
import PokemonSpecies, { getPokemonSpecies, speciesStarters } from "./data/pokemon-species";
import { achvs } from "./system/achv";
import StarterSelectUiHandler from "./ui/starter-select-ui-handler";
import i18next from "i18next";
import UI, { Mode } from "./ui/ui";
import { allMoves } from "./data/move";
import { AbilityAttr, DexAttr } from "./system/game-data";
import { allAbilities } from "./data/ability";
import { Stat, getStatName } from "./data/pokemon-stat";
import { getNatureName } from "./data/nature";
import * as Utils from "./utils";
import { pokemonFormChanges } from "./data/pokemon-forms";
import { Species } from "./enums/species";
import { WeatherType } from "./data/weather";
import { TerrainType } from "./data/terrain";


export class Mods {

  //SETTINGS
  public infiniteBalls: boolean = false;

  public hiddenAbilityModifier: number = 1;
  public shinyModifier: number = 1;

  public catchTrainerPokemon: boolean = false;
  public catchTrainerPokemonRestrictions: boolean = true;

  public infiniteVouchers: boolean = false;

  public overrideEggHatchWaves: boolean = false;

  public overrideEggRarityIndex: number = 1;

  public eggSpeciesPitty: number = 9;

  public candyCostMultiplier: number = 1;

  public regenPokeChance: number = 0;

  /**
   * Adds egg moves to learnable moves
   */
  getLearnableMoves(scene: BattleScene, species: PokemonSpecies, fusionSpecies: PokemonSpecies, moveset: PokemonMove[], levelMoves: LevelMoves): Moves[] {

    const learnableMoves = levelMoves
      .map((lm) => lm[1])
      .filter((lm) => !moveset.filter(m => m.moveId === lm).length)
      .filter((move: Moves, i: integer, array: Moves[]) => array.indexOf(move) === i);

    const isFusionSpecies = fusionSpecies ? 1 : 0;

    for (let speciesIndex = 0; speciesIndex <= isFusionSpecies; speciesIndex++) {
      const speciesId = speciesIndex < 1 ? species.getRootSpeciesId() : fusionSpecies.getRootSpeciesId();
      for (let moveIndex = 0; moveIndex < 4; moveIndex++) {
        if (
          scene.gameData.starterData[speciesId].eggMoves & Math.pow(2, moveIndex) &&
          moveset.filter((m) => m.moveId !== speciesEggMoves[species.getRootSpeciesId()][moveIndex]).length === moveset.length
        ) {
          learnableMoves[learnableMoves.length] = speciesEggMoves[speciesId][moveIndex];
        }
      }
    }
    return learnableMoves;
  }

  /**
   * Skips a lot of the animations when hatching eggs to speed it up.
   */
  fastHatchAnimation(scene: BattleScene, pokemon: PlayerPokemon, eggMoveIndex: integer, eggContainer: Phaser.GameObjects.Container,
    pokemonSprite: Phaser.GameObjects.Sprite, pokemonShinySparkle: Phaser.GameObjects.Sprite): Promise<void> {

    const isShiny = pokemon.isShiny();
    if (pokemon.species.subLegendary) {
      scene.validateAchv(achvs.HATCH_SUB_LEGENDARY);
    }
    if (pokemon.species.legendary) {
      scene.validateAchv(achvs.HATCH_LEGENDARY);
    }
    if (pokemon.species.mythical) {
      scene.validateAchv(achvs.HATCH_MYTHICAL);
    }
    if (isShiny) {
      scene.validateAchv(achvs.HATCH_SHINY);
    }

    return new Promise((resolve) => {
      this.revealHatchSprite(scene, pokemon, eggContainer, pokemonSprite, pokemonShinySparkle);
      scene.ui.showText(
        `A ${pokemon.name} hatched!`,
        null,
        () => {
          scene.gameData.updateSpeciesDexIvs(pokemon.species.speciesId, pokemon.ivs);
          scene.gameData.setPokemonCaught(pokemon, true, true).then(() => {
            scene.gameData
              .setEggMoveUnlocked(pokemon.species, eggMoveIndex)
              .then(() => {
                scene.ui.showText(null, 0);
              })
              .then(() => resolve());
          });
        },
        null,
        true,
        null
      );
    });
  }
  private revealHatchSprite(
    scene: BattleScene,
    pokemon: PlayerPokemon,
    eggContainer: Phaser.GameObjects.Container,
    pokemonSprite: Phaser.GameObjects.Sprite,
    pokemonShinySparkle: Phaser.GameObjects.Sprite
  ) {
    pokemon.cry();

    eggContainer.setVisible(false);
    pokemonSprite.play(pokemon.getSpriteKey(true));
    pokemonSprite.setPipelineData("ignoreTimeTint", true);
    pokemonSprite.setPipelineData("spriteKey", pokemon.getSpriteKey());
    pokemonSprite.setPipelineData("shiny", pokemon.shiny);
    pokemonSprite.setPipelineData("variant", pokemon.variant);
    pokemonSprite.setVisible(true);

    if (pokemon.isShiny()) {
      pokemonShinySparkle.play(`sparkle${pokemon.variant ? `_${pokemon.variant + 1}` : ""}`);
      scene.playSound("sparkle");
    }
  }

  /**
   * Egg moves candy unlock store
   */
  showEggMovesUnlock(
    scene: BattleScene,
    ui: UI,
    lastSpecies: PokemonSpecies,
    candyCount: any,
    uiHandler: StarterSelectUiHandler,
    pokemonCandyCountText: Phaser.GameObjects.Text
  ) {
    const options = [];

    for (let index = 0; index < 4; index++) {
      const eggMoveUnlocked = scene.gameData.starterData[lastSpecies.speciesId].eggMoves & Math.pow(2, index);
      if (!eggMoveUnlocked) {
        options.push({
          label: `x${this.unlockEggMovePrice(index, lastSpecies)} Unlock ${this.getEggMoveName(lastSpecies, index)}`,
          handler: () => {
            if (candyCount >= this.unlockEggMovePrice(index, lastSpecies)) {
              this.unlockEggMove(scene, ui, lastSpecies, uiHandler, pokemonCandyCountText, index);
            }
            return false;
          },
          item: "candy",
          itemArgs: starterColors[lastSpecies.speciesId],
        });
      }
    }

    options.push({
      label: i18next.t("menu:cancel"),
      handler: () => {
        ui.setMode(Mode.STARTER_SELECT);
        return true;
      },
    });
    ui.setModeWithoutClear(Mode.OPTION_SELECT, {
      options: options,
      yOffset: 47,
    });
  }
  protected unlockEggMove(
    scene: BattleScene,
    ui: UI,
    lastSpecies: PokemonSpecies,
    uiHandler: StarterSelectUiHandler,
    pokemonCandyCountText: Phaser.GameObjects.Text,
    index: integer
  ) {
    scene.gameData.setEggMoveUnlocked(lastSpecies, index);
    scene.gameData.starterData[lastSpecies.speciesId].candyCount -= this.unlockEggMovePrice(index, lastSpecies);

    pokemonCandyCountText.setText(`x${scene.gameData.starterData[lastSpecies.speciesId].candyCount}`);
    uiHandler.setSpeciesDetails(lastSpecies, undefined, undefined, undefined, undefined, undefined, undefined);

    scene.gameData.saveSystem().then((success) => {
      if (!success) {
        return scene.reset(true);
      }
    });
    ui.setMode(Mode.STARTER_SELECT);
    return true;
  }
  protected unlockEggMovePrice(index: integer, species: PokemonSpecies): integer {
    const baseCost = speciesStarters[species.speciesId] > 5 ? 3 : speciesStarters[species.speciesId] > 3 ? 4 : 5;
    const rareMoveAddition = index > 2 ? 1 : 0;

    return Math.round((baseCost + rareMoveAddition) * this.candyCostMultiplier);
  }
  getEggMoveName(species: PokemonSpecies, index: integer) {
    const hasEggMoves = species && speciesEggMoves.hasOwnProperty(species.speciesId);
    const eggMove = hasEggMoves ? allMoves[speciesEggMoves[species.speciesId][index]] : null;
    return eggMove.name;
  }

  /**
   * Shiny unlock store
   */
  showShiniesUnlock(
    scene: BattleScene,
    ui: UI,
    lastSpecies: PokemonSpecies,
    candyCount: any,
    uiHandler: StarterSelectUiHandler,
    pokemonCandyCountText: Phaser.GameObjects.Text
  ) {
    const options = [];

    for (let rarity = 1; rarity < 4; rarity++) {
      const shinyVariant = this.getShinyRarity(rarity);
      if (!(scene.gameData.dexData[lastSpecies.speciesId].caughtAttr & shinyVariant)) {
        options.push({
          label: `x${this.unlockShinyPrice(rarity, lastSpecies)} Unlock ${this.getShinyRarityName(rarity)}`,
          handler: () => {
            if (candyCount >= this.unlockShinyPrice(rarity, lastSpecies)) {
              this.unlockShiny(scene, ui, lastSpecies, uiHandler, pokemonCandyCountText, rarity);
            }
            return false;
          },
          item: "candy",
          itemArgs: starterColors[lastSpecies.speciesId],
        });
      }
    }

    options.push({
      label: i18next.t("menu:cancel"),
      handler: () => {
        ui.setMode(Mode.STARTER_SELECT);
        return true;
      },
    });
    ui.setModeWithoutClear(Mode.OPTION_SELECT, {
      options: options,
      yOffset: 47,
    });
  }
  protected unlockShiny(
    scene: BattleScene,
    ui: UI,
    lastSpecies: PokemonSpecies,
    uiHandler: StarterSelectUiHandler,
    pokemonCandyCountText: Phaser.GameObjects.Text,
    rarity: integer
  ) {
    while (rarity > 0) {
      scene.gameData.dexData[lastSpecies.speciesId].caughtAttr |= this.getShinyRarity(rarity);
      rarity--;
    }
    scene.gameData.starterData[lastSpecies.speciesId].candyCount -= this.unlockShinyPrice(rarity, lastSpecies);
    pokemonCandyCountText.setText(`x${scene.gameData.starterData[lastSpecies.speciesId].candyCount}`);

    uiHandler.setSpecies(lastSpecies);
    uiHandler.updateInstructions();
    uiHandler.setSpeciesDetails(lastSpecies, undefined, undefined, undefined, undefined, undefined, undefined);

    scene.gameData.saveSystem().then((success) => {
      if (!success) {
        return scene.reset(true);
      }
    });
    ui.setMode(Mode.STARTER_SELECT);
    return true;
  }
  protected unlockShinyPrice(rarity: integer, species: PokemonSpecies): integer {
    const basePokemonValue = speciesStarters[species.speciesId] > 3 ? speciesStarters[species.speciesId] + 1 : speciesStarters[species.speciesId];

    const baseCost = 50 - 5 * (basePokemonValue - 1);

    return Math.round(baseCost * ((1 + rarity) / 2)) * this.candyCostMultiplier;
  }
  protected getShinyRarity(rarity: integer): bigint {
    if (rarity === 3) {
      return DexAttr.VARIANT_3;
    }
    if (rarity === 2) {
      return DexAttr.VARIANT_2;
    }
    return DexAttr.SHINY;
  }
  protected getShinyRarityName(rarity: integer): String {
    if (rarity === 3) {
      return "epic shiny";
    }
    if (rarity === 2) {
      return "rare shiny";
    }
    return "common shiny";
  }

  /**
   * Ability unlock store
   */
  showAbilityUnlock(
    scene: BattleScene,
    ui: UI,
    lastSpecies: PokemonSpecies,
    candyCount: any,
    uiHandler: StarterSelectUiHandler,
    pokemonCandyCountText: Phaser.GameObjects.Text
  ) {
    const options = [];
    const abilityAttr = scene.gameData.starterData[lastSpecies.speciesId].abilityAttr;

    const allAbilityAttr = this.getAllAbilityAttr(lastSpecies);

    const unlockedAbilityAttr = [abilityAttr & AbilityAttr.ABILITY_1, abilityAttr & AbilityAttr.ABILITY_2, abilityAttr & AbilityAttr.ABILITY_HIDDEN].filter(
      (a) => a
    );
    const lockedAbilityAttr = allAbilityAttr.filter((item) => !unlockedAbilityAttr.includes(item));

    for (let abilityIndex = 0; abilityIndex < lastSpecies.getAbilityCount(); abilityIndex++) {
      if (!(abilityAttr & unlockedAbilityAttr[abilityIndex])) {
        const selectedAbility = lockedAbilityAttr.pop();
        options.push({
          label: `x${this.unlockAbilityPrice(selectedAbility, lastSpecies)} Unlock ${this.getAbilityName(selectedAbility, lastSpecies)}`,
          handler: () => {
            if (candyCount >= 0) {
              this.unlockAbility(scene, ui, lastSpecies, uiHandler, pokemonCandyCountText, selectedAbility);
            }
            return false;
          },
          item: "candy",
          itemArgs: starterColors[lastSpecies.speciesId],
        });
      }
    }

    options.push({
      label: i18next.t("menu:cancel"),
      handler: () => {
        ui.setMode(Mode.STARTER_SELECT);
        return true;
      },
    });
    ui.setModeWithoutClear(Mode.OPTION_SELECT, {
      options: options,
      yOffset: 47,
    });
  }
  protected unlockAbility(
    scene: BattleScene,
    ui: UI,
    lastSpecies: PokemonSpecies,
    uiHandler: StarterSelectUiHandler,
    pokemonCandyCountText: Phaser.GameObjects.Text,
    selectedAttr: number
  ) {
    scene.gameData.starterData[lastSpecies.speciesId].abilityAttr = scene.gameData.starterData[lastSpecies.speciesId].abilityAttr | selectedAttr;

    scene.gameData.starterData[lastSpecies.speciesId].candyCount -= this.unlockAbilityPrice(selectedAttr, lastSpecies);
    pokemonCandyCountText.setText(`x${scene.gameData.starterData[lastSpecies.speciesId].candyCount}`);

    uiHandler.setSpecies(lastSpecies);
    uiHandler.updateInstructions();
    uiHandler.setSpeciesDetails(lastSpecies, undefined, undefined, undefined, undefined, undefined, undefined);

    scene.gameData.saveSystem().then((success) => {
      if (!success) {
        return scene.reset(true);
      }
    });
    ui.setMode(Mode.STARTER_SELECT);
    return true;
  }
  protected unlockAbilityPrice(abilityIndex: integer, species: PokemonSpecies): integer {
    const basePokemonValue = speciesStarters[species.speciesId];
    const isHA = abilityIndex === 4 ? 1 : 0;

    const baseCost = 20 - 2.5 * (basePokemonValue - 1);

    return Math.ceil(baseCost * (1 + isHA)) * this.candyCostMultiplier;
  }
  getAbilityName(selectedAbilityIndex: integer, species: PokemonSpecies): String {
    const abilityId = selectedAbilityIndex === 1 ? species.ability1 : selectedAbilityIndex === 2 ? species.ability2 : species.abilityHidden;
    return allAbilities[abilityId].name;
  }
  getAllAbilityAttr(lastSpecies: PokemonSpecies): number[] {
    const allAbilityAttr: number[] = [
      AbilityAttr.ABILITY_1,
      ...(lastSpecies.getAbilityCount() === 2 ? [AbilityAttr.ABILITY_HIDDEN] : []),
      ...(lastSpecies.getAbilityCount() === 3 ? [AbilityAttr.ABILITY_HIDDEN, AbilityAttr.ABILITY_2] : []),
    ];
    return allAbilityAttr;
  }

  hasAllAbilityAttrs(lastSpecies: PokemonSpecies, abilityAttr: number): boolean {
    const allAbilityAttr = this.getAllAbilityAttr(lastSpecies);
    const unlockedAbilityAttr = [abilityAttr & AbilityAttr.ABILITY_1, abilityAttr & AbilityAttr.ABILITY_2, abilityAttr & AbilityAttr.ABILITY_HIDDEN].filter(
      (a) => a
    );

    return allAbilityAttr.every((attr) => unlockedAbilityAttr.includes(attr));
  }


  /**
   * IV improvement store
   */
  showIVsUnlock(
    scene: BattleScene,
    ui: BattleScene["ui"],
    lastSpecies: PokemonSpecies,
    candyCount: any,
    uiHandler: StarterSelectUiHandler,
    pokemonCandyCountText: Phaser.GameObjects.Text
  ) {
    const options = [];

    for (let stat = 0; stat < 6; stat++) {
      if (scene.gameData.dexData[lastSpecies.speciesId].ivs[stat] < 31) {
        options.push({
          label: `x${this.improveIVPrice(lastSpecies)} Improve ${this.getStatName(stat)}`,
          handler: () => {
            if (candyCount >= this.improveIVPrice(lastSpecies)) {
              this.improveIV(scene, ui, lastSpecies, uiHandler, pokemonCandyCountText, stat);
            }
            return false;
          },
          item: "candy",
          itemArgs: starterColors[lastSpecies.speciesId],
        });
      }
    }

    options.push({
      label: i18next.t("menu:cancel"),
      handler: () => {
        ui.setMode(Mode.STARTER_SELECT);
        return true;
      },
    });
    ui.setModeWithoutClear(Mode.OPTION_SELECT, {
      options: options,
      yOffset: 47,
    });
  }
  protected improveIV(
    scene: BattleScene,
    ui: BattleScene["ui"],
    lastSpecies: PokemonSpecies,
    uiHandler: StarterSelectUiHandler,
    pokemonCandyCountText: Phaser.GameObjects.Text,
    stat: number
  ) {
    const IVs = scene.gameData.dexData[lastSpecies.speciesId].ivs;
    IVs[stat] = Math.min(IVs[stat] + 5, 31);

    scene.gameData.updateSpeciesDexIvs(lastSpecies.speciesId, IVs);

    scene.gameData.starterData[lastSpecies.speciesId].candyCount -= this.improveIVPrice(lastSpecies);
    pokemonCandyCountText.setText(`x${scene.gameData.starterData[lastSpecies.speciesId].candyCount}`);

    uiHandler.setSpecies(lastSpecies);
    uiHandler.updateInstructions();
    uiHandler.setSpeciesDetails(lastSpecies, undefined, undefined, undefined, undefined, undefined, undefined);

    scene.gameData.saveSystem().then((success) => {
      if (!success) {
        return scene.reset(true);
      }
    });
    ui.setMode(Mode.STARTER_SELECT);
    return true;
  }
  protected improveIVPrice(species: PokemonSpecies, modifier?: number): integer {
    return Math.round((speciesStarters[species.speciesId] > 5 ? 3 : speciesStarters[species.speciesId] > 3 ? 4 : 5) * this.candyCostMultiplier);
  }
  protected getStatName(statIndex: integer): String {
    return getStatName(statIndex as Stat);
  }


  /**
   * Nature unlock store
   */
  showNatureUnlock(scene: BattleScene,
    ui: BattleScene["ui"],
    lastSpecies: PokemonSpecies,
    candyCount: any,
    uiHandler: StarterSelectUiHandler,
    pokemonCandyCountText: Phaser.GameObjects.Text) {

    const options = [];
    for (let nature = 0; nature < 25; nature++) {
      if (!(scene.gameData.dexData[lastSpecies.speciesId].natureAttr & Math.pow(2, nature + 1))) {
        options.push({
          label: `x${this.unlockNaturePrice(lastSpecies)} Improve ${getNatureName(nature)}`,
          handler: () => {
            if (candyCount >= this.unlockNaturePrice(lastSpecies)) {
              this.unlockNature(scene, ui, lastSpecies, uiHandler, pokemonCandyCountText, nature);
            }
            return false;
          },
          item: "candy",
          itemArgs: starterColors[lastSpecies.speciesId],
        });
      }
    }

    const chunkSize = 8;
    const chunkedOptions: any[][] = [];
    for (let i = 0; i < options.length; i += chunkSize) {
      const chunk = options.slice(i, i + chunkSize);
      if (i + chunkSize < options.length) {
        chunk.push({
          label: "Next",
          handler: () => {
            this.showOptions(ui, chunkedOptions[(i/chunkSize)+1]);
          },
        });
      }
      chunkedOptions.push(chunk);
    }

    this.showOptions(ui, chunkedOptions[0]);
  }
  protected unlockNature(
    scene: BattleScene,
    ui: UI,
    lastSpecies: PokemonSpecies,
    uiHandler: StarterSelectUiHandler,
    pokemonCandyCountText: Phaser.GameObjects.Text,
    selectedNature: number
  ) {
    scene.gameData.dexData[lastSpecies.speciesId].natureAttr |= Math.pow(2, selectedNature + 1);

    scene.gameData.starterData[lastSpecies.speciesId].candyCount -= this.unlockNaturePrice(lastSpecies);
    pokemonCandyCountText.setText(`x${scene.gameData.starterData[lastSpecies.speciesId].candyCount}`);

    uiHandler.setSpecies(lastSpecies);
    uiHandler.updateInstructions();
    uiHandler.setSpeciesDetails(lastSpecies, undefined, undefined, undefined, undefined, undefined, undefined);

    scene.gameData.saveSystem().then((success) => {
      if (!success) {
        return scene.reset(true);
      }
    });
    ui.setMode(Mode.STARTER_SELECT);
    return true;
  }
  protected showOptions(ui: UI, options: any[]) {
    options.push({
      label: i18next.t("menu:cancel"),
      handler: () => {
        ui.setMode(Mode.STARTER_SELECT);
        return true;
      },
    });
    ui.setMode(Mode.STARTER_SELECT).then(() => ui.setModeWithoutClear(Mode.OPTION_SELECT, {
      options: options,
      yOffset: 47,
    }));
  }
  protected unlockNaturePrice(species: PokemonSpecies): integer {
    return Math.round((speciesStarters[species.speciesId] > 5 ? 6 : speciesStarters[species.speciesId] > 3 ? 8 : 10) * this.candyCostMultiplier);
  }
  hasAllNatures(scene: BattleScene, lastSpecies: PokemonSpecies): boolean {
    const allNatures = (1 << 26) - 2; // = 25 bits set to 1
    return (scene.gameData.dexData[lastSpecies.speciesId].natureAttr & allNatures) === allNatures;
  }


  /*
  * Regen Completed Pokemon
  */
  regenerateCompletedPokemon(species: Species, scene: BattleScene): boolean {
    let regen = false;

    if (Utils.randInt(100) <= this.regenPokeChance) {
      const dexEntry = scene.gameData.dexData[getPokemonSpecies(species).getRootSpeciesId()];
      const abilityAttr = scene.gameData.starterData[getPokemonSpecies(species).getRootSpeciesId()].abilityAttr;
      const genderRatio = getPokemonSpecies(species).malePercent;

      const gendersUncaught = !(
        (dexEntry.caughtAttr & DexAttr.MALE && dexEntry.caughtAttr & DexAttr.FEMALE) ||
        genderRatio === null ||
        (genderRatio === 0 && dexEntry.caughtAttr & DexAttr.FEMALE) ||
        (genderRatio === 100 && dexEntry.caughtAttr & DexAttr.MALE)
      );
      const formsUncaught = !!getPokemonSpecies(species)
        .forms.filter((f) => !f.formKey || !pokemonFormChanges[species]?.find((fc) => fc.formKey))
        .map((_, f) => !(dexEntry.caughtAttr & scene.gameData.getFormAttr(f)))
        .filter((f) => f).length;

      const allAbilityAttr = this.getAllAbilityAttr(getPokemonSpecies(species));
      const unlockedAbilityAttr = [abilityAttr & AbilityAttr.ABILITY_1, abilityAttr & AbilityAttr.ABILITY_2, abilityAttr & AbilityAttr.ABILITY_HIDDEN].filter((a) => a);
      const abilitiesUncaught = !allAbilityAttr.filter((item) => !unlockedAbilityAttr.includes(item));
      regen = !(gendersUncaught || formsUncaught || abilitiesUncaught);
    }

    return regen;
  }

  /**
   * Random Team generator
   */
  generateRandomTeam(handler: StarterSelectUiHandler, scene: BattleScene, genSpecies: PokemonSpecies[][]) {
    const maxAttempts = 200;

    async function generateMon() {
      for (let loop=0; loop < maxAttempts; loop++) {
        const randomGenIndex = Utils.randInt(8, 0);
        const randomCursorIndex = Utils.randInt(80, 0);
        const species = genSpecies[randomGenIndex][randomCursorIndex];

        if (!handler.tryUpdateValue(0.1)) {
          return;
        }

        console.log("Loop:" + loop);
        if (!species ||!handler.tryUpdateValue(scene.gameData.getSpeciesStarterValue(species.speciesId))) {
          continue;
        }
        handler.setGen(randomGenIndex);
        await handler.addToParty(randomCursorIndex);

        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    generateMon();
  }

  /**
     * Weather UI
     */
  updateWeatherText(scene: BattleScene) {
    console.log("Weather: "+  scene.arena?.weather?.weatherType);
    if (scene.arena?.weather?.weatherType === undefined || scene.arena?.weather?.weatherType === WeatherType.NONE) {
      scene.weatherText.setText("Clear");
      scene.weatherText.setVisible(false);
    } else {
      const weatherType = scene.arena.weather?.weatherType;
      const turnsLeft = scene.arena.weather?.turnsLeft;
      const turnsLeftText = turnsLeft > 0 ? turnsLeft : "";

      scene.weatherText.setText(`${this.getWeatherName(weatherType)} ${turnsLeftText}`);
      scene.weatherText.setVisible(true);
    }
  }
  getWeatherName(weatherType: WeatherType): String {
    switch (weatherType) {
    case WeatherType.NONE:
      return "Clear";
    case WeatherType.SUNNY:
      return "Sun";
    case WeatherType.RAIN:
      return "Rain";
    case WeatherType.SANDSTORM:
      return "Sandstorm";
    case WeatherType.HAIL:
      return "Hail";
    case WeatherType.SNOW:
      return "Snow";
    case WeatherType.FOG:
      return "Fog";
    case WeatherType.HEAVY_RAIN:
      return "Heavy Rain";
    case WeatherType.HARSH_SUN:
      return "Harsh Sun";
    case WeatherType.STRONG_WINDS:
      return "Strong Winds";
    }
  }

  updateTerrainText(scene: BattleScene) {
    console.log("Terrain: "+  scene.arena?.terrain?.terrainType);
    if (scene.arena?.terrain?.terrainType === undefined || scene.arena?.terrain?.terrainType === TerrainType.NONE) {
      scene.terrainText.setVisible(false);
    } else {
      const terrainType = scene.arena?.terrain?.terrainType;
      const turnsLeft = scene.arena?.terrain?.turnsLeft;
      const turnsLeftText = turnsLeft > 0 ? turnsLeft : "";

      scene.terrainText.setText(`${this.getTerrainName(terrainType)} ${turnsLeftText}`);

      scene.updateBattleInfoOverlayPosition();
      scene.terrainText.setVisible(true);
    }
  }
  getTerrainName(terrainType: TerrainType): String {
    switch (terrainType) {
    case TerrainType.ELECTRIC:
      return "Electric Terrain";
    case TerrainType.GRASSY:
      return "Grassy Terrain";
    case TerrainType.MISTY:
      return "Misty Terrain";
    case TerrainType.PSYCHIC:
      return "Psychic Terrain";
    default:
      return "No Terrain";
    }
  }
}
