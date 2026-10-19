// Navigation metadata only. No game statistics or animations are supplied here.
// Names follow https://rukaidata.com/P+/; the imported dataset controls availability.
export const catalog = [
  ['bowser', 'Bowser', 'Super Mario'], ['captain-falcon', 'Captain Falcon', 'F-Zero'],
  ['charizard', 'Charizard', 'Pokémon'], ['diddy-kong', 'Diddy Kong', 'Donkey Kong'],
  ['donkey-kong', 'Donkey Kong', 'Donkey Kong'], ['falco', 'Falco', 'Star Fox'],
  ['fox', 'Fox', 'Star Fox'], ['game-watch', 'Game & Watch', 'Game & Watch'],
  ['ganondorf', 'Ganondorf', 'The Legend of Zelda'], ['ice-climbers', 'Ice Climbers', 'Ice Climber'],
  ['ike', 'Ike', 'Fire Emblem'], ['ivysaur', 'Ivysaur', 'Pokémon'],
  ['jigglypuff', 'Jigglypuff', 'Pokémon'], ['king-dedede', 'King Dedede', 'Kirby'],
  ['kirby', 'Kirby', 'Kirby'], ['knuckles', 'Knuckles', 'Sonic the Hedgehog'],
  ['link', 'Link', 'The Legend of Zelda'], ['lucario', 'Lucario', 'Pokémon'],
  ['lucas', 'Lucas', 'Mother'], ['luigi', 'Luigi', 'Super Mario'],
  ['mario', 'Mario', 'Super Mario'], ['marth', 'Marth', 'Fire Emblem'],
  ['meta-knight', 'Meta Knight', 'Kirby'], ['mewtwo', 'Mewtwo', 'Pokémon'],
  ['ness', 'Ness', 'Mother'], ['olimar', 'Olimar', 'Pikmin'],
  ['peach', 'Peach', 'Super Mario'], ['pikachu', 'Pikachu', 'Pokémon'],
  ['pit', 'Pit', 'Kid Icarus'], ['rob', 'R.O.B.', 'R.O.B.'],
  ['roy', 'Roy', 'Fire Emblem'], ['samus', 'Samus', 'Metroid'],
  ['sheik', 'Sheik', 'The Legend of Zelda'], ['snake', 'Snake', 'Metal Gear'],
  ['sonic', 'Sonic', 'Sonic the Hedgehog'], ['squirtle', 'Squirtle', 'Pokémon'],
  ['toon-link', 'Toon Link', 'The Legend of Zelda'], ['wario', 'Wario', 'Wario'],
  ['wolf', 'Wolf', 'Star Fox'], ['yoshi', 'Yoshi', 'Yoshi'],
  ['zelda', 'Zelda', 'The Legend of Zelda'], ['zero-suit-samus', 'Zero Suit Samus', 'Metroid'],
].map(([id, name, series]) => ({ id, name, series }));

export function initials(name: string) {
  return name.replace(/[^\w\s]/g, '').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
