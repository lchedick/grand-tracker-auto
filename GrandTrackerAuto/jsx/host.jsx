// GTA • Grand Tracker Auto — lado Premiere (ExtendScript)

function gta_str(v) {
    if (v === null || v === undefined) return "null";
    if (typeof v === "number") return isFinite(v) ? String(v) : "null";
    if (typeof v === "boolean") return String(v);
    if (typeof v === "string") {
        return '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
            .replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t") + '"';
    }
    var parts = [], k;
    if (v instanceof Array) {
        for (k = 0; k < v.length; k++) parts.push(gta_str(v[k]));
        return "[" + parts.join(",") + "]";
    }
    for (k in v) parts.push(gta_str(k) + ":" + gta_str(v[k]));
    return "{" + parts.join(",") + "}";
}

function gta_err(msg) { return gta_str({ error: msg }); }

function gta_findSequence(id) {
    var s = app.project.activeSequence;
    if (s && s.sequenceID === id) return s;
    for (var i = 0; i < app.project.sequences.numSequences; i++) {
        if (app.project.sequences[i].sequenceID === id) return app.project.sequences[i];
    }
    return null;
}

function gta_findClip(seq, id) {
    for (var i = 0; i < seq.videoTracks.numTracks; i++) {
        var tr = seq.videoTracks[i];
        for (var j = 0; j < tr.clips.numItems; j++) {
            if (tr.clips[j].nodeId === id) return tr.clips[j];
        }
    }
    return null;
}

function gta_motion(clip) {
    for (var i = 0; i < clip.components.numItems; i++) {
        var c = clip.components[i];
        if (c.matchName === "AE.ADBE Motion" || c.displayName === "Motion" || c.displayName === "Movimento")
            return c;
    }
    return null;
}

function gta_selectedVideo(seq) {
    var sel = seq.getSelection(), out = [];
    for (var i = 0; i < sel.length; i++) {
        if (sel[i].mediaType === "Video") out.push(sel[i]);
    }
    // ordena pela posicao na timeline
    out.sort(function (a, b) { return a.start.seconds - b.start.seconds; });
    return out;
}

// Lista os clipes de video selecionados, com o motivo quando nao da pra trackear
function gta_getSelectedClips() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return gta_err("Abra a sequ\u00eancia 9:16 na timeline.");
        var clips = gta_selectedVideo(seq);
        if (!clips.length) return gta_err("Selecione um ou mais clipes de v\u00eddeo na timeline.");
        var list = [];
        for (var i = 0; i < clips.length; i++) {
            var c = clips[i], item = { nodeId: c.nodeId, name: c.name, skip: "" };
            try {
                var pi = c.projectItem;
                if (!pi) item.skip = "Sem item de projeto.";
                else if (pi.isSequence && pi.isSequence()) item.skip = "Clipe aninhado (nest) n\u00e3o tem arquivo de v\u00eddeo.";
                else {
                    item.path = pi.getMediaPath();
                    if (!item.path) item.skip = "Sem arquivo de v\u00eddeo (gr\u00e1fico, t\u00edtulo ou cor).";
                }
                item.inPoint = c.inPoint.seconds;
                item.outPoint = c.outPoint.seconds;
                var m = gta_motion(c);
                if (!m) item.skip = item.skip || "Clipe sem Motion.";
                else item.scale = m.properties[1].getValue();
            } catch (e) {
                item.skip = "N\u00e3o consegui ler o clipe: " + e.toString();
            }
            list.push(item);
        }
        return gta_str({
            sequenceId: seq.sequenceID,
            seqW: Number(seq.frameSizeHorizontal),
            seqH: Number(seq.frameSizeVertical),
            clips: list
        });
    } catch (e) {
        return gta_err("Erro ao ler a sele\u00e7\u00e3o: " + e.toString());
    }
}

// d = { sequenceId, nodeId, inPoint, setScale, scalePercent, interp, keys:[{t, nx}] }
function gta_apply(d) {
    try {
        var seq = gta_findSequence(d.sequenceId);
        if (!seq) return gta_err("A sequ\u00eancia n\u00e3o existe mais.");
        var clip = gta_findClip(seq, d.nodeId);
        if (!clip) return gta_err("O clipe n\u00e3o est\u00e1 mais na sequ\u00eancia.");
        var motion = gta_motion(clip);
        var pos = motion.properties[0];
        var scale = motion.properties[1];

        var y = 0.5;
        if (!d.setScale) {
            try { y = pos.getValue()[1]; } catch (e1) {}
        } else {
            if (scale.isTimeVarying()) scale.setTimeVarying(false);
            scale.setValue(d.scalePercent, true);
        }
        if (pos.isTimeVarying()) pos.setTimeVarying(false);   // apaga keyframes antigos
        pos.setTimeVarying(true);
        for (var i = 0; i < d.keys.length; i++) {
            var tm = d.inPoint + d.keys[i].t;
            pos.addKey(tm);
            pos.setValueAtKey(tm, [d.keys[i].nx, y], true);
            try { pos.setInterpolationTypeAtKey(tm, d.interp, true); } catch (e2) {}
        }
        return gta_str({ ok: true, count: d.keys.length });
    } catch (e) {
        return gta_err("Erro ao criar keyframes: " + e.toString());
    }
}

// Zera o Motion (keyframes + valores padrao) de todos os clipes selecionados.
// O valor padrao e escolhido pelo nome/tipo da propriedade, para nao depender
// da ordem (que muda entre versoes do Premiere).
function gta_defaultFor(prop) {
    var name = String(prop.displayName || "");
    var cur = null;
    try { cur = prop.getValue(); } catch (e) {}
    if (/uniform/i.test(name)) return true;
    if (typeof cur === "boolean") return true;
    if (/position|posi|anchor|ancor/i.test(name)) return [0.5, 0.5];
    if (cur && typeof cur === "object" && cur.length === 2) return [0.5, 0.5];
    if (/scale|escala/i.test(name)) return 100;            // Scale / Scale Width
    return 0;                                              // Rotation, Anti-flicker, Crop
}

function gta_clearMotion() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return gta_err("Abra uma sequ\u00eancia na timeline.");
        var clips = gta_selectedVideo(seq);
        if (!clips.length) return gta_err("Selecione um ou mais clipes de v\u00eddeo na timeline.");
        var done = 0, fails = [];
        for (var i = 0; i < clips.length; i++) {
            var m = gta_motion(clips[i]);
            if (!m) { fails.push(clips[i].name); continue; }
            for (var p = 0; p < m.properties.numItems; p++) {
                var prop = m.properties[p];
                var def = gta_defaultFor(prop);
                try { if (prop.isTimeVarying()) prop.setTimeVarying(false); } catch (e1) {}
                try { prop.setValue(def, true); } catch (e2) {}
            }
            done++;
        }
        return gta_str({ ok: true, count: done, fails: fails });
    } catch (e) {
        return gta_err("Erro ao limpar Motion: " + e.toString());
    }
}
