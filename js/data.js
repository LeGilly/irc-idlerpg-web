// IdleRPG Web - static game data (names, flavour text, items)
'use strict';

const IRPG_DATA = {
  botNick: 'IdleBot',
  channel: '#idlerpg',

  // Item slots, as in the original game (one of each).
  slots: [
    { key: 'ring',     label: 'ring' },
    { key: 'amulet',   label: 'amulet' },
    { key: 'charm',    label: 'charm' },
    { key: 'weapon',   label: 'weapon' },
    { key: 'helm',     label: 'helm' },
    { key: 'tunic',    label: 'tunic' },
    { key: 'gloves',   label: 'pair of gloves' },
    { key: 'leggings', label: 'set of leggings' },
    { key: 'shield',   label: 'shield' },
    { key: 'boots',    label: 'pair of boots' }
  ],

  // Flavour names for ordinary items (the original only said "level 12 helm").
  itemNouns: {
    ring:     ['Band', 'Signet', 'Loop', 'Ring', 'Circlet'],
    amulet:   ['Amulet', 'Pendant', 'Talisman', 'Locket', 'Medallion'],
    charm:    ['Charm', 'Trinket', 'Rabbit Foot', 'Lucky Coin', 'Bauble'],
    weapon:   ['Sword', 'Axe', 'Mace', 'Dagger', 'Spear', 'Flail', 'Staff', 'Halberd'],
    helm:     ['Helm', 'Cap', 'Coif', 'Crown', 'Hood'],
    tunic:    ['Tunic', 'Mail', 'Cuirass', 'Robe', 'Jerkin'],
    gloves:   ['Gloves', 'Gauntlets', 'Mitts', 'Bracers'],
    leggings: ['Leggings', 'Greaves', 'Breeches', 'Chausses'],
    shield:   ['Shield', 'Buckler', 'Kite Shield', 'Tower Shield', 'Aegis'],
    boots:    ['Boots', 'Sabatons', 'Sandals', 'Treads', 'Clogs']
  },
  itemAdjectives: [
    // roughly ordered from junk to legendary
    ['Rusty', 'Cracked', 'Moth-eaten', 'Bent', 'Soggy', 'Chipped', 'Wobbly'],
    ['Plain', 'Sturdy', 'Iron', 'Leather', 'Oaken', 'Trusty', 'Polished'],
    ['Steel', 'Fine', 'Silvered', 'Runed', 'Gleaming', 'Tempered', 'Elven'],
    ['Mithril', 'Enchanted', 'Ancient', 'Dragonbone', 'Blessed', 'Starforged', 'Obsidian'],
    ['Godforged', 'Mythic', 'Eternal', 'Celestial', 'Abyssal', 'Legendary', 'Infinite']
  ],
  itemSuffixes: ['', '', '', ' of Idling', ' of the Lurker', ' of Patience', ' of Netsplits',
    ' of the Away Message', ' of Ping Timeouts', ' of Lag', ' of the Op', ' of Silence', ' of /away'],

  // Unique items (v2.1.2 of the original). minLevel = required user level.
  uniques: [
    { name: "Mattt's Omniscience Grand Crown",        slot: 'helm',   min: 50,  max: 74,  minLevel: 25 },
    { name: "Juliet's Glorious Ring of Sparkliness",  slot: 'ring',   min: 50,  max: 74,  minLevel: 25 },
    { name: "Res0's Protectorate Plate Mail",         slot: 'tunic',  min: 75,  max: 99,  minLevel: 30 },
    { name: "Dwyn's Storm Magic Amulet",              slot: 'amulet', min: 100, max: 124, minLevel: 35 },
    { name: "Jotun's Fury Colossal Sword",            slot: 'weapon', min: 150, max: 174, minLevel: 40 },
    { name: "Drdink's Cane of Blind Rage",            slot: 'weapon', min: 175, max: 200, minLevel: 45 },
    { name: "Mrquick's Magical Boots of Swiftness",   slot: 'boots',  min: 250, max: 300, minLevel: 48 },
    { name: "Jeff's Cluehammer of Doom",              slot: 'weapon', min: 300, max: 350, minLevel: 52 }
  ],

  // Simulated adventurers
  botNames: [
    'Zorgoth', 'n00bslayer', 'Kittyhawk', 'lurkmaster', 'Brannigan', 'Xyzzy', 'Mordecai', 'pixelpush',
    'Thrumbo', 'Valeria', 'grep_mage', 'SirIdlesAlot', 'Quillon', 'Ashkettle', 'netsplit', 'Fenwick',
    'Morrigan', 'dr_away', 'Pelagius', 'Tinderbox', 'zzzap', 'Halvard', 'Ophelia', 'kludge',
    'Borgnine', 'Wynnifred', 'ctrl_alt_del', 'Grimsby', 'Esmerelda', 'Snorri', 'chanop', 'Taliesin',
    'Bramblewick', 'm0rph', 'Isolde', 'Gundabad'
  ],
  // Parts used to invent nicks for newcomers once the list above runs out
  nickRoots: ['Grim', 'Shadow', 'Pixel', 'Byte', 'Moss', 'Frost', 'Ember', 'Rune', 'Ash', 'Storm', 'Lag',
    'Echo', 'Nyx', 'Bolt', 'Fang', 'Wisp', 'Thorn', 'Quill', 'Rook', 'Vex', 'Bramble', 'Cinder', 'Dusk',
    'Gloom', 'Hex', 'Iron', 'Jinx', 'Krag', 'Loot', 'Mire', 'Noob', 'Oak', 'Pip', 'Rust', 'Sock', 'Toad', 'Zed'],
  nickSuffixes: ['', '', 'ly', 'wick', 'bane', 'fist', '_', '2000', '99', 'x', 'er', 'heart', 'smith',
    'song', '42', 'z', '_irc', 'o', 'kin', 'ton'],

  botClasses: [
    'Wizard of the Third Byte', 'Paladin of Perpetual AFK', 'Barbarian', 'Necromancer of Old Logs',
    'Bard Who Never Speaks', 'Ranger', 'Rogue', 'Cleric of the Ping', 'Druid', 'Knight of the Topic',
    'Warlock', 'Monk of Silence', 'Sorceress', 'Lurker Supreme', 'Battle Accountant', 'Grand Idler',
    'Tavern Philosopher', 'Gnome Engineer', 'Swordmaster', 'Hermit', 'Apprentice Mage', 'Dragon Botherer',
    'Professional Napper', 'Archmage of /away', 'Squire', 'Shadow Knight'
  ],
  quitReasons: ['Ping timeout', 'Connection reset by peer', 'Quit: zzz', 'Read error: EOF from client',
    'Quit: brb', 'Remote host closed the connection', 'Excess Flood', 'Quit: Leaving', 'Netsplit'],

  // Calamities (bad luck). {n} = nick, {t} = time
  calamities: [
    '{n} tripped over a sleeping dragon and spent a while apologising.',
    '{n} was swallowed by a gelatinous cube and slowly spat back out.',
    '{n} got lost in a maze of twisty little passages, all alike.',
    '{n} was mistaken for a goblin and chased out of town.',
    '{n} fell asleep at the tavern and missed the caravan.',
    '{n} stepped on a rake. Twice.',
    '{n} was cursed by a grumpy witch for not saying hello.',
    '{n} spent hours arguing with a troll about bridge tolls.',
    '{n} was caught in a netsplit and wandered the void.',
    '{n} slipped into a bog and had to be fished out by a heron.',
    '{n} ate a suspicious mushroom and saw colours for a day.',
    '{n} got stuck behind a very slow procession of snails.'
  ],
  calamityItems: {
    ring:     '{n} accidentally dropped their ring down a well.',
    amulet:   "{n}'s amulet was nibbled by a hungry magpie.",
    charm:    "{n}'s lucky charm turned out to be not so lucky.",
    weapon:   "{n}'s weapon was blunted on a stubborn rock.",
    helm:     "{n}'s helm got dented by a falling coconut.",
    tunic:    "{n}'s tunic shrank in the wash.",
    gloves:   "{n}'s gloves were eaten by moths.",
    leggings: "{n}'s leggings ripped while climbing a fence.",
    shield:   "{n}'s shield was used as a sled and got scratched.",
    boots:    "{n}'s boots were filled with wet sand by a prankster."
  },
  godsends: [
    '{n} found a shortcut through the Whispering Woods.',
    '{n} was carried for a while by a friendly giant eagle.',
    '{n} drank a potion of haste left on a tavern table.',
    '{n} was blessed by a wandering monk.',
    '{n} caught a magic carpet heading the right way.',
    '{n} received directions from a surprisingly helpful goblin.',
    '{n} found a stable of fast horses with no owner around.',
    '{n} was inspired by a bard’s song and marched on with vigour.',
    '{n} discovered an ancient teleport rune that still works.',
    '{n} slept extremely well and woke up refreshed.',
    '{n} found a map that was, for once, accurate.'
  ],
  godsendItems: {
    ring:     "{n}'s ring was polished by a kind jeweller.",
    amulet:   "{n}'s amulet was blessed in a moonlit shrine.",
    charm:    "{n}'s charm was kissed by a fairy.",
    weapon:   "{n}'s weapon was sharpened by a master smith.",
    helm:     "{n}'s helm was reinforced with dwarven steel.",
    tunic:    "{n}'s tunic was embroidered with protective runes.",
    gloves:   "{n}'s gloves were enchanted with a firm grip.",
    leggings: "{n}'s leggings were patched with dragonhide.",
    shield:   "{n}'s shield was emblazoned with a holy symbol.",
    boots:    "{n}'s boots were re-soled by a cobbler elf."
  },

  quests: [
    'rescue the princess of Byte from the Dragon of Lag',
    'recover the lost Topic of the Ancients',
    'slay the Hydra of Spam before it floods the channel',
    'deliver a strongly worded letter to the Lich King',
    'retrieve the Holy Grail of Uptime',
    'find the missing ops of the Old Channel',
    'escort a very nervous duck across the Desert of Idling',
    'banish the Netsplit Demon back to its realm'
  ],
  gridQuests: [
    'journey to the Shrine of Silence and then to the Tower of Patience',
    'carry the Sacred Pillow to the Sleeping Mountain, then to the Lake of Dreams',
    'chase the Thief of Bandwidth to his hideout and then to his second hideout'
  ]
};
