# Drowning

A 1v1 card game prototype built with **Pixi.js** and **TypeScript**, combining
positional melee combat with free-target ranged attacks across a two-lane
board. The engine is fully **data-driven**: cards, decks, art and animations
are all defined outside the game logic, so new content never requires touching
the combat rules.

![Board overview](docs/media/board-overview.png)

## Concept

Each player controls two lanes:

- **Melee** — front line, fixed by column: a melee card can only fight the
  enemy melee card directly across from it.
- **Ranged** — back line, free targeting: a ranged card can strike *any*
  enemy card (or the enemy's face) regardless of column, but deals damage in
  one direction only — the target never strikes back.

This asymmetry is the core risk/reward of the game: ranged cards hit harder
and pick their targets, but a lane full of enemy ranged attackers can all
focus-fire the same card, with no artificial damage penalty needed to balance
it — the exposure is already built into "no retaliation."

If a melee slot is empty, the ranged card behind it can be brought forward
into the front line (manually for the player, automatically for the AI) to
plug the gap.

## Turn flow

Play alternates between the two sides. On your turn:

1. A card is drawn and mana is refreshed (mana equals the number of turns
   you've taken, so it grows by exactly 1 every turn regardless of what you
   spent).
2. Optionally play cards from hand into empty slots, spending mana per the
   card's cost.
3. Choose your attackers:
   - Clicking an untapped **melee** card immediately marks it as attacking
     (its target is fixed — whatever sits in the same column).
   - Clicking an untapped **ranged** card arms it for targeting: pick any
     legal enemy card, or the "Strike the face" button, to lock in its
     target.
   - Any card that would be lethal to its (would-be) target shows a **💀 KO**
     marker on the target, so you can preview the outcome before confirming.
4. Press **Attack** to resolve combat, or **Cancel** to clear your current
   selection without untapping/unplaying anything. Attacking taps a card for
   the rest of the round.

Combat resolves in this order: melee duels (First Strike sub-phase first,
then the rest, simultaneously) → deaths are removed → ranged strikes →
deaths are removed again. The turn then passes to the other side, which goes
through the same steps (driven by the AI for the opponent).

The game ends when either side's health (starting at 20) reaches 0.

## Modifiers

| Modifier | Effect |
| --- | --- |
| `FLYING` | A melee attack from this card skips the column matchup and hits the face directly, *unless* the defending column also has a Flying card, in which case they duel normally. |
| `STEALTH` | A melee attack from this card always skips the column matchup and hits the face directly — no exception. |
| `DEADLY` | Any damage this card deals is instantly lethal, regardless of amount. |
| `GUARD` | This card cannot be chosen as a ranged target (it can still be attacked in melee via its column). |
| `FIRST_STRIKE` | Deals its melee damage in an earlier sub-phase, before all other melee duels resolve. |

Modifiers are defined in [types/card.ts](src/types/card.ts) and interpreted
by [game/combat.ts](src/game/combat.ts) — adding a new one only requires a
label and the corresponding branch in the combat resolver.

## Opponent AI

The opponent ([game/ai.ts](src/game/ai.ts)) runs a simple deterministic
routine each turn:

1. **Reinforce** — pull a ranged card forward into any empty melee slot in
   its column.
2. **Play** — from its hand, play the cheapest cards first into empty slots
   (melee before ranged) until it runs out of mana or slots.
3. **Attack** — attack with everything untapped; ranged attackers prioritize
   the enemy card with the lowest remaining defense, falling back to the
   face once no card targets are left.

There's no trade evaluation or lookahead — it's a baseline opponent, not a
strategic one.

## Card preview and feedback

Long-pressing any card — in hand or on the board, yours or the opponent's —
pops up an enlarged preview (left side for your cards, right side for the
opponent's) so you can read small text without losing your place on the
board.

![Ranged targeting with a death-marker preview](docs/media/ranged-targeting.png)
![Long-press card preview](docs/media/zoom-preview.png)

## Animations

Combat and card placement are animated with **GSAP**:

- Melee attackers lunge toward their target; ranged attackers recoil and
  fire a traveling streak toward theirs.
- Cards shake when they take damage, and a floating damage number pops up
  at the point of impact.
- Cards that die fade out before being removed from the board.
- Cards dealt from hand (or drawn by the AI) fly from their origin to their
  resting slot instead of appearing instantly — from the hand for the
  player, dropping in from above the board for the AI.
- A direct hit to a player's face makes the health number "punch" alongside
  its damage popup.

The board locks interaction (except the long-press preview, which stays
available even mid-replay) while an animated combat sequence plays out, so
you always see the full story of a turn before acting again.

![Melee attack animation](docs/media/melee-attack.gif)
![Card deal animation](docs/media/card-deal.gif)

## Card art pipeline

Cards render with real art when available and fall back to a plain
programmatic frame otherwise — nothing has to opt in or out of art support.
Adding art for a card is just dropping a correctly-named PNG in place:

```
src/assets/cards/
  backs/<type>.png       card back, one per card type
  frames/<type>.png      frame/background, one per card type
  art/<card id>.png      illustration, one per card (e.g. beast_wolf.png)
```

[`render/cardAssets.ts`](src/render/cardAssets.ts) uses `import.meta.glob` to
discover these files automatically at build time — the same "no code change
needed" spirit as the JSON card data below. All discovered textures are
preloaded once via `Assets.load` at startup (`Texture.from` alone does not
trigger a fetch for an unregistered URL, which is a Pixi.js gotcha worth
knowing if textures render blank).

## Card and deck data

Cards have no per-card code: they're JSON records in
[src/data/cards/](src/data/cards/), one file per type, loaded by
[cardLoader.ts](src/data/cardLoader.ts):

```json
{
  "id": "beast_wolf",
  "name": "Lupo Grigio",
  "type": "beast",
  "attack": "2",
  "defense": "1",
  "modifiers": ["FIRST_STRIKE"]
}
```

Mana cost isn't stored on the card — it's derived automatically in
[game/cost.ts](src/game/cost.ts) from attack/defense and modifier weights,
so new cards are balanced consistently without hand-tuning a cost field.

Decks are simple ordered lists of card ids
([src/data/decks/](src/data/decks/)), shuffled at the start of the match by
[game/Deck.ts](src/game/Deck.ts).

## Architecture

```
src/
  types/card.ts        Card data shape and modifiers
  data/
    cards/*.json         Card set, data-driven (beast.json, robot.json)
    decks/*.json         Deck lists (ordered card ids)
    cardLoader.ts         Typed access to the card set
  game/
    CardInstance.ts       Runtime instance of a card (current atk/def, tapped, cost)
    BoardState.ts          Pure board state: 4 lanes, health, slots
    Deck.ts                 Shuffled draw pile
    cost.ts                 Mana cost derivation
    combat.ts               Combat resolution and modifier rules
    ai.ts                   Opponent: reinforce / play / attack
  board/
    Board.ts              Pixi container laying out the 4 lanes and health text
    Lane.ts                A single lane (row of slots) and its CardViews
  hand/
    HandView.ts           Player's hand of cards
  render/
    CardView.ts            Pixi rendering of a single card, incl. long-press gesture
    cardAssets.ts           Art/frame/back asset discovery and preloading
    frames.ts               Fallback programmatic frame style per card type
    animations.ts            GSAP animation helpers (lunge, shake, fade, streak, popups)
  app/Game.ts            Turn state machine; wires DOM HUD to Pixi board interactions
  main.ts                 Entry point, mounts Game into #app
```

The board itself renders entirely on a **Pixi.js canvas**; the HUD (status
text, mana, action buttons, event log) is HTML/CSS overlaid on top, defined
in [index.html](index.html) and wired up from `Game.ts`.

## Development

```bash
npm install
npm run dev       # Vite dev server
npm run build     # type-check + production build
npm run preview   # serve the production build
```

Stack: TypeScript, [Vite](https://vite.dev/), [Pixi.js](https://pixijs.com/) v8,
[GSAP](https://gsap.com/) v3.

## Current state and known limitations

- Only two card types (beast, robot) and five modifiers — the data set is
  intentionally small to validate the engine before expanding it.
- The AI opponent has no trade evaluation or lookahead: it plays cheapest
  cards first and always attacks with everything untapped.
- No persistence, matchmaking, or multiplayer — this is a local, single-tab
  prototype (human vs AI only).
- No sound design yet.
