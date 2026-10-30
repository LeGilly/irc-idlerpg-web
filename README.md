# IdleRPG Web

A browser remake of the classic IRC game [IdleRPG](https://idlerpg.net/): the game that plays itself.

Register a hero, then do nothing. Your hero levels up on their own, finds items, fights other adventurers, gets struck by calamities and blessed by godsends, and is sometimes chosen for quests. The other players in the channel are simulated: a new world starts with 30, and weaker newcomers keep joining over time (quickly at first, then more and more rarely) up to a cap of 100.

- Original rules: 600 x 1.16^level seconds per level, items up to 1.5 x level, battles, critical strikes, unique items, Hand of God, team battles, quests, alignment, the 500x500 map.
- Progress is saved in your browser (localStorage) and keeps going while the page is closed.
- Game speed (1x, 5x, 10x, 60x) can be changed in Settings. Export/import your save there too.
- No penalties: nothing you type counts against you.

Play: https://legilly.github.io/irc-idlerpg-web/

## Versions

The version shown on the site (top left, and in Settings > About) is in `index.html`.
For each release, raise it by one and set every `?v=` number in `index.html` to the same value,
so browsers fetch the fresh CSS/JS. Current version: 5.
