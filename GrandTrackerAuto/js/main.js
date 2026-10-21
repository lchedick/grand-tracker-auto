/* GTA • Grand Tracker Auto — painel (CEP + Node) */
(function () {
  "use strict";
  var cep = window.__adobe_cep__;
  var req = window.require || (window.cep_node && window.cep_node.require);
  var cp = req("child_process"), fs = req("fs"), os = req("os"), path = req("path"), https = req("https");
  var IS_WIN = os.platform() === "win32";
  var proc = (typeof process !== "undefined" && process.env) ? process : req("process");

  var $ = function (id) { return document.getElementById(id); };

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
  function play(name) {
    try { var a = new Audio("assets/sounds/" + name); a.play().catch(function () {}); } catch (e) {}
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // ------------------------------------------------------------ preferencias
  function load(k, d) { try { var v = localStorage.getItem("gta_" + k); return v === null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem("gta_" + k, v); } catch (e) {} }
  var DZ_DEF = { rosto: "4", operador: "15" };
  var modo = load("modo", "rosto");
  $("sv").value = load("sv", "10");
  $("fill").checked = load("fill", "1") === "1";
  $("py").value = load("py", IS_WIN ? "py -3" : "python3");

  function setModo(m) {
    modo = m; save("modo", m);
    Array.prototype.forEach.call($("modo").querySelectorAll("button"), function (b) { b.classList.toggle("on", b.dataset.v === m); });
    $("dz").value = load("dz_" + m, DZ_DEF[m]);
    refresh();
  }
  function paintRange(el) {
    el.style.setProperty("--p", ((el.value - el.min) / (el.max - el.min) * 100) + "%");
  }
  function refresh() {
    paintRange($("dz")); paintRange($("sv"));
    $("dzv").textContent = $("dz").value + "%";
    $("svv").textContent = (Number($("sv").value) / 10).toFixed(1);
    save("dz_" + modo, $("dz").value); save("sv", $("sv").value);
    save("fill", $("fill").checked ? "1" : "0"); save("py", $("py").value.trim());
  }
  $("modo").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (b && !busy) setModo(b.dataset.v);
  });
  ["dz", "sv", "fill", "py"].forEach(function (id) { $(id).addEventListener("input", refresh); $(id).addEventListener("change", refresh); });
  $("openConfig").addEventListener("click", function () { $("config").open = !$("config").open; if ($("config").open) $("config").scrollIntoView({ behavior: "smooth" }); });
  setModo(modo);

  // ------------------------------------------------------------ fila
  var queue = [], busy = false, cancelled = false, current = null;
  var ICON = { queued: "Queue", running: "Track_accent", ok: "Ok_ok", fail: "Fail_err", skip: "Fail_warn", cancel: "CancelQueue" };

  function renderQueue() {
    var ul = $("queueList");
    $("qempty").style.display = queue.length ? "none" : "";
    ul.innerHTML = queue.map(function (it, i) {
      var st = {
        queued: "Na fila", running: Math.round(it.progress * 100) + "%", ok: "Pronto",
        fail: "Falhou", skip: "Pulado", cancel: "Cancelado"
      }[it.state];
      var sub = it.state === "running" ? '<div class="bar sub"><div style="width:' + Math.round(it.progress * 100) + '%"></div></div>' : "";
      var msg = it.msg ? '<div class="msg">' + esc(it.msg) + "</div>" : "";
      return '<li class="' + it.state + '"><img class="ico" alt="" src="assets/icons/' + ICON[it.state] + '.png">' +
        '<span class="name" title="' + esc(it.name) + '">' + esc(it.name) + '</span><span class="st">' + st + "</span>" + sub + msg + "</li>";
    }).join("");
    var idx = queue.findIndex(function (it) { return it.state === "running"; });
    var done = queue.filter(function (it) { return it.state !== "queued" && it.state !== "running"; }).length;
    $("qcount").textContent = queue.length ? "[" + (idx >= 0 ? idx + 1 : done) + "/" + queue.length + "]" : "";
    var tot = 0, prog = 0;
    queue.forEach(function (it) {
      var w = it.dur || 1; tot += w;
      prog += (it.state === "running" ? it.progress : (it.state === "queued" ? 0 : 1)) * w;
    });
    $("overall").style.width = (tot ? Math.round(prog / tot * 100) : 0) + "%";
  }

  // tempo estimado: segundos de video processados por segundo de relogio
  var eta = { start: 0 };
  function updateEta() {
    var total = 0, processed = 0;
    queue.forEach(function (it) {
      if (it.skip) return;
      total += it.dur;
      if (it.state === "running") processed += it.dur * it.progress;
      else if (it.state !== "queued") processed += it.dur;
    });
    var elapsed = (Date.now() - eta.start) / 1000;
    if (!busy || elapsed < 3 || processed <= 0) { $("eta").hidden = !busy; $("etaText").textContent = busy ? "calculando…" : ""; return; }
    var remaining = (total - processed) / (processed / elapsed);
    $("eta").hidden = false;
    $("etaText").textContent = "≈ " + fmtTime(remaining) + " restantes";
  }

  function pyCmd() {
    var parts = $("py").value.trim().split(/\s+/).filter(Boolean);
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
      var args = py.args.concat([
        path.join(EXT, "engine", "seguir_pregador.py"),
        "--video", it.path, "--start", String(it.inPoint), "--end", String(it.outPoint),
        "--out", outFile, "--modo", modo,
        "--deadzone", String(Number($("dz").value) / 100),
        "--suavidade", String(Number($("sv").value) / 10),
        "--seq-w", String(sel.seqW), "--seq-h", String(sel.seqH),
        "--scale-percent", $("fill").checked ? "0" : String(it.scale)
      ]);
      addLog("> " + py.cmd + " " + args.join(" ") + "\n");
      var p, errBuf = "";
      try { p = cp.spawn(py.cmd, args, { windowsHide: true, env: Object.assign({}, proc.env, { PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" }) }); }
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
      p.on("error", function () { reject(new Error("Python não encontrado (" + py.cmd + "). Veja Configurações.")); });
      p.on("close", function (code) {
        current = null;
        if (cancelled) return reject(new Error("__cancel__"));
        if (code === 0) return resolve();
        var m = /ERRO: (.*)/.exec(errBuf);
        var hint = /No module named/.test(errBuf) ? " Rode o instalar.bat de novo." : "";
        reject(new Error((m ? m[1].trim() : "O rastreamento falhou (código " + code + ").") + hint));
      });
    });
  }

  async function processItem(it, sel) {
    var outFile = path.join(os.tmpdir(), "gta_" + Date.now() + "_" + Math.random().toString(36).slice(2) + ".json");
    await runEngine(it, sel, outFile, function (p) { it.progress = p; renderQueue(); updateEta(); });
    var data = JSON.parse(fs.readFileSync(outFile, "utf8"));
    try { fs.unlinkSync(outFile); } catch (e) {}
    var payload = {
      sequenceId: sel.sequenceId, nodeId: it.nodeId, inPoint: it.inPoint,
      setScale: $("fill").checked, scalePercent: data.scale_percent, interp: data.interp,
      keys: data.keys.map(function (k) { return { t: k.t, nx: k.nx }; })
    };
    var res = await host("gta_apply(" + JSON.stringify(payload) + ")");
    var warn = data.detected_ratio < 0.7 ? " · encontrei o pregador em só " + Math.round(data.detected_ratio * 100) + "% do tempo, confira" : "";
    return res.count + " keyframes" + warn;
  }

  function setBusy(b) {
    busy = b;
    $("run").disabled = b; $("clear").disabled = b; $("updateBtn").disabled = b; $("checkUpdate").disabled = b;
    $("cancel").classList.toggle("show", b); $("cancel").disabled = false;
  }

  $("run").addEventListener("click", async function () {
    if (busy) return;
    $("log").textContent = ""; setStatus("");
    var sel;
    try {
      sel = await host("gta_getSelectedClips()");
      if (sel.seqW >= sel.seqH) throw new Error("A sequência ativa não é vertical (" + sel.seqW + "×" + sel.seqH + "). Use uma sequência 9:16, ex. 1080×1920.");
    } catch (e) { setStatus(e.message, "err"); return; }

    queue = sel.clips.map(function (c) {
      return Object.assign(c, {
        state: c.skip ? "skip" : "queued", msg: c.skip || "", progress: 0,
        dur: Math.max(0.1, (c.outPoint || 0) - (c.inPoint || 0))
      });
    });
    cancelled = false; setBusy(true); eta.start = Date.now();
    renderQueue(); updateEta();
    var etaTimer = setInterval(updateEta, 1000);

    for (var i = 0; i < queue.length; i++) {
      var it = queue[i];
      if (it.state !== "queued") continue;
      if (cancelled) { it.state = "cancel"; continue; }
      it.state = "running"; it.progress = 0; renderQueue();
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

    var ok = queue.filter(function (q) { return q.state === "ok"; }).length;
    var bad = queue.filter(function (q) { return q.state === "fail" || q.state === "skip"; }).length;
    if (cancelled) {
      setStatus("Fila cancelada. " + ok + " de " + queue.length + " clipes trackeados.");
    } else if (bad) {
      setStatus(ok + " de " + queue.length + " clipes trackeados · " + bad + " com problema (veja a fila).", "err", true);
      play("Alert_FAIL.mp3");
    } else {
      setStatus("Pronto! " + ok + (ok === 1 ? " clipe trackeado" : " clipes trackeados") + " em **" + fmtTime(elapsed) + "**.", "ok", true);
      play("Alert_OK.mp3");
    }
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
    if (!silent) $("updateInfo").textContent = "Verificando…";
    try {
      var rel = await httpGet("https://api.github.com/repos/" + INFO.repo + "/releases/latest");
      var asset = (rel.assets || []).filter(function (a) { return /\.zip$/i.test(a.name); })[0];
      if (rel.tag_name && cmpVer(rel.tag_name, INFO.version) > 0 && asset) {
        latest = { version: rel.tag_name.replace(/^v/i, ""), url: asset.browser_download_url };
        $("updateText").textContent = "Nova versão v" + latest.version + " disponível";
        $("updateBar").classList.add("show");
        $("updateInfo").textContent = "Nova versão v" + latest.version + " disponível.";
      } else {
        $("updateInfo").textContent = "Você já está na versão mais recente (v" + INFO.version + ").";
      }
    } catch (e) {
      $("updateInfo").textContent = silent ? "" : "Não consegui verificar (" + e.message + ").";
    }
  }

  function runP(cmd, args) {
    return new Promise(function (resolve, reject) {
      var p = cp.spawn(cmd, args, { windowsHide: true });
      var err = "";
      p.stdout.on("data", function (b) { addLog(String(b)); });
      p.stderr.on("data", function (b) { err += b; addLog(String(b)); });
      p.on("error", reject);
      p.on("close", function (c) { c === 0 ? resolve() : reject(new Error(err.trim().split("\n").pop() || ("codigo " + c))); });
    });
  }
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
    setBusy(true); $("cancel").classList.remove("show");
    try {
      var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gta_upd_"));
      var zip = path.join(tmp, "update.zip"), out = path.join(tmp, "x");
      setStatus("Baixando v" + latest.version + "…");
      await httpGet(latest.url, zip);
      setStatus("Instalando…");
      if (IS_WIN) await runP("powershell", ["-NoProfile", "-NonInteractive", "-Command",
        "Expand-Archive -LiteralPath '" + zip.replace(/'/g, "''") + "' -DestinationPath '" + out.replace(/'/g, "''") + "' -Force"]);
      else await runP("ditto", ["-x", "-k", zip, out]);
      var root = findPluginRoot(out, 3);
      if (!root) throw new Error("O pacote baixado não parece ser o plugin.");
      copyDir(root, EXT);
      var reqFile = path.join(EXT, "engine", "requirements.txt");
      if (fs.existsSync(reqFile)) {
        setStatus("Atualizando bibliotecas do Python…");
        var py = pyCmd();
        try { await runP(py.cmd, py.args.concat(["-m", "pip", "install", "--upgrade", "-r", reqFile])); } catch (e) { addLog("pip: " + e.message + "\n"); }
      }
      $("updateBar").classList.remove("show");
      setStatus("Atualizado para v" + latest.version + "! Feche e abra o Premiere para concluir.", "ok", true);
      play("Alert_OK.mp3");
    } catch (e) {
      setStatus("Falha na atualização: " + e.message, "err");
      play("Alert_FAIL.mp3");
    }
    setBusy(false);
  }
  $("updateBtn").addEventListener("click", doUpdate);
  $("checkUpdate").addEventListener("click", function () { checkUpdate(false); });

  renderQueue();
  setTimeout(function () { checkUpdate(true); }, 1500);
})();
