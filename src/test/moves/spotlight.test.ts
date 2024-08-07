import {afterEach, beforeAll, beforeEach, describe, expect, test, vi} from "vitest";
import Phaser from "phaser";
import GameManager from "#app/test/utils/gameManager";
import Overrides from "#app/overrides";
import {
  CommandPhase,
  SelectTargetPhase,
  TurnEndPhase,
} from "#app/phases";
import {Stat} from "#app/data/pokemon-stat";
import {getMovePosition} from "#app/test/utils/gameManagerUtils";
import { Moves } from "#enums/moves";
import { Species } from "#enums/species";
import { BattlerIndex } from "#app/battle.js";

const TIMEOUT = 20 * 1000;

describe("Moves - Spotlight", () => {
  let phaserGame: Phaser.Game;
  let game: GameManager;

  beforeAll(() => {
    phaserGame = new Phaser.Game({
      type: Phaser.HEADLESS,
    });
  });

  afterEach(() => {
    game.phaseInterceptor.restoreOg();
  });

  beforeEach(() => {
    game = new GameManager(phaserGame);
    vi.spyOn(Overrides, "BATTLE_TYPE_OVERRIDE", "get").mockReturnValue("double");
    vi.spyOn(Overrides, "STARTER_SPECIES_OVERRIDE", "get").mockReturnValue(Species.AMOONGUSS);
    vi.spyOn(Overrides, "OPP_SPECIES_OVERRIDE", "get").mockReturnValue(Species.SNORLAX);
    vi.spyOn(Overrides, "STARTING_LEVEL_OVERRIDE", "get").mockReturnValue(100);
    vi.spyOn(Overrides, "OPP_LEVEL_OVERRIDE", "get").mockReturnValue(100);
    vi.spyOn(Overrides, "MOVESET_OVERRIDE", "get").mockReturnValue([ Moves.FOLLOW_ME, Moves.RAGE_POWDER, Moves.SPOTLIGHT, Moves.QUICK_ATTACK ]);
    vi.spyOn(Overrides, "OPP_MOVESET_OVERRIDE", "get").mockReturnValue([Moves.TACKLE,Moves.TACKLE,Moves.TACKLE,Moves.TACKLE]);
  });

  test(
    "move should redirect attacks to the target",
    async () => {
      await game.startBattle([ Species.AMOONGUSS, Species.CHARIZARD ]);

      const playerPokemon = game.scene.getPlayerField();
      expect(playerPokemon.length).toBe(2);
      playerPokemon.forEach(p => expect(p).not.toBe(undefined));

      const enemyPokemon = game.scene.getEnemyField();
      expect(enemyPokemon.length).toBe(2);
      enemyPokemon.forEach(p => expect(p).not.toBe(undefined));

      const enemyStartingHp = enemyPokemon.map(p => p.hp);

      game.doAttack(getMovePosition(game.scene, 0, Moves.SPOTLIGHT));
      await game.phaseInterceptor.to(SelectTargetPhase, false);
      game.doSelectTarget(BattlerIndex.ENEMY);
      await game.phaseInterceptor.to(CommandPhase);

      game.doAttack(getMovePosition(game.scene, 1, Moves.QUICK_ATTACK));
      await game.phaseInterceptor.to(SelectTargetPhase, false);
      game.doSelectTarget(BattlerIndex.ENEMY_2);
      await game.phaseInterceptor.to(TurnEndPhase, false);

      expect(enemyPokemon[0].hp).toBeLessThan(enemyStartingHp[0]);
      expect(enemyPokemon[1].hp).toBe(enemyStartingHp[1]);
    }, TIMEOUT
  );

  test(
    "move should cause other redirection moves to fail",
    async () => {
      vi.spyOn(Overrides, "OPP_MOVESET_OVERRIDE", "get").mockReturnValue([ Moves.FOLLOW_ME, Moves.FOLLOW_ME, Moves.FOLLOW_ME, Moves.FOLLOW_ME ]);

      await game.startBattle([ Species.AMOONGUSS, Species.CHARIZARD ]);

      const playerPokemon = game.scene.getPlayerField();
      expect(playerPokemon.length).toBe(2);
      playerPokemon.forEach(p => expect(p).not.toBe(undefined));

      const enemyPokemon = game.scene.getEnemyField();
      expect(enemyPokemon.length).toBe(2);
      enemyPokemon.forEach(p => expect(p).not.toBe(undefined));

      /**
       * Spotlight will target the slower enemy. In this situation without Spotlight being used,
       * the faster enemy would normally end up with the Center of Attention tag.
       */
      enemyPokemon.sort((a, b) => b.getBattleStat(Stat.SPD) - a.getBattleStat(Stat.SPD));
      const spotTarget = enemyPokemon[1].getBattlerIndex();
      const attackTarget = enemyPokemon[0].getBattlerIndex();

      const enemyStartingHp = enemyPokemon.map(p => p.hp);

      game.doAttack(getMovePosition(game.scene, 0, Moves.SPOTLIGHT));
      await game.phaseInterceptor.to(SelectTargetPhase, false);
      game.doSelectTarget(spotTarget);
      await game.phaseInterceptor.to(CommandPhase);

      game.doAttack(getMovePosition(game.scene, 1, Moves.QUICK_ATTACK));
      await game.phaseInterceptor.to(SelectTargetPhase, false);
      game.doSelectTarget(attackTarget);
      await game.phaseInterceptor.to(TurnEndPhase, false);

      expect(enemyPokemon[1].hp).toBeLessThan(enemyStartingHp[1]);
      expect(enemyPokemon[0].hp).toBe(enemyStartingHp[0]);
    }, TIMEOUT
  );
});
