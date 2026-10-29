// IdleRPG Web - game engine
// Rules follow the original #G7 IdleRPG (idlerpg.net) as closely as a
// single-browser game allows. Other players are simulated bots.
'use strict';

const IRPG = (() => {
  const D = IRPG_DATA;
  const SAVE_KEY = 'irc-idlerpg-web-save-v1';
  const DAY = 86400;
  const MAP = 500;
  const LOG_MAX = 500;
  const BOT_COUNT = 30;        // bots in a brand-new world
  const MAX_BOTS = 100;        // newcomers keep joining until this many bots exist
  const JOIN_RATE = 2;         // newcomers per game day at BOT_COUNT, tapering to 0 at MAX_BOTS
  const MAX_CATCHUP_STEPS = 200000;

  let S = null;            // game state
  let listeners = [];      // log listeners
  let clockBase = null;    // {real, game} used to timestamp events
  let away = null;         // summary collected during catch-up

  // ---------- helpers ----------
  const rnd = Math.random;
  const randInt = (a, b) => a + Math.floor(rnd() * (b - a + 1)); // inclusive
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const wrap = v => ((v % MAP) + MAP) % MAP;

  function duration(sec) {
    sec = Math.max(0, Math.round(sec));
    const d = Math.floor(sec / DAY); sec -= d * DAY;
    const h = Math.floor(sec / 3600); sec -= h * 3600;
    const m = Math.floor(sec / 60); const s = sec - m * 60;
    const p = n => String(n).padStart(2, '0');
    return `${d} day${d === 1 ? '' : 's'}, ${p(h)}:${p(m)}:${p(s)}`;
  }

  // Time to go from level L to L+1 (seconds)
  function ttlFor(level) {
    if (level <= 60) return Math.round(600 * Math.pow(1.16, level));
    return Math.round(600 * Math.pow(1.16, 60) + DAY * (level - 60));
  }
  const penalty = (base, level) => Math.round(base * Math.pow(1.14, level));

  function slotLabel(key) { return D.slots.find(s => s.key === key).label; }

  function itemName(slot, lvl) {
    const tier = Math.min(D.itemAdjectives.length - 1, Math.floor(lvl / 20));
    return `${pick(D.itemAdjectives[tier])} ${pick(D.itemNouns[slot])}${lvl >= 10 ? pick(D.itemSuffixes) : ''}`;
  }

  // ---------- players ----------
  const online = () => S.players.filter(p => p.online);
  const me = () => S.players.find(p => p.isMe);
  const byId = id => S.players.find(p => p.id === id);

  function itemSum(p) {
    let s = 0;
    for (const k in p.items) s += p.items[k].lvl;
    return s;
  }
  function battleSum(p) {
    const s = itemSum(p);
    if (p.align === 'g') return Math.floor(s * 1.1);
    if (p.align === 'e') return Math.floor(s * 0.9);
    return s;
  }
  function critChance(p) {
    return p.align === 'g' ? 1 / 50 : p.align === 'e' ? 1 / 20 : 1 / 35;
  }
  function tag(p) { return `${p.name} [${battleSum(p)}]`; }

  function newPlayer(name, cls, align, isMe) {
    return {
      id: 'p' + Math.random().toString(36).slice(2, 10),
      name, cls, align, isMe: !!isMe,
      level: 0, ttl: ttlFor(0), nextTotal: ttlFor(0), idled: 0,
      items: {}, wins: 0, losses: 0,
      x: randInt(0, MAP - 1), y: randInt(0, MAP - 1),
      online: true, onlineSince: S ? S.gameTime : 0, offlineUntil: 0,
      created: Date.now()
    };
  }

  // ---------- logging ----------
  function realNow() {
    if (!clockBase) return Date.now();
    return Math.round(clockBase.real + (S.gameTime - clockBase.game) / S.speed * 1000);
  }
  function log(text, type, involved) {
    const ids = (involved || []).filter(Boolean).map(p => p.id);
    const m = me();
    const mine = !!(m && ids.includes(m.id));
    const entry = { t: realNow(), text, type: type || 'info', mine };
    S.log.push(entry);
    if (S.log.length > LOG_MAX) S.log.splice(0, S.log.length - LOG_MAX);
    if (mine) {
      S.myLog.push(entry);
      if (S.myLog.length > LOG_MAX) S.myLog.splice(0, S.myLog.length - LOG_MAX);
      if (away) away.events++;
    }
    listeners.forEach(fn => fn(entry));
  }

  // ---------- items ----------
  // Original algorithm: for n in 1..1.5*level, with chance 1/(1.4^(n/4)) the item level becomes n.
  function rollItemLevel(level) {
    let lvl = 1;
    const max = Math.floor(level * 1.5);
    for (let n = 1; n <= max; n++) if (rnd() * Math.pow(1.4, n / 4) < 1) lvl = n;
    return lvl;
  }

  function findItem(p, silent) {
    // Unique items: level 25+, 1/40 chance
    if (p.level >= 25 && rnd() < 1 / 40) {
      const eligible = D.uniques.filter(u => p.level >= u.minLevel);
      const u = pick(eligible);
      const lvl = randInt(u.min, u.max);
      const cur = p.items[u.slot];
      if (!cur || cur.lvl < lvl) {
        p.items[u.slot] = { lvl, name: u.name, unique: true };
        if (!silent) log(`The light of the gods shines down upon ${p.name}! They have found the level ${lvl} ${u.name}! Their enemies fall before them as they anticipate their next level.`, 'unique', [p]);
        if (away && p.isMe) away.items++;
        return;
      }
    }
    const slot = pick(D.slots).key;
    const lvl = rollItemLevel(p.level);
    const cur = p.items[slot];
    const label = slotLabel(slot);
    if (!cur || cur.lvl < lvl) {
      const name = itemName(slot, lvl);
      if (!silent) {
        if (cur) log(`${p.name} found a level ${lvl} ${label} (${name})! Their current ${label} is only level ${cur.lvl}, so it seems Luck is with them!`, 'item', [p]);
        else log(`${p.name} found a level ${lvl} ${label} (${name})! It is their first ${label}.`, 'item', [p]);
      }
      p.items[slot] = { lvl, name, unique: false };
      if (away && p.isMe) away.items++;
    } else if (!silent) {
      log(`${p.name} found a level ${lvl} ${label}. Their current ${label} is level ${cur.lvl}, so it seems Luck is against them. They toss the level ${lvl} ${label}.`, 'item-bad', [p]);
    }
  }

  // ---------- level up ----------
  function levelUp(p) {
    p.level++;
    p.nextTotal = ttlFor(p.level);
    p.ttl += p.nextTotal;
    log(`${p.name}, the ${p.cls}, has attained level ${p.level}! Next level in ${duration(p.ttl)}.`, 'level', [p]);
    if (away && p.isMe) away.levels++;
    findItem(p);
    if (p.level < 25 ? rnd() < 0.25 : true) challenge(p, null);
  }

  // ---------- battles ----------
  // opp === null -> random online opponent (or the bot itself)
  function challenge(p, opp, reason) {
    let isBot = false;
    if (!opp) {
      const others = online().filter(o => o !== p);
      if (!others.length) return;
      const i = Math.floor(rnd() * (others.length + 1));
      if (i === others.length) isBot = true; else opp = others[i];
    }
    const mySum = battleSum(p);
    const oppSum = isBot ? Math.max(...S.players.map(itemSum)) + 1 : battleSum(opp);
    const oppName = isBot ? D.botNick : opp.name;
    const myRoll = Math.floor(rnd() * (mySum + 1));
    const oppRoll = Math.floor(rnd() * (oppSum + 1));
    const intro = reason ? reason + ' ' : '';
    const vs = `${p.name} [${myRoll}/${mySum}] has challenged ${oppName} [${oppRoll}/${oppSum}] in combat`;
    const involved = [p, opp];

    if (myRoll > oppRoll) {
      const pct = isBot ? 20 : Math.max(7, Math.floor(opp.level / 4));
      const gain = Math.floor(p.ttl * pct / 100);
      p.ttl -= gain; p.wins++;
      if (away && p.isMe) away.wins++;
      log(`${intro}${vs} and won! ${duration(gain)} is removed from ${p.name}'s clock. ${p.name} reaches next level in ${duration(p.ttl)}.`, 'battle-win', involved);
      if (!isBot) {
        opp.losses++;
        if (rnd() < critChance(p)) {
          const cpct = randInt(5, 25);
          const dmg = Math.floor(opp.ttl * cpct / 100);
          opp.ttl += dmg;
          log(`${p.name} has dealt ${opp.name} a Critical Strike! ${duration(dmg)} is added to ${opp.name}'s clock. ${opp.name} reaches next level in ${duration(opp.ttl)}.`, 'crit', involved);
        } else if (rnd() < 0.019) {
          trySteal(p, opp, 'battle');
        }
      }
    } else {
      const pct = isBot ? 10 : Math.max(7, Math.floor(opp.level / 7));
      const loss = Math.floor(p.ttl * pct / 100);
      p.ttl += loss; p.losses++;
      if (!isBot) opp.wins++;
      if (away && p.isMe) away.losses++;
      log(`${intro}${vs} and lost! ${duration(loss)} is added to ${p.name}'s clock. ${p.name} reaches next level in ${duration(p.ttl)}.`, 'battle-loss', involved);
    }
  }

  // Swap a random better item from victim to thief
  function trySteal(thief, victim, how) {
    const slot = pick(D.slots).key;
    const mine = thief.items[slot], theirs = victim.items[slot];
    const label = slotLabel(slot);
    if (theirs && (!mine || theirs.lvl > mine.lvl)) {
      thief.items[slot] = theirs;
      if (mine) victim.items[slot] = mine; else delete victim.items[slot];
      if (how === 'battle') log(`In the fierce battle, ${victim.name} dropped their level ${theirs.lvl} ${label}! ${thief.name} picks it up, tossing their old ${mine ? 'level ' + mine.lvl + ' ' : ''}${label} to ${victim.name}.`, 'steal', [thief, victim]);
      else log(`${thief.name} stole ${victim.name}'s level ${theirs.lvl} ${label} while they were sleeping! ${thief.name} leaves their old ${mine ? 'level ' + mine.lvl + ' ' : ''}${label} behind, which ${victim.name} then takes.`, 'steal', [thief, victim]);
      return true;
    }
    if (how !== 'battle') log(`${thief.name} tried to steal from ${victim.name}, but found nothing worth taking and slunk away.`, 'info', [thief, victim]);
    return false;
  }

  function teamBattle() {
    const on = online();
    if (on.length < 6) return;
    const six = shuffle(on).slice(0, 6);
    const A = six.slice(0, 3), B = six.slice(3);
    const sumA = A.reduce((s, p) => s + battleSum(p), 0);
    const sumB = B.reduce((s, p) => s + battleSum(p), 0);
    const rA = Math.floor(rnd() * (sumA + 1)), rB = Math.floor(rnd() * (sumB + 1));
    const minTtl = Math.min(...A.map(p => p.ttl));
    const amount = Math.floor(minTtl * 0.2);
    const names = t => t.map(p => p.name).join(', ');
    if (rA > rB) {
      A.forEach(p => { p.ttl -= amount; });
      log(`${names(A)} [${rA}/${sumA}] have team battled ${names(B)} [${rB}/${sumB}] and won! ${duration(amount)} is removed from their clocks.`, 'battle-win', six);
    } else {
      A.forEach(p => { p.ttl += amount; });
      log(`${names(A)} [${rA}/${sumA}] have team battled ${names(B)} [${rB}/${sumB}] and lost! ${duration(amount)} is added to their clocks.`, 'battle-loss', six);
    }
  }

  // ---------- random events ----------
  function handOfGod() {
    const p = pick(online());
    if (!p) return;
    const pct = randInt(5, 75);
    const amount = Math.floor(p.ttl * pct / 100);
    if (rnd() < 0.8) {
      p.ttl -= amount;
      log(`Verily I say unto thee, the Heavens have burst forth, and the blessed hand of God carried ${p.name} ${duration(amount)} toward level ${p.level + 1}. ${p.name} reaches next level in ${duration(p.ttl)}.`, 'god', [p]);
    } else {
      p.ttl += amount;
      log(`Thereupon He stretched out His little finger among them and consumed ${p.name} with fire, slowing the heathen ${duration(amount)} from level ${p.level + 1}. ${p.name} reaches next level in ${duration(p.ttl)}.`, 'god-bad', [p]);
    }
  }

  function itemEvent(p, up) {
    const owned = Object.keys(p.items);
    if (!owned.length) return false;
    const slot = pick(owned);
    const it = p.items[slot];
    const before = it.lvl;
    it.lvl = up ? Math.ceil(it.lvl * 1.1) : Math.floor(it.lvl * 0.9);
    if (it.lvl === before && up) it.lvl++;
    const text = (up ? D.godsendItems : D.calamityItems)[slot].replace(/\{n\}/g, p.name);
    log(`${text} ${p.name}'s ${slotLabel(slot)} ${up ? 'gains' : 'loses'} 10% of its effectiveness (level ${before} → ${it.lvl}).`, up ? 'good' : 'bad', [p]);
    return true;
  }

  function calamity() {
    const p = pick(online());
    if (!p) return;
    if (rnd() < 0.1 && itemEvent(p, false)) return;
    const pct = randInt(5, 12);
    const amount = Math.floor(p.ttl * pct / 100);
    p.ttl += amount;
    log(`${pick(D.calamities).replace(/\{n\}/g, p.name)} This terrible calamity has slowed them ${duration(amount)} from level ${p.level + 1}. ${p.name} reaches next level in ${duration(p.ttl)}.`, 'bad', [p]);
  }

  function godsend() {
    const p = pick(online());
    if (!p) return;
    if (rnd() < 0.1 && itemEvent(p, true)) return;
    const pct = randInt(5, 12);
    const amount = Math.floor(p.ttl * pct / 100);
    p.ttl -= amount;
    log(`${pick(D.godsends).replace(/\{n\}/g, p.name)} This wondrous godsend has accelerated them ${duration(amount)} towards level ${p.level + 1}. ${p.name} reaches next level in ${duration(p.ttl)}.`, 'good', [p]);
  }

  function goodness() {
    const good = shuffle(online().filter(p => p.align === 'g'));
    if (good.length < 2) return;
    const [a, b] = good;
    const pct = randInt(5, 12);
    const ga = Math.floor(a.ttl * pct / 100), gb = Math.floor(b.ttl * pct / 100);
    a.ttl -= ga; b.ttl -= gb;
    log(`${a.name} and ${b.name} have not let the iniquities of evil men poison them. Together have they prayed to their god, and it is his light that now shines upon them. ${pct}% of their time is removed from their clocks.`, 'good', [a, b]);
  }

  function evilness() {
    const evil = online().filter(p => p.align === 'e');
    if (!evil.length) return;
    const p = pick(evil);
    if (rnd() < 0.5) {
      const good = online().filter(o => o.align === 'g');
      if (good.length) trySteal(p, pick(good), 'evil');
    } else {
      const pct = randInt(1, 5);
      const amount = Math.floor(p.ttl * pct / 100);
      p.ttl += amount;
      log(`${p.name} is forsaken by their evil god. ${duration(amount)} is added to their clock. ${p.name} reaches next level in ${duration(p.ttl)}.`, 'bad', [p]);
    }
  }

  // ---------- quests ----------
  function startQuest() {
    const cands = online().filter(p => p.level >= 40 && S.gameTime - p.onlineSince > 36000);
    if (cands.length < 4) { S.nextQuestAt = S.gameTime + 3600; return; }
    const members = shuffle(cands).slice(0, 4);
    const names = members.map(p => p.name);
    const list = `${names.slice(0, 3).join(', ')}, and ${names[3]}`;
    if (rnd() < 0.5) {
      const len = randInt(12 * 3600, 24 * 3600);
      S.quest = { type: 'time', members: members.map(p => p.id), text: pick(D.quests), endsAt: S.gameTime + len };
      log(`${list} have been chosen by the gods to ${S.quest.text}. Quest to end in ${duration(len)}.`, 'quest', members);
    } else {
      const goals = [[randInt(20, MAP - 20), randInt(20, MAP - 20)], [randInt(20, MAP - 20), randInt(20, MAP - 20)]];
      S.quest = { type: 'grid', members: members.map(p => p.id), text: pick(D.gridQuests), goals, stage: 0, startedAt: S.gameTime };
      log(`${list} have been chosen by the gods to ${S.quest.text}. Participants must first reach [${goals[0]}], then [${goals[1]}].`, 'quest', members);
    }
  }

  function endQuest(success) {
    const q = S.quest;
    const members = q.members.map(byId).filter(Boolean);
    S.quest = null;
    S.nextQuestAt = S.gameTime + 6 * 3600;
    if (success) {
      members.forEach(p => { p.ttl -= Math.floor(p.ttl * 0.25); });
      log(`${members.map(p => p.name).join(', ')} have blessed the realm by completing their quest! 25% of their burden is eliminated.`, 'quest', members);
      if (away && members.some(p => p.isMe)) away.quests++;
    } else {
      const on = online();
      on.forEach(p => { p.ttl += penalty(15, p.level); });
      log(`The quest has failed because a hero abandoned it! The gods are angered, and every online player is penalised (15 × 1.14^level seconds).`, 'quest-bad', on);
    }
  }

  function questTick(step) {
    const q = S.quest;
    if (!q) { if (S.gameTime >= S.nextQuestAt) startQuest(); return; }
    const members = q.members.map(byId);
    if (members.some(p => !p || !p.online)) { endQuest(false); return; }
    if (q.type === 'time') {
      if (S.gameTime >= q.endsAt) endQuest(true);
      return;
    }
    // grid quest: walk toward the current goal, 1 unit per game second
    const [gx, gy] = q.goals[q.stage];
    let arrived = 0;
    members.forEach(p => {
      const dx = gx - p.x, dy = gy - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= step) { p.x = gx; p.y = gy; arrived++; }
      else { p.x = Math.round(p.x + dx / dist * step); p.y = Math.round(p.y + dy / dist * step); }
    });
    if (arrived === members.length) {
      if (q.stage === 0) {
        q.stage = 1;
        log(`${members.map(p => p.name).join(', ')} have reached [${q.goals[0]}] and now head for [${q.goals[1]}].`, 'quest', members);
      } else endQuest(true);
    }
  }

  // ---------- bots joining / leaving ----------
  function botPresence(step) {
    for (const p of S.players) {
      if (p.isMe) continue;
      if (p.online) {
        const questing = S.quest && S.quest.members.includes(p.id);
        if (rnd() < (questing ? 1 / 30 : 1 / 3) * step / DAY) {
          p.online = false;
          p.offlineUntil = S.gameTime + randInt(3600, 16 * 3600);
          log(`${p.name} has quit IRC (${pick(D.quitReasons)})`, 'quit', [p]);
        }
      } else if (S.gameTime >= p.offlineUntil) {
        p.online = true;
        p.onlineSince = S.gameTime;
        log(`${p.name}, the level ${p.level} ${p.cls}, is now online. Next level in ${duration(p.ttl)}.`, 'join', [p]);
      }
    }
  }

  // ---------- newcomers ----------
  function newBotName() {
    const taken = new Set(S.players.map(p => p.name.toLowerCase()));
    const unused = D.botNames.filter(n => !taken.has(n.toLowerCase()));
    if (unused.length && rnd() < 0.5) return pick(unused);
    for (let i = 0; i < 100; i++) {
      let n = pick(D.nickRoots) + pick(D.nickSuffixes);
      if (rnd() < 0.35) n = n.toLowerCase();
      if (n.length <= 16 && !taken.has(n.toLowerCase())) return n;
    }
    let n;
    do { n = 'newbie' + randInt(100, 99999); } while (taken.has(n));
    return n;
  }

  // New, weaker players join over time; the closer to MAX_BOTS, the rarer.
  function botJoins(dt) {
    const bots = S.players.length - 1;
    if (bots >= MAX_BOTS) return;
    const perDay = JOIN_RATE * (MAX_BOTS - bots) / (MAX_BOTS - BOT_COUNT);
    if (rnd() >= perDay * dt / DAY) return;
    const b = newPlayer(newBotName(), pick(D.botClasses), pick(['g', 'n', 'n', 'e']), false);
    S.players.push(b);
    log(`${b.name}, the ${b.cls}, has joined ${D.channel}! A new adventurer begins to idle. Next level in ${duration(b.ttl)}.`, 'join', [b]);
  }

  // ---------- core simulation step ----------
  function step(dt) {
    S.gameTime += dt;
    const on = online();
    const n = on.length;

    // movement (random walk; for large steps use the matching normal approximation)
    const qm = S.quest && S.quest.type === 'grid' ? S.quest.members : [];
    for (const p of on) {
      if (qm.includes(p.id)) continue;
      if (dt === 1) { p.x = wrap(p.x + randInt(-1, 1)); p.y = wrap(p.y + randInt(-1, 1)); }
      else { const sd = Math.sqrt(dt * 2 / 3); p.x = wrap(Math.round(p.x + gauss() * sd)); p.y = wrap(Math.round(p.y + gauss() * sd)); }
    }

    // clocks
    for (const p of on) {
      p.ttl -= dt; p.idled += dt;
      let guard = 0;
      while (p.ttl <= 0 && guard++ < 50) levelUp(p);
    }

    // per-online-user daily events
    const f = dt / DAY;
    if (rnd() < n * f / 20) handOfGod();
    if (rnd() < n * f / 4) teamBattle();
    if (rnd() < n * f / 8) calamity();
    if (rnd() < n * f / 8) godsend();
    // global daily events
    if (rnd() < f / 12) goodness();
    if (rnd() < f / 8) evilness();

    // grid encounters: two players meeting on a square, then battle with chance 1/n
    if (n > 1) {
      const pairs = n * (n - 1) / 2;
      if (rnd() < pairs / (MAP * MAP) * dt / n) {
        const [a, b] = shuffle(on);
        b.x = a.x; b.y = a.y;
        challenge(a, b, `${a.name} and ${b.name} meet at [${a.x},${a.y}].`);
      }
    }

    // level 45+ hourly battles
    if (S.gameTime >= S.nextHourly) {
      S.nextHourly += 3600;
      const high = on.filter(p => p.level >= 45);
      if (n > 1 && high.length / n > 0.15) {
        const a = pick(high);
        const b = pick(on.filter(p => p !== a));
        challenge(a, b, 'The hour strikes and the veterans grow restless.');
      }
    }

    questTick(dt);
    botPresence(dt);
    botJoins(dt);
  }

  // Advance the world by gameSeconds of game time.
  function advance(gameSeconds) {
    if (gameSeconds <= 0) return;
    let size = 1;
    if (gameSeconds > 3600) size = Math.max(60, gameSeconds / MAX_CATCHUP_STEPS);
    let remaining = gameSeconds;
    while (remaining > 0) {
      const dt = Math.min(size, remaining);
      step(dt);
      remaining -= dt;
    }
  }

  // ---------- world creation ----------
  function createWorld(name, cls, align, speed) {
    S = {
      version: 1, created: Date.now(), lastReal: Date.now(), gameTime: 0, speed: speed || 1,
      players: [], log: [], myLog: [], quest: null, nextQuestAt: 2 * 3600, nextHourly: 3600
    };
    const names = shuffle(D.botNames).slice(0, BOT_COUNT);
    for (const bn of names) {
      const b = newPlayer(bn, pick(D.botClasses), pick(['g', 'n', 'n', 'e']), false);
      const lvl = Math.floor(52 * Math.pow(rnd(), 1.3));
      for (let l = 1; l <= lvl; l++) { b.level = l; findItem(b, true); }
      b.level = lvl;
      b.nextTotal = ttlFor(lvl);
      b.ttl = Math.max(1, Math.floor(b.nextTotal * rnd()));
      b.onlineSince = -randInt(0, 30 * DAY);
      b.idled = Array.from({ length: lvl }, (_, i) => ttlFor(i)).reduce((a, c) => a + c, 0);
      b.wins = randInt(0, lvl * 2); b.losses = randInt(0, lvl * 2);
      S.players.push(b);
    }
    const p = newPlayer(name, cls, align, true);
    S.players.push(p);
    log(`Welcome to ${D.channel}, ${p.name}! ${p.name}, the ${p.cls}, has registered and begins to idle. Next level in ${duration(p.ttl)}.`, 'join', [p]);
    save();
  }

  // ---------- persistence ----------
  function save() {
    if (!S) return;
    S.lastReal = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !data.players) return false;
      S = data;
      return true;
    } catch (e) { return false; }
  }
  function exportSave() { save(); return JSON.stringify(S); }
  function importSave(json) {
    const data = JSON.parse(json);
    if (!data || !Array.isArray(data.players) || !data.players.some(p => p.isMe)) throw new Error('Not a valid IdleRPG save');
    S = data; S.lastReal = Date.now(); save();
  }
  function reset() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } S = null; }

  // ---------- real-time driver ----------
  // Simulate everything between the last processed moment and now.
  // Returns an "away" summary if the gap was long.
  function catchUp(nowReal) {
    nowReal = nowReal || Date.now();
    const realGap = Math.max(0, (nowReal - S.lastReal) / 1000);
    const gameGap = realGap * S.speed;
    const m = me();
    const summarise = realGap > 120;
    if (summarise) away = { realGap, gameGap, levelFrom: m.level, levels: 0, items: 0, wins: 0, losses: 0, quests: 0, events: 0 };
    clockBase = { real: S.lastReal, game: S.gameTime };
    advance(gameGap);
    clockBase = null;
    S.lastReal = nowReal;
    const result = away; away = null;
    if (result) result.levelTo = m.level;
    return result;
  }

  function setSpeed(v) { S.speed = v; }
  function setAlign(a) {
    const p = me(); p.align = a;
    const word = { g: 'good', n: 'neutral', e: 'evil' }[a];
    log(`${p.name} has changed alignment to: ${word}.`, 'info', [p]);
  }

  return {
    D, MAP, DAY,
    get state() { return S; },
    me, online, itemSum, battleSum, ttlFor, duration, slotLabel,
    createWorld, load, save, reset, exportSave, importSave, catchUp, advance,
    setSpeed, setAlign,
    onLog(fn) { listeners.push(fn); }
  };
})();
