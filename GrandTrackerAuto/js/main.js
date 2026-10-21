/* GTA • Grand Tracker Auto — painel (CEP + Node) */
(function () {
  "use strict";
  var cep = window.__adobe_cep__;
  var req = window.require || (window.cep_node && window.cep_node.require);
  var cp = req("child_process"), fs = req("fs"), os = req("os"), path = req("path"), https = req("https");
  var IS_WIN = os.platform() === "win32";
  var IS_MAC = os.platform() === "darwin";
  var proc = (typeof process !== "undefined" && process.env) ? process : req("process");

  var $ = function (id) { return document.getElementById(id); };
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };

  // ------------------------------------------------------------ utilidades
  function extDir() {
    var p = decodeURI(cep.getSystemPath("extension")).replace(/^file:\/{2,3}/, "");
    if (IS_WIN) p = p.replace(/\//g, "\\");
    else if (p[0] !== "/") p = "/" + p;
    return p;
  }
  var EXT = extDir();
  var INFO = { version: "0.0.0", repo: "lchedick/grand-tracker-auto", author: "Lucas Chedick", name: "Grand Tracker Auto" };
  try { INFO = Object.assign(INFO, JSON.parse(fs.readFileSync(path.join(EXT, "version.json"), "utf8"))); } catch (e) {}
  $("footer").textContent = INFO.name + " | v" + INFO.version + " | Desenvolvido por " + INFO.author;
  $("aboutVer").textContent = "v" + INFO.version;

  function evalES(script) {
    return new Promise(function (resolve) { cep.evalScript(script, resolve); });
  }
  async function host(call) {
    var raw = await evalES(call);
    var res;
    try { res = JSON.parse(raw); } catch (e) { throw new Error("Resposta inesperada do Premiere: " + raw); }
    if (res && res.error) throw new Error(res.error);
    return res;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function showMission(what, time) {
    $("status").className = "";
    $("status").innerHTML = '<div class="mission"><div class="mt">Missão cumprida!</div>' +
      '<div class="ms">' + esc(what) + " em <b>" + esc(time) + "</b></div></div>";
  }
  function setStatus(msg, cls, big) {
    $("status").innerHTML = esc(msg || "").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    $("status").className = (cls || "") + (big ? " big" : "");
  }
  function addLog(s) { var l = $("log"); l.textContent += s; if (l.textContent.length > 20000) l.textContent = l.textContent.slice(-15000); l.scrollTop = l.scrollHeight; }
  function fmtTime(s) {
    s = Math.max(0, Math.round(s));
    if (s < 60) return s + "s";
    var m = Math.floor(s / 60), r = s % 60;
    return m + "min" + (r ? " " + (r < 10 ? "0" : "") + r + "s" : "");
  }
  function play(name, force) {
    if (!force && !$("optSounds").checked) return;
    try {
      var a = new Audio("assets/sounds/" + name);
      a.volume = Math.max(0, Math.min(1, Number($("vol").value) / 100));
      a.play().catch(function () {});
    } catch (e) {}
  }
  function openURL(url) {
    try {
      if (IS_WIN) cp.spawn("cmd", ["/c", "start", "", url], { windowsHide: true, detached: true, stdio: "ignore" }).unref();
      else cp.spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    } catch (e) {}
  }
  function copyText(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
    if (!ok && navigator.clipboard) { try { navigator.clipboard.writeText(text); ok = true; } catch (e) {} }
    return ok;
  }
  // roda um comando e devolve stdout (rejeita com stderr)
  function exec(cmd, args, opts) {
    return new Promise(function (resolve, reject) {
      var p, out = "", err = "";
      try { p = cp.spawn(cmd, args, Object.assign({ windowsHide: true }, opts || {})); } catch (e) { return reject(e); }
      p.stdout.on("data", function (b) { out += b; });
      p.stderr.on("data", function (b) { err += b; });
      p.on("error", reject);
      p.on("close", function (c) { c === 0 ? resolve(out) : reject(new Error(err.trim().split("\n").pop() || ("código " + c))); });
    });
  }
  var PY_ENV = Object.assign({}, proc.env, { PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" });

  // ------------------------------------------------------------ preferencias
  function load(k, d) { try { var v = localStorage.getItem("gta_" + k); return v === null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem("gta_" + k, v); } catch (e) {} }
  var DEF = { modo: "rosto", dz_rosto: "0", dz_operador: "0", sv: "5", pos: "0", fill: "1",
              qual: "normal", proxy: "1", sounds: "1", autoupd: "1", vol: "100", notify: "1", ui: "1" };
  var QUAL_HINT = {
    rapida: "Analisa 5 quadros por segundo. Cerca de 1,4× mais rápida. Boa para pregador mais parado.",
    normal: "Analisa 10 quadros por segundo. O equilíbrio para o dia a dia.",
    precisa: "Analisa 15 quadros por segundo em imagem maior. Cerca de 2,3× mais lenta. Para plano aberto ou pregador pequeno na tela."
  };
  var modo, qual;

  function setSeg(id, v) { each($(id).querySelectorAll("button"), function (b) { b.classList.toggle("on", b.dataset.v === v); }); }
  function setModo(m) { modo = m; save("modo", m); setSeg("modo", m); $("dz").value = load("dz_" + m, DEF["dz_" + m]); refresh(); }
  function setUiScale(v) {
    save("ui", v); setSeg("uiScale", v);
    document.documentElement.style.zoom = v;
    fitActions();
  }
  // botoes Trackear / Limpar um embaixo do outro quando o painel estiver estreito
  function fitActions() {
    var a = document.querySelector(".actions");
    var z = Number(load("ui", "1")) || 1;
    if (a) a.classList.toggle("stack", window.innerWidth / z - 24 < 270);
  }
  window.addEventListener("resize", fitActions);
  function setQual(q) { qual = q; save("qual", q); setSeg("qual", q); $("qualHint").textContent = QUAL_HINT[q]; }

  function paintRange(el) { el.style.setProperty("--p", ((el.value - el.min) / (el.max - el.min) * 100) + "%"); }
  function paintCenter(el) {
    var v = Number(el.value), min = Number(el.min), max = Number(el.max);
    var mid = (0 - min) / (max - min) * 100, at = (v - min) / (max - min) * 100;
    el.style.setProperty("--from", Math.min(mid, at) + "%");
    el.style.setProperty("--w", Math.abs(at - mid) + "%");
  }
  function posLabel(v) { v = Number(v); return v === 0 ? "Centro" : v < 0 ? "← " + (-v) + "%" : v + "% →"; }
  function refresh() {
    paintRange($("dz")); paintRange($("sv")); paintCenter($("pos"));
    $("dzv").textContent = $("dz").value + "%";
    $("svv").textContent = (Number($("sv").value) / 10).toFixed(1);
    $("posv").textContent = posLabel($("pos").value);
    save("dz_" + modo, $("dz").value); save("sv", $("sv").value); save("pos", $("pos").value);
    save("fill", $("fill").checked ? "1" : "0"); save("py", $("py").value.trim());
    save("proxy", $("optProxy").checked ? "1" : "0"); save("sounds", $("optSounds").checked ? "1" : "0");
    save("autoupd", $("optAutoUpd").checked ? "1" : "0");
    paintRange($("vol")); $("volv").textContent = $("vol").value + "%"; save("vol", $("vol").value);
    save("notify", $("optNotify").checked ? "1" : "0");
  }
  function applyPrefs() {
    $("sv").value = load("sv", DEF.sv);
    $("pos").value = load("pos", DEF.pos);
    $("fill").checked = load("fill", DEF.fill) === "1";
    $("py").value = load("py", defaultPy());
    $("optProxy").checked = load("proxy", DEF.proxy) === "1";
    $("optSounds").checked = load("sounds", DEF.sounds) === "1";
    $("optAutoUpd").checked = load("autoupd", DEF.autoupd) === "1";
    $("vol").value = load("vol", DEF.vol);
    $("optNotify").checked = load("notify", DEF.notify) === "1";
    setQual(load("qual", DEF.qual));
    setUiScale(load("ui", DEF.ui));
    setModo(load("modo", DEF.modo));
  }
  $("modo").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b && !busy) setModo(b.dataset.v); });
  $("qual").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) setQual(b.dataset.v); });
  $("uiScale").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) setUiScale(b.dataset.v); });
  // lembra quais secoes recolhiveis estavam abertas
  ["moreOpts", "foldPy", "foldSup"].forEach(function (id) {
    $(id).open = load("open_" + id, "0") === "1";
    $(id).addEventListener("toggle", function () { save("open_" + id, $(id).open ? "1" : "0"); });
  });
  ["dz", "sv", "pos", "fill", "py", "optProxy", "optSounds", "optAutoUpd", "vol", "optNotify"].forEach(function (id) {
    $(id).addEventListener("input", refresh); $(id).addEventListener("change", refresh);
  });
  $("pos").addEventListener("dblclick", function () { $("pos").value = 0; refresh(); });
  $("playOk").addEventListener("click", function () { play("Alert_OK.mp3", true); });
  $("playFail").addEventListener("click", function () { play("Alert_FAIL.mp3", true); });
  var busy = false;
  applyPrefs();

  // ------------------------------------------------------------ configuracoes (pop-up)
  function openConfig() { $("config").classList.add("show"); }
  function closeConfig() { $("config").classList.remove("show"); }
  $("openConfig").addEventListener("click", openConfig);
  $("closeConfig").addEventListener("click", closeConfig);
  $("config").addEventListener("mousedown", function (e) { if (e.target === $("config")) closeConfig(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeConfig(); closeNotes(); } });
  $("ghLink").addEventListener("click", function () { openURL("https://github.com/" + INFO.repo); });

  $("testPy").addEventListener("click", async function () {
    var r = $("pyResult"), py = pyCmd();
    r.className = "result"; r.textContent = "Testando…"; $("testPy").disabled = true;
    try {
      var out = await exec(py.cmd, py.args.concat(["-c",
        "import sys, cv2, numpy; print(sys.version.split()[0], cv2.__version__, numpy.__version__)"]), { env: PY_ENV });
      var v = out.trim().split(/\s+/);
      r.className = "result ok";
      r.textContent = "✓ Tudo certo · Python " + v[0] + " · OpenCV " + v[1] + " · NumPy " + v[2];
    } catch (e) {
      r.className = "result err";
      if (/ENOENT|não é reconhecido|not recognized/i.test(e.message + (e.code || "")))
        r.textContent = "✗ Python não encontrado com \"" + $("py").value + "\". Tente \"python\" ou instale o Python.";
      else if (/No module named/i.test(e.message))
        r.textContent = "✗ O Python funciona, mas faltam bibliotecas. Rode o instalador de novo.";
      else r.textContent = "✗ " + e.message;
    }
    $("testPy").disabled = false;
  });

  $("resetDefaults").addEventListener("click", function () {
    ["modo", "dz_rosto", "dz_operador", "sv", "pos", "fill", "qual", "proxy", "sounds", "autoupd", "vol", "notify", "ui"].forEach(function (k) { save(k, DEF[k]); });
    applyPrefs();
    $("supportResult").className = "result ok";
    $("supportResult").textContent = "✓ Padrões restaurados (o comando do Python foi mantido).";
  });

  var lastQueueSummary = "";
  $("copyDiag").addEventListener("click", async function () {
    var pv = "?";
    try { var hi = await host("gta_info()"); pv = hi.version + (hi.build ? " (" + hi.build + ")" : ""); } catch (e) {}
    var text = [
      "Grand Tracker Auto v" + INFO.version,
      "Premiere: " + pv + " | Sistema: " + os.platform() + " " + os.release(),
      "Python: " + $("py").value + " | " + ($("pyResult").textContent || "(não testado)"),
      "Ajustes: estilo=" + modo + " zona=" + $("dz").value + "% suav=" + (Number($("sv").value) / 10) +
        " posição=" + $("pos").value + "% qualidade=" + qual + " preencher=" + $("fill").checked + " proxy=" + $("optProxy").checked,
      "", "Última fila:", lastQueueSummary || "(nenhuma)",
      "", "Reinício (últimas linhas):", (function () {
        try { return fs.readFileSync(path.join(os.tmpdir(), "GrandTrackerAuto_restart.log"), "utf8").trim().split(/\r?\n/).slice(-8).join("\n"); }
        catch (e) { return "(sem registro)"; }
      })(),
      "", "Log:", $("log").textContent.slice(-6000) || "(vazio)"
    ].join("\n");
    var ok = copyText(text);
    $("supportResult").className = "result " + (ok ? "ok" : "err");
    $("supportResult").textContent = ok ? "✓ Diagnóstico copiado. Cole na conversa quando precisar de ajuda." : "✗ Não consegui copiar. Abra \"Ver log\" e copie de lá.";
  });

  // ------------------------------------------------------------ fila
  var queue = [], cancelled = false, current = null, lastSel = null;
  var ICON = { queued: "Queue", running: "Track_accent", ok: "Ok_ok", fail: "Fail_err", skip: "Fail_warn", cancel: "CancelQueue" };
  var ST = { queued: "Na fila", ok: "Pronto", fail: "Falhou", skip: "Pulado", cancel: "Cancelado" };

  // render incremental: cada item tem o seu <li>, assim as animacoes nao reiniciam a cada atualizacao
  function rowHTML(it) {
    var st = it.state === "running" ? Math.round(it.progress * 100) + "%" : ST[it.state];
    var sub = it.state === "running" ? '<div class="bar sub"><div style="width:' + Math.round(it.progress * 100) + '%"></div></div>' : "";
    var msg = it.msg ? '<div class="msg">' + esc(it.msg) + "</div>" : "";
    return '<img class="ico" alt="" src="assets/icons/' + ICON[it.state] + '.png">' +
      '<span class="name">' + esc(it.name) + '</span><span class="st">' + st + "</span>" + sub + msg;
  }
  function renderQueue() {
    $("qempty").style.display = queue.length ? "none" : "";
    var ul = $("queueList");
    while (ul.children.length > queue.length) ul.removeChild(ul.lastChild);
    queue.forEach(function (it, i) {
      var li = ul.children[i];
      if (!li) { li = document.createElement("li"); li.title = "Clique para encontrar na timeline"; ul.appendChild(li); }
      li.dataset.i = i;
      var key = it.state + "|" + Math.round(it.progress * 100) + "|" + it.msg + "|" + it.name;
      if (li._key !== key) {
        var prevState = li._state;
        li.className = it.state;
        li.innerHTML = rowHTML(it);
        li._key = key; li._state = it.state;
        if (prevState && prevState !== it.state) {
          var ic = li.querySelector(".ico");
          if (it.state === "ok") ic.classList.add("pop");
          else if (it.state === "fail" || it.state === "skip") ic.classList.add("shake");
        }
      }
    });
    var active = queue.filter(function (it) { return it.inRun; });
    var idx = active.findIndex(function (it) { return it.state === "running"; });
    var done = active.filter(function (it) { return it.state !== "queued" && it.state !== "running"; }).length;
    $("qcount").textContent = active.length ? "[" + (idx >= 0 ? idx + 1 : done) + "/" + active.length + "]" : "";
    var tot = 0, prog = 0;
    active.forEach(function (it) {
      var w = it.dur || 1; tot += w;
      prog += (it.state === "running" ? it.progress : (it.state === "queued" ? 0 : 1)) * w;
    });
    $("overall").style.width = (tot ? Math.round(prog / tot * 100) : 0) + "%";
  }

  $("queueList").addEventListener("click", async function (e) {
    var li = e.target.closest("li"); if (!li || !lastSel) return;
    var it = queue[Number(li.dataset.i)];
    try { await host("gta_selectClip(" + JSON.stringify(lastSel.sequenceId) + "," + JSON.stringify(it.nodeId) + ")"); }
    catch (err) { setStatus(err.message, "err"); }
  });

  // tempo estimado: segundos de video processados por segundo de relogio
  var eta = { start: 0 };
  function updateEta() {
    var total = 0, processed = 0;
    queue.forEach(function (it) {
      if (!it.inRun || it.state === "skip") return;
      total += it.dur;
      if (it.state === "running") processed += it.dur * it.progress;
      else if (it.state !== "queued") processed += it.dur;
    });
    var elapsed = (Date.now() - eta.start) / 1000;
    if (!busy || elapsed < 3 || processed <= 0) { $("eta").hidden = !busy; $("etaText").textContent = busy ? "calculando…" : ""; return; }
    $("eta").hidden = false;
    $("etaText").textContent = "≈ " + fmtTime((total - processed) / (processed / elapsed)) + " restantes";
  }

  // o instalador grava em python_path.txt o Python que ele encontrou ou instalou
  function defaultPy() {
    try {
      var t = fs.readFileSync(path.join(EXT, "python_path.txt"), "utf8").trim();
      if (t) return t;
    } catch (e) {}
    return IS_WIN ? "py -3" : "python3";
  }
  // separa o comando respeitando aspas: "C:\Users\Lucas Chedick\python.exe" -3
  function splitCmd(str) {
    var out = [], re = /"([^"]*)"|(\S+)/g, m;
    while ((m = re.exec(str))) out.push(m[1] !== undefined ? m[1] : m[2]);
    return out;
  }
  function pyCmd() {
    var parts = splitCmd($("py").value.trim());
    return { cmd: parts[0] || (IS_WIN ? "py" : "python3"), args: parts.slice(1) };
  }
  function killTree(p) {
    if (!p) return;
    try {
      if (IS_WIN) cp.spawn("taskkill", ["/PID", String(p.pid), "/T", "/F"], { windowsHide: true });
      else p.kill("SIGTERM");
    } catch (e) {}
  }

  function runEngine(it, sel, outFile, onProgress) {
    return new Promise(function (resolve, reject) {
      var py = pyCmd();
      var video = it.path, useProxy = false;
      if ($("optProxy").checked && it.proxyPath && fs.existsSync(it.proxyPath)) { video = it.proxyPath; useProxy = true; }
      var args = py.args.concat([
        path.join(EXT, "engine", "seguir_pregador.py"),
        "--video", video, "--start", String(it.inPoint), "--end", String(it.outPoint),
        "--out", outFile, "--modo", modo, "--qualidade", qual,
        "--deadzone", String(Number($("dz").value) / 100),
        "--suavidade", String(Number($("sv").value) / 10),
        "--posicao", String(Number($("pos").value) / 100),
        "--seq-w", String(sel.seqW), "--seq-h", String(sel.seqH),
        "--scale-percent", $("fill").checked ? "0" : String(it.scale)
      ]);
      if (useProxy) args.push("--orig-video", it.path);
      addLog("> " + py.cmd + " " + args.join(" ") + "\n");
      var p, errBuf = "";
      try { p = cp.spawn(py.cmd, args, { windowsHide: true, env: PY_ENV }); }
      catch (e) { return reject(new Error("Não consegui iniciar o Python (" + py.cmd + ").")); }
      current = p;
      p.stdout.on("data", function (b) {
        String(b).split(/\r?\n/).forEach(function (line) {
          var m = /^PROGRESS ([\d.]+)/.exec(line);
          if (m) onProgress(Math.min(0.99, Number(m[1])));
          else if (line.trim()) addLog(line + "\n");
        });
      });
      p.stderr.on("data", function (b) { errBuf += String(b); addLog(String(b)); });
      p.on("error", function () { reject(new Error("Python não encontrado (" + py.cmd + "). Use \"Testar Python\" nas Configurações.")); });
      p.on("close", function (code) {
        current = null;
        if (cancelled) return reject(new Error("__cancel__"));
        if (code === 0) return resolve(useProxy);
        var m = /ERRO: (.*)/.exec(errBuf);
        var hint = /No module named/.test(errBuf) ? " Rode o instalador de novo." : "";
        reject(new Error((m ? m[1].trim() : "O rastreamento falhou (código " + code + ").") + hint));
      });
    });
  }

  async function processItem(it, sel) {
    var outFile = path.join(os.tmpdir(), "gta_" + Date.now() + "_" + Math.random().toString(36).slice(2) + ".json");
    var usedProxy = await runEngine(it, sel, outFile, function (p) { it.progress = p; renderQueue(); updateEta(); });
    var data = JSON.parse(fs.readFileSync(outFile, "utf8"));
    try { fs.unlinkSync(outFile); } catch (e) {}
    var payload = {
      sequenceId: sel.sequenceId, nodeId: it.nodeId, inPoint: it.inPoint,
      setScale: $("fill").checked, scalePercent: data.scale_percent, interp: data.interp,
      keys: data.keys.map(function (k) { return { t: k.t, nx: k.nx }; })
    };
    var res = await host("gta_apply(" + JSON.stringify(payload) + ")");
    var warn = data.detected_ratio < 0.7 ? " · encontrei o pregador em só " + Math.round(data.detected_ratio * 100) + "% do tempo, confira" : "";
    return res.count + " keyframes" + (usedProxy ? " · via proxy" : "") + warn;
  }

  function setBusy(b) {
    busy = b;
    ["run", "clear", "updateBtn", "hdrUpdate", "retry"].forEach(function (id) { $(id).disabled = b; });
    $("cancel").hidden = !b; $("cancel").disabled = false;
    if (b) $("retry").hidden = true;
  }

  // processa os itens marcados com inRun e estado "queued"
  async function runQueue(sel) {
    cancelled = false; setBusy(true); eta.start = Date.now();
    $("restart").classList.remove("show");
    renderQueue(); updateEta();
    var etaTimer = setInterval(updateEta, 1000);
    for (var i = 0; i < queue.length; i++) {
      var it = queue[i];
      if (!it.inRun || it.state !== "queued") continue;
      if (cancelled) { it.state = "cancel"; continue; }
      it.state = "running"; it.progress = 0; it.msg = ""; renderQueue();
      try {
        it.msg = await processItem(it, sel);
        it.state = "ok"; it.progress = 1;
      } catch (e) {
        if (e.message === "__cancel__" || cancelled) { it.state = "cancel"; it.msg = ""; }
        else { it.state = "fail"; it.msg = e.message; }
      }
      renderQueue();
    }
    queue.forEach(function (it) { if (it.state === "queued") it.state = "cancel"; });
    clearInterval(etaTimer);
    var elapsed = (Date.now() - eta.start) / 1000;
    setBusy(false); renderQueue(); $("eta").hidden = true;

    var run = queue.filter(function (q) { return q.inRun; });
    var ok = run.filter(function (q) { return q.state === "ok"; }).length;
    var bad = run.filter(function (q) { return q.state === "fail" || q.state === "skip"; }).length;
    var failed = queue.filter(function (q) { return q.state === "fail"; }).length;
    $("retry").hidden = !failed || cancelled;
    lastQueueSummary = queue.map(function (q) { return "- " + q.name + ": " + ST[q.state] + (q.msg ? " (" + q.msg + ")" : ""); }).join("\n");
    var clipsTxt = function (n) { return n + (n === 1 ? " clipe trackeado" : " clipes trackeados"); };
    if (cancelled) {
      setStatus("Fila cancelada. " + ok + " de " + run.length + (run.length === 1 ? " clipe trackeado." : " clipes trackeados."));
    } else if (bad) {
      setStatus(ok + " de " + run.length + (run.length === 1 ? " clipe trackeado" : " clipes trackeados") + " · " + bad + " com problema (veja a fila).", "err", true);
      play("Alert_FAIL.mp3");
      notify("Fila terminada com problemas", ok + " de " + run.length + " · " + bad + " com problema. Veja a fila no painel.");
    } else {
      showMission(clipsTxt(ok), fmtTime(elapsed));
      play("Alert_OK.mp3");
      notify("Missão cumprida!", clipsTxt(ok) + " em " + fmtTime(elapsed) + ".");
    }
  }

  $("run").addEventListener("click", async function () {
    if (busy) return;
    $("log").textContent = ""; setStatus("");
    var sel;
    try {
      sel = await host("gta_getSelectedClips()");
      if (sel.seqW >= sel.seqH) throw new Error("A sequência ativa não é vertical (" + sel.seqW + "×" + sel.seqH + "). Use uma sequência 9:16, ex. 1080×1920.");
    } catch (e) { setStatus(e.message, "err"); return; }
    lastSel = sel;
    $("queueList").innerHTML = "";
    queue = sel.clips.map(function (c) {
      return Object.assign(c, {
        state: c.skip ? "skip" : "queued", msg: c.skip || "", progress: 0, inRun: true,
        dur: Math.max(0.1, (c.outPoint || 0) - (c.inPoint || 0))
      });
    });
    await runQueue(sel);
  });

  $("retry").addEventListener("click", async function () {
    if (busy || !lastSel) return;
    setStatus("");
    queue.forEach(function (it) {
      it.inRun = it.state === "fail";
      if (it.inRun) { it.state = "queued"; it.msg = ""; it.progress = 0; }
    });
    await runQueue(lastSel);
  });

  $("cancel").addEventListener("click", function () {
    if (!busy) return;
    cancelled = true; $("cancel").disabled = true;
    setStatus("Cancelando…");
    killTree(current);
  });

  // ------------------------------------------------------------ limpar motion
  $("clear").addEventListener("click", async function () {
    if (busy) return;
    try {
      var res = await host("gta_clearMotion()");
      var msg = "Motion limpo em " + res.count + (res.count === 1 ? " clipe." : " clipes.");
      if (res.fails && res.fails.length) msg += " Não consegui limpar: " + res.fails.join(", ");
      setStatus(msg, res.fails && res.fails.length ? "err" : "ok", true);
    } catch (e) { setStatus(e.message, "err"); }
  });

  // ------------------------------------------------------------ atualizacao
  function cmpVer(a, b) {
    var pa = String(a).replace(/^v/i, "").split(/[.-]/).map(Number), pb = String(b).replace(/^v/i, "").split(/[.-]/).map(Number);
    for (var i = 0; i < 3; i++) { var d = (pa[i] || 0) - (pb[i] || 0); if (d) return d > 0 ? 1 : -1; }
    return 0;
  }
  function httpGet(url, toFile, redirects) {
    redirects = redirects || 0;
    return new Promise(function (resolve, reject) {
      var r = https.get(url, { headers: { "User-Agent": "GrandTrackerAuto", "Accept": toFile ? "application/octet-stream" : "application/vnd.github+json" } }, function (res) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
          res.resume(); return resolve(httpGet(res.headers.location, toFile, redirects + 1));
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error("HTTP " + res.statusCode)); }
        if (toFile) {
          var f = fs.createWriteStream(toFile);
          res.pipe(f); f.on("finish", function () { f.close(function () { resolve(toFile); }); }); f.on("error", reject);
        } else {
          var buf = ""; res.setEncoding("utf8");
          res.on("data", function (c) { buf += c; });
          res.on("end", function () { try { resolve(JSON.parse(buf)); } catch (e) { reject(e); } });
        }
      });
      r.on("error", reject);
      r.setTimeout(20000, function () { r.destroy(new Error("tempo esgotado")); });
    });
  }

  var latest = null;
  async function checkUpdate(silent) {
    var btn = $("hdrUpdate");
    if (!silent) btn.classList.add("spin");
    try {
      var rel = await httpGet("https://api.github.com/repos/" + INFO.repo + "/releases/latest");
      var asset = (rel.assets || []).filter(function (a) { return /\.zip$/i.test(a.name); })[0];
      if (rel.tag_name && cmpVer(rel.tag_name, INFO.version) > 0 && asset) {
        latest = { version: rel.tag_name.replace(/^v/i, ""), url: asset.browser_download_url };
        $("updateText").textContent = "Nova versão v" + latest.version + " disponível";
        $("updateBar").classList.add("show");
        btn.classList.add("has-update");
        btn.title = "Atualizar para v" + latest.version;
      } else {
        latest = null; btn.classList.remove("has-update"); btn.title = "Verificar atualizações";
        if (!silent) {
          setStatus("Você já está na versão mais recente (v" + INFO.version + ").", "ok", true);
          var nb = document.createElement("button");
          nb.className = "btn secondary small notes-btn"; nb.textContent = "Ver notas da versão";
          nb.addEventListener("click", function () { openNotes(); });
          $("status").appendChild(nb);
        }
      }
    } catch (e) {
      if (!silent) setStatus("Não consegui verificar atualizações (" + e.message + ").", "err");
    }
    btn.classList.remove("spin");
  }
  $("hdrUpdate").addEventListener("click", function () {
    if (busy) return;
    if (latest) doUpdate(); else checkUpdate(false);
  });

  function findPluginRoot(dir, depth) {
    if (fs.existsSync(path.join(dir, "CSXS", "manifest.xml"))) return dir;
    if (depth <= 0) return null;
    var ents = fs.readdirSync(dir, { withFileTypes: true });
    for (var i = 0; i < ents.length; i++) {
      if (ents[i].isDirectory()) { var r = findPluginRoot(path.join(dir, ents[i].name), depth - 1); if (r) return r; }
    }
    return null;
  }
  function copyDir(src, dst) {
    if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
    fs.readdirSync(src, { withFileTypes: true }).forEach(function (e) {
      var s = path.join(src, e.name), d = path.join(dst, e.name);
      if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
    });
  }

  async function doUpdate() {
    if (!latest || busy) return;
    setBusy(true); $("cancel").hidden = true;
    try {
      var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gta_upd_"));
      var zip = path.join(tmp, "update.zip"), out = path.join(tmp, "x");
      setStatus("Baixando v" + latest.version + "…");
      await httpGet(latest.url, zip);
      setStatus("Instalando…");
      if (IS_WIN) await exec("powershell", ["-NoProfile", "-NonInteractive", "-Command",
        "Expand-Archive -LiteralPath '" + zip.replace(/'/g, "''") + "' -DestinationPath '" + out.replace(/'/g, "''") + "' -Force"]);
      else await exec("ditto", ["-x", "-k", zip, out]);
      var root = findPluginRoot(out, 3);
      if (!root) throw new Error("O pacote baixado não parece ser o plugin.");
      copyDir(root, EXT);
      var reqFile = path.join(EXT, "engine", "requirements.txt");
      if (fs.existsSync(reqFile)) {
        setStatus("Atualizando bibliotecas do Python…");
        var py = pyCmd();
        try { addLog(await exec(py.cmd, py.args.concat(["-m", "pip", "install", "--upgrade", "-r", reqFile]), { env: PY_ENV })); }
        catch (e) { addLog("pip: " + e.message + "\n"); }
      }
      $("updateBar").classList.remove("show"); $("hdrUpdate").classList.remove("has-update");
      setStatus("Atualizado para v" + latest.version + "! Reinicie o Premiere para concluir.", "ok", true);
      latest = null;
      if (IS_WIN || IS_MAC) $("restart").classList.add("show");
      play("Alert_OK.mp3");
    } catch (e) {
      setStatus("Falha na atualização: " + e.message, "err", true);
      play("Alert_FAIL.mp3");
    }
    setBusy(false);
  }
  $("updateBtn").addEventListener("click", doUpdate);

  // ------------------------------------------------------------ reiniciar o premiere
  // O Premiere encerra junto com ele todos os processos que o painel abriu. Por isso o
  // "vigia" que espera o Premiere fechar e abre de novo e criado pelo WMI do Windows
  // (fica fora do grupo de processos do Premiere e sobrevive ao fechamento).
  // Se a pessoa cancelar o "salvar?", o Premiere nao fecha e o vigia desiste em 3 min.
  // Registro do que aconteceu: %TEMP%\GrandTrackerAuto_restart.log
  function watcherScript(proj) {
    return [
      "$log = Join-Path $env:TEMP 'GrandTrackerAuto_restart.log'",
      "function L($m) { Add-Content -Path $log -Value ((Get-Date -Format s) + ' ' + $m) }",
      "L 'vigia iniciado'",
      "$p = Get-Process -Name 'Adobe Premiere Pro' -ErrorAction SilentlyContinue | Select-Object -First 1",
      "if (-not $p) { L 'Premiere nao encontrado'; exit 1 }",
      "$id = $p.Id",
      "$exe = $p.Path",
      "if (-not $exe) { $exe = (Get-CimInstance Win32_Process -Filter (\"ProcessId=$id\")).ExecutablePath }",
      "L ('exe: ' + $exe)",
      "$limite = (Get-Date).AddMinutes(3)",
      "while ((Get-Process -Id $id -ErrorAction SilentlyContinue) -and ((Get-Date) -lt $limite)) { Start-Sleep -Milliseconds 500 }",
      "if (Get-Process -Id $id -ErrorAction SilentlyContinue) { L 'Premiere nao fechou (salvar cancelado?)'; exit 2 }",
      "Start-Sleep -Seconds 3",
      "$proj = " + psStr(proj || ""),
      "if ($proj -and (Test-Path -LiteralPath $proj)) { Start-Process -FilePath $exe -ArgumentList ('\"' + $proj + '\"'); L ('reaberto com ' + $proj) } else { Start-Process -FilePath $exe; L 'reaberto' }"
    ].join("\n");
  }
  async function startWatcher(proj) {
    var enc = req("buffer").Buffer.from(watcherScript(proj), "utf16le").toString("base64");
    var cmdline = "powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -EncodedCommand " + enc;
    try {
      var out = await psRun([
        "$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = " + psStr(cmdline) + " }",
        "Write-Output $r.ReturnValue"
      ].join("; "));
      if (out.trim() === "0") return "wmi";
      addLog("WMI retornou " + out.trim() + "\n");
    } catch (e) { addLog("WMI: " + e.message + "\n"); }
    // plano B: tarefa agendada de uma vez so (tambem roda fora do Premiere)
    var task = "GrandTrackerAuto_Reiniciar";
    await exec("schtasks", ["/Create", "/F", "/SC", "ONCE", "/ST", "23:59", "/TN", task, "/TR", cmdline.length < 260 ? cmdline : "powershell.exe -NoProfile -WindowStyle Hidden -File \"" + writeWatcherFile(proj) + "\""]);
    await exec("schtasks", ["/Run", "/TN", task]);
    setTimeout(function () { exec("schtasks", ["/Delete", "/F", "/TN", task]).catch(function () {}); }, 4000);
    return "schtasks";
  }
  function writeWatcherFile(proj) {
    var f = path.join(os.tmpdir(), "GrandTrackerAuto_vigia.ps1");
    fs.writeFileSync(f, "\ufeff" + watcherScript(proj), "utf8");
    return f;
  }
  // Mac: um bash destacado (setsid) espera o Premiere fechar e abre de novo com "open"
  function startWatcherMac(proj) {
    var log = path.join(os.tmpdir(), "GrandTrackerAuto_restart.log");
    var sh = [
      'LOG=' + shq(log),
      'L() { echo "$(date +%Y-%m-%dT%H:%M:%S) $1" >> "$LOG"; }',
      'L "vigia iniciado"',
      'PID=$(pgrep -f "/Adobe Premiere Pro[^/]*\\.app/Contents/MacOS/" | head -n 1)',
      '[ -z "$PID" ] && { L "Premiere nao encontrado"; exit 1; }',
      'EXE=$(ps -p "$PID" -o comm= )',
      'APP=$(echo "$EXE" | sed -E "s#(\\.app)/Contents/.*#\\1#")',
      'L "app: $APP"',
      'for i in $(seq 1 360); do kill -0 "$PID" 2>/dev/null || break; sleep 0.5; done',
      'kill -0 "$PID" 2>/dev/null && { L "Premiere nao fechou (salvar cancelado?)"; exit 2; }',
      'sleep 3',
      'PROJ=' + shq(proj || ""),
      'if [ -n "$PROJ" ] && [ -e "$PROJ" ]; then open -a "$APP" "$PROJ"; L "reaberto com $PROJ"; else open -a "$APP"; L "reaberto"; fi'
    ].join("\n");
    var child = cp.spawn("/bin/bash", ["-c", sh], { detached: true, stdio: "ignore" });
    child.unref();
    return "bash";
  }
  function shq(t) { return "'" + String(t).replace(/'/g, "'\\''") + "'"; }
  async function restartPremiere() {
    var b = $("restart");
    b.disabled = true;
    try {
      var proj = "";
      try { proj = await evalES("app.project && app.project.path ? app.project.path : ''"); } catch (e) {}
      if (/^EvalScript error/i.test(proj)) proj = "";
      setStatus("Reiniciando o Premiere…", "ok", true);
      var how = IS_MAC ? startWatcherMac(proj) : await startWatcher(proj);
      addLog("vigia iniciado via " + how + "\n");
      setTimeout(function () { evalES("app.quit()"); }, 1200);
      setTimeout(function () { b.disabled = false; }, 15000);   // se cancelou o salvar, libera o botao
    } catch (e) {
      addLog("reiniciar: " + e.message + "\n");
      setStatus("Não consegui reiniciar automaticamente. Feche e abra o Premiere manualmente.", "err", true);
      b.disabled = false;
    }
  }
  $("restart").addEventListener("click", restartPremiere);

  // ------------------------------------------------------------ notas da versao
  // le o CHANGELOG.md do plugin: "## v1.2.3" abre uma versao, "- " e "  - " sao itens
  function parseChangelog() {
    var txt = "";
    try { txt = fs.readFileSync(path.join(EXT, "CHANGELOG.md"), "utf8"); } catch (e) { return []; }
    var out = [], cur = null;
    txt.split(/\r?\n/).forEach(function (line) {
      var m = /^##\s+v?([\d.]+)/.exec(line);
      if (m) { cur = { version: m[1], lines: [] }; out.push(cur); return; }
      if (cur && line.trim()) cur.lines.push(line);
    });
    return out;
  }
  function inlineMd(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<b>$1</b>"); }
  function versionHTML(v) {
    var html = "", depth = -1;
    v.lines.forEach(function (line) {
      var m = /^(\s*)-\s+(.*)$/.exec(line);
      if (!m) { html += (depth >= 0 ? "</ul>".repeat(depth + 1) : "") + "<p>" + inlineMd(line) + "</p>"; depth = -1; return; }
      var d = m[1].length >= 2 ? 1 : 0;
      while (depth < d) { html += "<ul>"; depth++; }
      while (depth > d) { html += "</ul>"; depth--; }
      html += "<li>" + inlineMd(m[2]) + "</li>";
    });
    while (depth >= 0) { html += "</ul>"; depth--; }
    return html;
  }
  function openNotes() {
    var all = parseChangelog();
    var curr = all.filter(function (v) { return v.version === INFO.version; })[0] || all[0];
    $("notesTitle").textContent = "Novidades da v" + (curr ? curr.version : INFO.version);
    if (!curr) { $("notesBody").innerHTML = "<p>Notas não encontradas.</p>"; }
    else {
      var older = all.filter(function (v) { return v !== curr; });
      $("notesBody").innerHTML = versionHTML(curr) + (older.length ?
        '<details class="older"><summary>Versões anteriores</summary>' +
        older.map(function (v) { return "<h4>v" + esc(v.version) + "</h4>" + versionHTML(v); }).join("") + "</details>" : "");
    }
    $("notesModal").classList.add("show");
  }
  function closeNotes() { $("notesModal").classList.remove("show"); }
  $("closeNotes").addEventListener("click", closeNotes);
  $("notesModal").addEventListener("mousedown", function (e) { if (e.target === $("notesModal")) closeNotes(); });
  $("aboutNotes").addEventListener("click", function () { closeConfig(); openNotes(); });

  // ------------------------------------------------------------ notificacao do windows
  var AUMID = "LChedick.GrandTrackerAuto";
  function psRun(script) {
    var encoded = req("buffer").Buffer.from(script, "utf16le").toString("base64");
    return exec("powershell", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded]);
  }
  function psStr(t) { return "'" + String(t).replace(/'/g, "''") + "'"; }
  function xmlEsc(t) { return String(t).replace(/[<>&"']/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]; }); }
  var aumidReady = false;
  async function ensureAumid() {
    if (aumidReady) return;
    var icon = path.join(EXT, "assets", "icons", "Track_accent.png");
    await psRun([
      "$k = 'HKCU:\\Software\\Classes\\AppUserModelId\\" + AUMID + "'",
      "New-Item -Path $k -Force | Out-Null",
      "Set-ItemProperty -Path $k -Name DisplayName -Value 'Grand Tracker Auto'",
      "Set-ItemProperty -Path $k -Name IconUri -Value " + psStr(icon),
      "Set-ItemProperty -Path $k -Name IconBackgroundColor -Value '00000000'"
    ].join("; "));
    aumidReady = true;
  }
  async function notify(title, body, force) {
    if ((!IS_WIN && !IS_MAC) || (!force && !$("optNotify").checked)) return;
    if (IS_MAC) {
      try {
        await exec("osascript", ["-e", "display notification " + JSON.stringify(String(body)) + " with title " +
          JSON.stringify("Grand Tracker Auto") + " subtitle " + JSON.stringify(String(title))]);
      } catch (e) { addLog("notificação: " + e.message + "\n"); }
      return;
    }
    try {
      await ensureAumid();
      var xml = '<toast><visual><binding template="ToastGeneric"><text>' + xmlEsc(title) + "</text><text>" + xmlEsc(body) +
        '</text></binding></visual><audio silent="true"/></toast>';
      await psRun([
        "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null",
        "[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null",
        "$x = New-Object Windows.Data.Xml.Dom.XmlDocument",
        "$x.LoadXml(" + psStr(xml) + ")",
        "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('" + AUMID + "').Show([Windows.UI.Notifications.ToastNotification]::new($x))"
      ].join("; "));
    } catch (e) { addLog("notificação: " + e.message + "\n"); }
  }
  // le no registro se as notificacoes estao ligadas (geral e para o Grand Tracker Auto)
  async function checkNotifyStatus() {
    var el = $("notifStatus");
    try {
      var out = await psRun([
        "$g = (Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications' -Name ToastEnabled -ErrorAction SilentlyContinue).ToastEnabled",
        "$a = (Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings\\" + AUMID + "' -Name Enabled -ErrorAction SilentlyContinue).Enabled",
        "Write-Output (\"$g|$a\")"
      ].join("; "));
      var parts = out.trim().split("|");
      if (parts[0] === "0") { el.className = "notif-status err"; el.textContent = "✗ As notificações estão desligadas no Windows (Configurações → Sistema → Notificações)."; }
      else if (parts[1] === "0") { el.className = "notif-status err"; el.textContent = "✗ O Windows está bloqueando as notificações do Grand Tracker Auto (Configurações → Sistema → Notificações)."; }
      else { el.className = "notif-status ok"; el.textContent = "✓ Notificações do Windows ativadas. (Se o \"Não perturbe\" estiver ligado, o Windows pode segurar o aviso.)"; }
    } catch (e) { el.className = "notif-status"; el.textContent = ""; }
  }
  if (!IS_WIN && !IS_MAC) $("notifBox").hidden = true;
  $("openConfig").addEventListener("click", function () {
    if (IS_WIN) checkNotifyStatus();
    else if (IS_MAC) { $("notifStatus").className = "notif-status"; $("notifStatus").textContent = "No Mac, a primeira notificação pode pedir permissão. Se não aparecer, veja Ajustes do Sistema → Notificações → Editor de Scripts."; }
  });
  $("testNotify").addEventListener("click", async function () {
    $("testNotify").disabled = true;
    await notify("Missão cumprida!", "Teste do Grand Tracker Auto: as notificações estão funcionando.", true);
    await checkNotifyStatus();
    $("testNotify").disabled = false;
  });

  renderQueue();
  if (load("seen", "") !== INFO.version) { save("seen", INFO.version); setTimeout(openNotes, 600); }
  if ($("optAutoUpd").checked) setTimeout(function () { checkUpdate(true); }, 1500);
})();
