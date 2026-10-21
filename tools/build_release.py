#!/usr/bin/env python3
"""Gera dist/GrandTrackerAuto-vX.Y.Z.zip pronto para anexar na release do GitHub."""
import json
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLUGIN = os.path.join(ROOT, "GrandTrackerAuto")
version = json.load(open(os.path.join(PLUGIN, "version.json"), encoding="utf-8"))["version"]
os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
out = os.path.join(ROOT, "dist", "GrandTrackerAuto-v%s.zip" % version)

with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for name in ("instalar.bat", "LEIA-ME.txt", "LICENSE"):
        z.write(os.path.join(ROOT, name), name)
    for base, dirs, files in os.walk(PLUGIN):
        dirs[:] = [d for d in dirs if d != "__pycache__"]
        for f in files:
            full = os.path.join(base, f)
            z.write(full, os.path.relpath(full, ROOT))
print(out)
