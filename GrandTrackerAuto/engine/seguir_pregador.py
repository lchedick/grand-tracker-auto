#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Seguir Pregador - motor de rastreamento.

Analisa um trecho de video 16:9, encontra o pregador e calcula um
movimento de "camera" so no eixo X para um recorte 9:16.

Saida: JSON com keyframes (tempo relativo ao inicio do trecho, X do
centro do recorte em pixels da imagem original).

Uso:
  python seguir_pregador.py --video arquivo.mp4 --start 0 --end 60 --out keys.json
Opcoes uteis:
  --modo rosto      (rosto = mantem o rosto no centro; operador = camera mais parada)
  --deadzone 0.04   (zona morta: quanto ele pode se mexer antes da camera mexer)
  --suavidade 1.0   (maior = pans mais lentos)
  --preview saida_9x16.mp4  (renderiza uma previa vertical, para teste)
"""
import argparse
import json
import math
import os
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, "models")


def log(msg):
    print(msg, flush=True)


# ---------------------------------------------------------------- detectores
class PersonDetector:
    """YOLOX-nano (COCO), classe 0 = pessoa."""

    def __init__(self, size=416):
        self.size = size
        self.net = cv2.dnn.readNetFromONNX(os.path.join(MODELS, "yolox_nano.onnx"))
        grids, strides = [], []
        for s in (8, 16, 32):
            g = size // s
            yv, xv = np.meshgrid(np.arange(g), np.arange(g), indexing="ij")
            grids.append(np.stack((xv, yv), 2).reshape(-1, 2))
            strides.append(np.full((g * g, 1), s))
        self.grids = np.concatenate(grids, 0).astype(np.float32)
        self.strides = np.concatenate(strides, 0).astype(np.float32)

    def detect(self, img, thr=0.35):
        h, w = img.shape[:2]
        S = self.size
        r = min(S / w, S / h)
        rs = cv2.resize(img, (int(w * r), int(h * r)))
        pad = np.full((S, S, 3), 114, np.uint8)
        pad[: rs.shape[0], : rs.shape[1]] = rs
        self.net.setInput(cv2.dnn.blobFromImage(pad, 1.0, (S, S), swapRB=False))
        out = self.net.forward()[0]
        xy = (out[:, :2] + self.grids) * self.strides
        wh = np.exp(out[:, 2:4]) * self.strides
        score = out[:, 4] * out[:, 5]  # obj * classe pessoa
        keep = score > thr
        if not keep.any():
            return []
        xy, wh, score = xy[keep], wh[keep], score[keep]
        boxes = np.concatenate([xy - wh / 2, wh], 1) / r
        idx = cv2.dnn.NMSBoxes(boxes.tolist(), score.tolist(), thr, 0.45)
        res = []
        for i in np.array(idx).flatten():
            x, y, bw, bh = boxes[i]
            res.append((float(x), float(y), float(bw), float(bh), float(score[i])))
        return res


class FaceDetector:
    """YuNet (OpenCV)."""

    def __init__(self):
        self.det = cv2.FaceDetectorYN.create(
            os.path.join(MODELS, "yunet.onnx"), "", (640, 640), 0.6, 0.3, 50
        )

    def detect(self, img):
        h, w = img.shape[:2]
        s = 640.0 / w
        small = cv2.resize(img, (640, int(round(h * s))))
        self.det.setInputSize((small.shape[1], small.shape[0]))
        _, faces = self.det.detect(small)
        if faces is None:
            return []
        return [(f[0] / s, f[1] / s, f[2] / s, f[3] / s, float(f[-1])) for f in faces]


# ---------------------------------------------------------------- analise
def analyze(video, start, end, sample_fps=10.0, progress=True):
    cap = cv2.VideoCapture(video)
    if not cap.isOpened():
        raise SystemExit("ERRO: não consegui abrir o vídeo: " + video)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = cap.get(cv2.CAP_PROP_FRAME_COUNT) / fps
    if end is None or end <= 0 or end > total:
        end = total
    if start > 0:
        cap.set(cv2.CAP_PROP_POS_MSEC, start * 1000.0)

    persons, faces = PersonDetector(), FaceDetector()
    step = max(1, int(round(fps / sample_fps)))
    n_frames = int((end - start) * fps)

    times, xs = [], []
    last_x, face_off = None, 0.0
    fi = 0
    while fi < n_frames:
        ok = cap.grab()
        if not ok:
            break
        if fi % step == 0:
            ok, img = cap.retrieve()
            if not ok:
                break
            t = fi / fps
            x = locate(img, persons, faces, last_x, face_off)
            if x is not None:
                x, face_off = x
                last_x = x
            times.append(t)
            xs.append(np.nan if x is None else x)
            if progress and len(times) % 10 == 0:
                log("PROGRESS %.3f" % min(1.0, fi / max(1, n_frames)))
        fi += 1
    cap.release()
    return np.array(times), np.array(xs, dtype=float), W, H, fps, start, end


def locate(img, persons, faces, last_x, face_off):
    """Retorna (x_cabeca, offset_face_box) ou None."""
    H, W = img.shape[:2]
    P = [p for p in persons.detect(img) if p[3] > H * 0.25]  # ignora gente pequena
    F = faces.detect(img)

    def face_in(box):
        x, y, w, h = box[:4]
        best = None
        for f in F:
            cx, cy = f[0] + f[2] / 2, f[1] + f[3] / 2
            if x <= cx <= x + w and y - h * 0.1 <= cy <= y + h * 0.5:
                if best is None or f[2] * f[3] > best[2] * best[3]:
                    best = f
        return best

    if P:
        if last_x is None:
            box = max(P, key=lambda p: p[2] * p[3])
        else:
            # o mais proximo da ultima posicao, com bonus para tamanho
            box = min(
                P,
                key=lambda p: abs(p[0] + p[2] / 2 - last_x) - 0.15 * p[3],
            )
            if abs(box[0] + box[2] / 2 - last_x) > W * 0.35:
                box = None
        if box is not None:
            f = face_in(box)
            bc = box[0] + box[2] / 2
            if f is not None:
                fx = f[0] + f[2] / 2
                return fx, fx - bc
            # sem rosto: centro da caixa + ultimo offset conhecido
            return bc + face_off * 0.8, face_off * 0.8
    if F:
        f = max(F, key=lambda f: f[2] * f[3])
        fx = f[0] + f[2] / 2
        if last_x is None or abs(fx - last_x) < W * 0.25:
            return fx, face_off
    return None


# ---------------------------------------------------------------- camera
def fill_and_smooth(xs, sr):
    n = len(xs)
    idx = np.arange(n)
    good = ~np.isnan(xs)
    if not good.any():
        return None
    x = np.interp(idx, idx[good], xs[good])
    # mediana (remove picos) + gaussiana leve
    k = max(1, int(sr * 0.5)) | 1
    pad = np.pad(x, k // 2, mode="edge")
    x = np.array([np.median(pad[i : i + k]) for i in range(n)])
    sig = max(1.0, sr * 0.25)
    r = int(sig * 3)
    g = np.exp(-0.5 * (np.arange(-r, r + 1) / sig) ** 2)
    g /= g.sum()
    x = np.convolve(np.pad(x, r, mode="edge"), g, mode="valid")
    return x


def gauss(x, sig):
    r = int(sig * 3) + 1
    g = np.exp(-0.5 * (np.arange(-r, r + 1) / sig) ** 2)
    g /= g.sum()
    return np.convolve(np.pad(x, r, mode="edge"), g, mode="valid")


def camera_path(t, x, W, crop_w, deadzone=0.15, suavidade=1.0):
    """Camera operador: fica parada enquanto ele balanca/gesticula perto
    do mesmo lugar; quando ele realmente muda de lugar (ou chega perto da
    borda), faz um pan suave ate recentraliza-lo."""
    n = len(t)
    sr = 1.0 / np.median(np.diff(t)) if n > 1 else 10.0
    lo, hi = crop_w / 2.0, W - crop_w / 2.0
    clamp = lambda v: float(min(hi, max(lo, v)))
    dz = deadzone * crop_w                 # tolerancia da posicao "media"
    edge = 0.62 * crop_w / 2               # cabeca chegando perto da borda
    xs = gauss(x, 1.0 * sr)                # posicao media (ignora balanco)
    confirm = max(1, int(0.5 * sr))
    settle_w = max(2, int(0.8 * sr))
    vthr = crop_w * 0.10                   # px/s abaixo disso = "parou"
    max_pan = int(6.0 * sr)
    min_hold = 1.2

    c = clamp(xs[0])
    keys = [[0.0, c]]
    i = 0
    while i < n:
        urgent = abs(x[i] - c) > edge
        if abs(xs[i] - c) <= dz and not urgent:
            i += 1
            continue
        if not urgent:
            j = i
            while j < n and abs(xs[j] - c) > dz and j - i < confirm:
                j += 1
            if j - i < confirm and j < n:  # saiu so por um instante
                i = j
                continue
        if not urgent and t[i] - keys[-1][0] < min_hold:
            i += 1
            continue
        # onde ele vai parar?
        k = i
        while k < n - 1 and k - i < max_pan:
            k2 = min(n - 1, k + settle_w)
            v = abs(xs[k2] - xs[k]) / max(1e-6, t[k2] - t[k])
            if v < vthr:
                break
            k += 1
        k2 = min(n, k + settle_w)
        target = clamp(float(np.mean(xs[k:k2])))
        dist = abs(target - c)
        if dist < dz * 0.4:
            i = k + 1
            continue
        start = max(keys[-1][0], t[i] - 0.4)
        min_dur = min(3.0, max(1.0, dist / (crop_w * 0.6))) * suavidade
        if urgent:
            min_dur = min(min_dur, 0.8)
        end = max(t[k] + 0.2, start + min_dur)
        if keys[-1][0] < start - 1e-3:
            keys.append([float(start), c])
        else:
            keys[-1][1] = c
        keys.append([float(end), target])
        c = target
        i = int(np.searchsorted(t, end))
    if keys[-1][0] < t[-1] - 1e-3:
        keys.append([float(t[-1]), c])
    return keys


def rdp(pts, tol):
    """Simplifica a curva mantendo so os keyframes necessarios."""
    pts = np.asarray(pts, float)
    if len(pts) < 3:
        return pts.tolist()
    keep = np.zeros(len(pts), bool)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        if b - a < 2:
            continue
        ta, va = pts[a]
        tb, vb = pts[b]
        seg = pts[a + 1 : b]
        interp = va + (vb - va) * (seg[:, 0] - ta) / max(1e-9, tb - ta)
        err = np.abs(seg[:, 1] - interp)
        m = int(np.argmax(err))
        if err[m] > tol:
            keep[a + 1 + m] = True
            stack += [(a, a + 1 + m), (a + 1 + m, b)]
    return pts[keep].tolist()


def follow_path(t, x, W, crop_w, deadzone=0.04, suavidade=1.0):
    """Segue o rosto continuamente, mantendo-o no centro.
    Zona morta pequena tira o tremido; a suavizacao e feita olhando
    para frente e para tras no tempo, entao a camera nao atrasa."""
    n = len(t)
    sr = 1.0 / np.median(np.diff(t)) if n > 1 else 10.0
    lo, hi = crop_w / 2.0, W - crop_w / 2.0
    dz = deadzone * crop_w
    c = np.empty(n)
    cur = x[0]
    for i in range(n):
        if x[i] - cur > dz:
            cur = x[i] - dz
        elif cur - x[i] > dz:
            cur = x[i] + dz
        c[i] = cur
    # hysteresis desloca o rosto ate dz do centro; corrige metade disso
    c = 0.5 * c + 0.5 * x
    c = gauss(c, max(1.0, 0.45 * suavidade * sr))
    c = np.clip(c, lo, hi)
    tol = max(1.0, crop_w * 0.003)
    keys = rdp(np.stack([t, c], 1), tol)
    return [[float(a), float(b)] for a, b in keys]


def ease(u):
    return u * u * (3 - 2 * u)


def cam_at(keys, tt, smooth=True):
    if tt <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if tt <= t1:
            if t1 - t0 < 1e-6:
                return v1
            u = (tt - t0) / (t1 - t0)
            return v0 + (v1 - v0) * (ease(u) if smooth else u)
    return keys[-1][1]


# ---------------------------------------------------------------- previa
def render_preview(video, start, end, keys, W, H, out, smooth=True):
    import subprocess

    cap = cv2.VideoCapture(video)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    if start > 0:
        cap.set(cv2.CAP_PROP_POS_MSEC, start * 1000.0)
    crop_w = int(round(H * 9 / 16))
    ow, oh = 540, 960
    tmp = out + ".noaudio.mp4"
    wr = cv2.VideoWriter(tmp, cv2.VideoWriter_fourcc(*"mp4v"), fps, (ow, oh))
    n = int((end - start) * fps)
    for fi in range(n):
        ok, img = cap.read()
        if not ok:
            break
        tt = fi / fps
        cx = cam_at(keys, tt, smooth)
        x0 = int(round(cx - crop_w / 2))
        x0 = max(0, min(W - crop_w, x0))
        crop = img[:, x0 : x0 + crop_w]
        wr.write(cv2.resize(crop, (ow, oh), interpolation=cv2.INTER_AREA))
    wr.release()
    cap.release()
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", tmp, "-ss", str(start), "-t", str(end - start),
         "-i", video, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-crf", "23",
         "-preset", "veryfast", "-c:a", "aac", "-shortest", out],
        check=True,
    )
    os.remove(tmp)


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--end", type=float, default=0.0)
    ap.add_argument("--out", required=True)
    ap.add_argument("--modo", choices=["rosto", "operador"], default="rosto")
    ap.add_argument("--deadzone", type=float, default=-1,
                    help="padrao: 0.04 (rosto) ou 0.15 (operador)")
    ap.add_argument("--suavidade", type=float, default=1.0)
    ap.add_argument("--fps", type=float, default=10.0)
    ap.add_argument("--preview", default="")
    ap.add_argument("--seq-w", type=float, default=1080)
    ap.add_argument("--seq-h", type=float, default=1920)
    ap.add_argument("--scale-percent", type=float, default=0,
                    help="escala atual do clipe; 0 = preencher a sequencia")
    a = ap.parse_args()

    log("Analisando vídeo...")
    t, xs, W, H, fps, start, end = analyze(a.video, a.start, a.end or None, a.fps)
    found = int(np.sum(~np.isnan(xs)))
    if found == 0:
        raise SystemExit("ERRO: não encontrei ninguém no vídeo.")
    sr = 1.0 / np.median(np.diff(t))
    x = fill_and_smooth(xs, sr)
    # fator de escala do clipe na sequencia e largura visivel (px da origem)
    s = a.scale_percent / 100.0 if a.scale_percent > 0 else max(a.seq_w / W, a.seq_h / H)
    crop_w = min(W, a.seq_w / s)
    if a.modo == "rosto":
        dz = 0.04 if a.deadzone < 0 else a.deadzone
        keys = follow_path(t, x, W, crop_w, dz, a.suavidade)
    else:
        dz = 0.15 if a.deadzone < 0 else a.deadzone
        keys = camera_path(t, x, W, crop_w, dz, a.suavidade)
    smooth = a.modo == "operador"

    def pos_norm(cx):
        # Position do Premiere (normalizada 0..1) que coloca cx no centro
        return (a.seq_w / 2.0 + (W / 2.0 - cx) * s) / a.seq_w

    # quanto tempo a cabeca fica perto da borda (controle de qualidade)
    cam = np.array([cam_at(keys, tt, smooth) for tt in t])
    off = np.abs(x - cam) / (crop_w / 2)
    data = {
        "video": a.video,
        "source_width": W,
        "source_height": H,
        "fps": fps,
        "start": start,
        "end": end,
        "crop_width": crop_w,
        "detected_ratio": found / len(xs),
        "edge_ratio": float(np.mean(off > 0.75)),
        "scale_percent": round(s * 100.0, 3),
        "modo": a.modo,
        "interp": 5 if smooth else 0,  # Premiere: 5 = Bezier, 0 = Linear
        "keys": [{"t": round(k[0], 3), "x": round(k[1], 2), "nx": round(pos_norm(k[1]), 6)}
                 for k in keys],
        "track": [[round(float(a_), 2), None if np.isnan(b) else round(float(b), 1)]
                  for a_, b in zip(t, xs)],
    }
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(data, f)
    log("PROGRESS 1.0")
    log("OK %d keyframes" % len(keys))
    if a.preview:
        log("Renderizando prévia...")
        render_preview(a.video, start, end, keys, W, H, a.preview, smooth)
        log("Prévia: " + a.preview)


if __name__ == "__main__":
    main()
