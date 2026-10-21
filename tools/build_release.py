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


def add(z, full, arc, executable=False):
    info = zipfile.ZipInfo.from_file(full, arc)
    info.create_system = 3  # unix: preserva permissoes (o .command precisa ser executavel no Mac)
    info.external_attr = ((0o755 if executable else 0o644) | 0o100000) << 16
    info.compress_type = zipfile.ZIP_DEFLATED
    with open(full, "rb") as f:
        z.writestr(info, f.read())


with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for name in ("instalar_Windows.bat", "instalar_MacOS.command", "LEIA-ME.txt", "LICENSE"):
        add(z, os.path.join(ROOT, name), name, executable=name.endswith(".command"))
    for base, dirs, files in os.walk(PLUGIN):
        dirs[:] = [d for d in dirs if d != "__pycache__"]
        for f in files:
            if f == "python_path.txt":
                continue
            full = os.path.join(base, f)
            add(z, full, os.path.relpath(full, ROOT))
print(out)
