// IdleRPG Web - user interface
'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const D = IRPG.D;
  const LOG_DOM_MAX = 400;
  const ALIGN = { g: 'Good', n: 'Neutral', e: 'Evil' };
  const ALIGN_SYM = { g: '+', n: '·', e: '−' };

  let filter = 'all';
  let bulk = false;           // suppress per-line rendering during catch-up
  let inspectId = null;
  let activePanel = 'char';
  let tickTimer = null;
  let saveTimer = null;
  const transient = [];       // command replies (not saved)

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hhmm = t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

  function shortDur(sec) {
    sec = Math.max(0, Math.round(sec));
    const d = Math.floor(sec / 86400); sec %= 86400;
    const h = Math.floor(sec / 3600); sec %= 3600;
    const m = Math.floor(sec / 60); const s = sec % 60;
    const p = n => String(n).padStart(2, '0');
    return (d ? d + 'd ' : '') + `${p(h)}:${p(m)}:${p(s)}`;
  }
  function humanDur(sec) {
    sec = Math.round(sec);
    if (sec < 60) return sec + ' seconds';
    if (sec < 3600) return Math.round(sec / 60) + ' minutes';
    if (sec < 86400) return (sec / 3600).toFixed(1).replace('.0', '') + ' hours';
    return (sec / 86400).toFixed(1).replace('.0', '') + ' days';
  }

  // ---------- log ----------
  function lineHtml(e) {
    let msg = esc(e.text);
    const m = IRPG.me();
    if (m) msg = msg.replace(new RegExp('\\b' + escRe(esc(m.name)) + '\\b', 'g'), `<span class="me-name">${esc(m.name)}</span>`);
    const nick = e.type === 'notice' ? `-${D.botNick}-` : e.type === 'cmd' ? '&gt;' : `&lt;${D.botNick}&gt;`;
    return `<div class="line t-${esc(e.type)}${e.mine && filter === 'all' ? ' mine' : ''}"><span class="ts">[${hhmm(e.t)}]</span><span class="nick">${nick}</span><span class="msg">${msg}</span></div>`;
  }

  function nearBottom(el) { return el.scrollHeight - el.scrollTop - el.clientHeight < 60; }

  function appendLine(e) {
    const el = $('log');
    const stick = nearBottom(el);
    el.insertAdjacentHTML('beforeend', lineHtml(e));
    while (el.childElementCount > LOG_DOM_MAX) el.firstElementChild.remove();
    if (stick) el.scrollTop = el.scrollHeight;
  }

  function renderLog() {
    const S = IRPG.state;
    const el = $('log');
    const src = filter === 'mine' ? S.myLog : S.log;
    const all = src.concat(transient).sort((a, b) => a.t - b.t).slice(-LOG_DOM_MAX);
    el.innerHTML = all.map(lineHtml).join('');
    el.scrollTop = el.scrollHeight;
  }

  IRPG.onLog(e => {
    if (bulk) return;
    if (filter === 'mine' && !e.mine) return;
    appendLine(e);
  });

  function notice(text, type) {
    const e = { t: Date.now(), text, type: type || 'notice', mine: true };
    transient.push(e);
    if (transient.length > 50) transient.shift();
    appendLine(e);
  }

  // ---------- hero panel ----------
  function renderHero() {
    const S = IRPG.state, m = IRPG.me();
    $('heroName').textContent = m.name;
    $('heroClass').textContent = 'the ' + m.cls;
    $('heroLevel').textContent = m.level;
    const pct = Math.max(0, Math.min(100, (1 - m.ttl / m.nextTotal) * 100));
    $('heroBar').style.width = pct.toFixed(2) + '%';
    $('heroTtl').textContent = IRPG.duration(m.ttl);
    $('heroReal').textContent = S.speed > 1 ? `≈ ${shortDur(m.ttl / S.speed)} real time at ${S.speed}×` : '';
    $('heroAlign').textContent = ALIGN[m.align];
    const sum = IRPG.itemSum(m), bsum = IRPG.battleSum(m);
    $('heroSum').textContent = sum + (bsum !== sum ? ` (${bsum} in battle)` : '');
    $('heroWL').textContent = `${m.wins} won / ${m.losses} lost`;
    $('heroRank').textContent = `${ranked().indexOf(m) + 1} of ${S.players.length}`;
    $('heroIdled').textContent = IRPG.duration(m.idled);
    $('heroPos').textContent = `[${m.x}, ${m.y}]`;

    $('items').innerHTML = itemsHtml(m);

    const q = S.quest;
    if (q) {
      const names = q.members.map(id => (S.players.find(p => p.id === id) || {}).name).join(', ');
      const status = q.type === 'time'
        ? `ends in ${IRPG.duration(q.endsAt - S.gameTime)}`
        : `heading for [${q.goals[q.stage]}] (goal ${q.stage + 1} of 2)`;
      $('questBox').innerHTML = `<b>Quest:</b> ${esc(names)} must ${esc(q.text)} &mdash; ${esc(status)}.`;
    } else $('questBox').innerHTML = '';
  }

  function itemsHtml(p) {
    return D.slots.map(s => {
      const it = p.items[s.key];
      const name = it ? `<span class="${it.unique ? 'unique' : ''}">${esc(it.name)}</span>` : '<span class="none">none</span>';
      return `<tr><td class="slot">${esc(s.label)}</td><td>${name}</td><td class="lvl">${it ? esc(it.lvl) : ''}</td></tr>`;
    }).join('');
  }

  // ---------- players ----------
  function ranked() {
    return IRPG.state.players.slice().sort((a, b) => b.level - a.level || a.ttl - b.ttl);
  }
  function renderPlayers() {
    const rows = ranked().map((p, i) => {
      const cls = [p.isMe ? 'me' : '', p.online ? '' : 'offline'].join(' ');
      return `<tr class="${cls}" data-id="${esc(p.id)}"><td>${i + 1}</td><td class="name"><span class="al al-${esc(p.align)}">${ALIGN_SYM[p.align] || ''}</span>${esc(p.name)}</td><td>${esc(p.level)}</td><td>${esc(IRPG.itemSum(p))}</td><td>${p.online ? shortDur(p.ttl) : 'offline'}</td></tr>`;
    });
    $('playersBody').innerHTML = rows.join('');
    renderInspect();
  }
  function renderInspect() {
    const p = inspectId && IRPG.state.players.find(x => x.id === inspectId);
    if (!p) { $('inspect').innerHTML = '<p class="hint">Click a player to see their equipment.</p>'; return; }
    $('inspect').innerHTML = `<h4>${esc(p.name)}, the level ${esc(p.level)} ${esc(p.cls)}</h4>
      <p class="hint">${esc(ALIGN[p.align] || '')} &middot; ${p.online ? 'online' : 'offline'} &middot; ${esc(p.wins)} won / ${esc(p.losses)} lost &middot; idled ${esc(humanDur(p.idled))} &middot; at [${esc(p.x)}, ${esc(p.y)}]</p>
      <table class="items">${itemsHtml(p)}</table>`;
  }

  // ---------- map ----------
  function renderMap() {
    const c = $('map'), ctx = c.getContext('2d');
    const S = IRPG.state;
    ctx.fillStyle = '#0b0e11'; ctx.fillRect(0, 0, 500, 500);
    ctx.strokeStyle = '#161b22'; ctx.lineWidth = 1;
    for (let i = 50; i < 500; i += 50) {
      ctx.beginPath(); ctx.moveTo(i + .5, 0); ctx.lineTo(i + .5, 500); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i + .5); ctx.lineTo(500, i + .5); ctx.stroke();
    }
    const qm = S.quest ? S.quest.members : [];
    if (S.quest && S.quest.type === 'grid') {
      S.quest.goals.forEach((g, i) => {
        ctx.strokeStyle = '#d2a8ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(g[0], g[1], 10, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#d2a8ff'; ctx.font = '12px monospace'; ctx.fillText(String(i + 1), g[0] + 13, g[1] + 4);
      });
    }
    let mine = null;
    for (const p of S.players) {
      if (!p.online) continue;
      if (p.isMe) { mine = p; continue; }
      ctx.fillStyle = qm.includes(p.id) ? '#ffa657' : '#58a6ff';
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (mine) {
      ctx.fillStyle = '#ffd866';
      ctx.beginPath(); ctx.arc(mine.x, mine.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.font = 'bold 13px monospace';
      const tx = mine.x > 400 ? mine.x - 10 - ctx.measureText(mine.name).width : mine.x + 10;
      ctx.fillText(mine.name, tx, mine.y - 8);
    }
  }

  // ---------- global render ----------
  function render() {
    const S = IRPG.state, m = IRPG.me();
    const on = IRPG.online().length;
    $('onlineCount').textContent = `${on} online · ${S.speed}×`;
    const q = S.quest ? 'A quest is under way!' : 'No quest at the moment.';
    $('topic').textContent = `Topic: Welcome to IdleRPG Web — the game that plays itself. Idle and be rewarded. | ${q}`;
    document.title = `L${m.level} · ${shortDur(m.ttl)} — IdleRPG`;
    if (activePanel === 'char') renderHero();
    if (activePanel === 'players') renderPlayers();
    if (activePanel === 'map') renderMap();
  }

  // ---------- game loop ----------
  function tick() {
    const now = Date.now();
    bulk = now - IRPG.state.lastReal > 120000;
    const away = IRPG.catchUp(now);
    bulk = false;
    if (away) { renderLog(); showAway(away); }
    render();
  }

  function start() {
    $('speedSelect').value = String(IRPG.state.speed);
    $('alignSelect').value = IRPG.me().align;
    renderLog();
    render();
    clearInterval(tickTimer); clearInterval(saveTimer);
    tickTimer = setInterval(tick, 1000);
    saveTimer = setInterval(() => IRPG.save(), 10000);
  }

  function showAway(a) {
    if (a.levels === 0 && a.events === 0 && a.realGap < 600) return;
    const items = [
      `Level <b>${esc(a.levelFrom)}</b> → <b>${esc(a.levelTo)}</b>`,
      `${esc(a.items)} item upgrade${a.items === 1 ? '' : 's'}`,
      `${esc(a.wins)} battle${a.wins === 1 ? '' : 's'} won, ${esc(a.losses)} lost`
    ];
    if (a.quests) items.push(`${esc(a.quests)} quest${a.quests === 1 ? '' : 's'} completed`);
    const speedNote = IRPG.state.speed > 1 ? ` At ${esc(IRPG.state.speed)}× speed, that is ${humanDur(a.gameGap)} of game time.` : '';
    $('awayText').innerHTML = `<p>You were away for ${humanDur(a.realGap)}.${speedNote} Your hero kept idling:</p><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul><p>See <b>My events</b> for the details.</p>`;
    $('awayModal').hidden = false;
  }

  function boot() {
    if (IRPG.load()) {
      $('loading').hidden = false;
      setTimeout(() => {
        bulk = true;
        const away = IRPG.catchUp(Date.now());
        bulk = false;
        IRPG.save();
        $('loading').hidden = true;
        start();
        if (away) showAway(away);
      }, 30);
    } else {
      $('registerModal').hidden = false;
      setTimeout(() => $('regName').focus(), 50);
    }
  }

  // ---------- commands ----------
  function command(raw) {
    const text = raw.trim();
    if (!text) return;
    const [cmd, ...args] = text.split(/\s+/);
    const m = IRPG.me(), S = IRPG.state;
    notice(text, 'cmd');
    switch (cmd.toUpperCase()) {
      case 'HELP':
        notice('Commands: WHOAMI, INFO, QUEST, ALIGN <good|neutral|evil>, PLAYERS, HELP. In this version nothing you do is penalised.');
        break;
      case 'WHOAMI':
        notice(`You are ${m.name}, the level ${m.level} ${m.cls}. Next level in ${IRPG.duration(m.ttl)}.`);
        break;
      case 'INFO':
        notice(`IdleRPG Web. ${S.players.length} players, ${IRPG.online().length} online. Game speed ${S.speed}×. Time to level L: 600 × 1.16^L seconds (+1 day per level beyond 60).`);
        break;
      case 'QUEST': {
        const q = S.quest;
        if (!q) { notice('There is no active quest.'); break; }
        const names = q.members.map(id => S.players.find(p => p.id === id).name).join(', ');
        notice(q.type === 'time'
          ? `${names} are on a quest to ${q.text}. Quest to complete in ${IRPG.duration(q.endsAt - S.gameTime)}.`
          : `${names} are on a quest to ${q.text}. They are heading for [${q.goals[q.stage]}].`);
        break;
      }
      case 'ALIGN': {
        const a = (args[0] || '').toLowerCase();
        const map = { good: 'g', neutral: 'n', evil: 'e' };
        if (!map[a]) { notice('Try: ALIGN good, ALIGN neutral or ALIGN evil.'); break; }
        IRPG.setAlign(map[a]); $('alignSelect').value = map[a]; IRPG.save(); render();
        break;
      }
      case 'PLAYERS':
        notice('Top 5: ' + ranked().slice(0, 5).map((p, i) => `${i + 1}. ${p.name} (${p.level})`).join(', '));
        break;
      default:
        notice(`Unknown command "${cmd}". Type HELP.`);
    }
  }

  // ---------- events ----------
  $('registerForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('regName').value.trim(), cls = $('regClass').value.trim();
    if (!name || !cls) return;
    IRPG.createWorld(name, cls, $('regAlign').value, Number($('regSpeed').value));
    $('registerModal').hidden = true;
    start();
  });

  $('awayClose').addEventListener('click', () => { $('awayModal').hidden = true; });

  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === b));
    filter = b.dataset.filter;
    renderLog();
  }));

  document.querySelectorAll('.stab').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.stab').forEach(x => x.classList.toggle('active', x === b));
    activePanel = b.dataset.panel;
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + activePanel));
    if (IRPG.state) render();
  }));

  $('playersBody').addEventListener('click', e => {
    const tr = e.target.closest('tr');
    if (!tr) return;
    inspectId = tr.dataset.id;
    renderInspect();
  });

  $('cmdForm').addEventListener('submit', e => {
    e.preventDefault();
    command($('cmdInput').value);
    $('cmdInput').value = '';
  });

  $('speedSelect').addEventListener('change', e => {
    IRPG.catchUp(Date.now());
    IRPG.setSpeed(Number(e.target.value));
    IRPG.save();
    notice(`Game speed set to ${e.target.value}×.`);
    render();
  });

  $('alignSelect').addEventListener('change', e => { IRPG.setAlign(e.target.value); IRPG.save(); render(); });

  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([IRPG.exportSave()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `idlerpg-${IRPG.me().name}-L${IRPG.me().level}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('importFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then(txt => {
      try { IRPG.importSave(txt); start(); notice('Save imported.'); }
      catch (err) { notice('Could not import that file: ' + err.message); }
    });
    e.target.value = '';
  });

  let resetArmed = null;
  $('resetBtn').addEventListener('click', () => {
    const b = $('resetBtn');
    if (!resetArmed) {
      b.classList.add('armed'); b.textContent = 'Click again to delete forever';
      resetArmed = setTimeout(() => { b.classList.remove('armed'); b.innerHTML = 'Delete character&hellip;'; resetArmed = null; }, 4000);
      return;
    }
    clearTimeout(resetArmed); resetArmed = null;
    clearInterval(tickTimer); clearInterval(saveTimer);
    IRPG.reset();
    location.reload();
  });

  document.addEventListener('visibilitychange', () => { if (document.hidden && IRPG.state) IRPG.save(); });
  window.addEventListener('pagehide', () => { if (IRPG.state) IRPG.save(); });

  boot();
})();
