"""Converte os SVGs exportados do Illustrator (SVG-Icon_<Nome>.svg) nos icones do painel.

Uso:  python tools/build_icons.py <pasta com os SVG-Icon_*.svg>

- troca as classes do <style> por atributos em cada elemento (evita conflito de .cls-1
  entre icones quando ficam todos na mesma pagina);
- troca o cinza #afafaf por currentColor (a cor passa a vir do CSS do painel);
- o LOGO tem a area vazia da prancheta recortada;
- grava GrandTrackerAuto/assets/icons/<Nome>.svg e gera GrandTrackerAuto/js/icons.js.
"""
import json, os, re, sys
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "GrandTrackerAuto", "assets", "icons")
OUT_JS = os.path.join(ROOT, "GrandTrackerAuto", "js", "icons.js")
SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)
GRAY = re.compile(r"#afafaf", re.I)
CROP = {"LOGO": True}


def parse_style(css):
    rules = {}
    for sel, body in re.findall(r"([^{}]+)\{([^}]*)\}", css):
        props = {}
        for decl in body.split(";"):
            if ":" in decl:
                k, v = decl.split(":", 1)
                props[k.strip()] = v.strip()
        for s in sel.split(","):
            s = s.strip()
            if s.startswith("."):
                rules.setdefault(s[1:], {}).update(props)
    return rules


def convert(path, name):
    tree = ET.parse(path)
    svg = tree.getroot()
    rules = {}
    for st in svg.iter("{%s}style" % SVG_NS):
        rules.update(parse_style(st.text or ""))
    for defs in list(svg.findall("{%s}defs" % SVG_NS)):
        svg.remove(defs)
    for el in svg.iter():
        cls = el.attrib.pop("class", None)
        for c in (cls or "").split():
            for k, v in rules.get(c, {}).items():
                if k == "stroke-width":
                    v = v.replace("px", "")
                el.set(k, v)
        el.attrib.pop("id", None)
        el.attrib.pop("data-name", None)
        for k in list(el.attrib):
            el.set(k, GRAY.sub("currentColor", el.attrib[k]))
    # elemento sem fill definido herda o preto padrao: forca currentColor
    svg.set("fill", "currentColor")
    for k in ("width", "height", "x", "y", "style"):
        svg.attrib.pop(k, None)
    txt = ET.tostring(svg, encoding="unicode")
    txt = re.sub(r"\s*\n\s*", "", txt)
    txt = txt.replace(' xmlns="%s"' % SVG_NS, "", 1)
    txt = txt.replace("<svg", '<svg xmlns="%s"' % SVG_NS, 1)
    return txt


def main():
    src = sys.argv[1]
    icons = {}
    for f in sorted(os.listdir(src)):
        m = re.match(r"SVG-Icon_(.+)\.svg$", f, re.I)
        if not m:
            continue
        name = m.group(1)
        name = "Logo" if name.upper() == "LOGO" else name
        icons[name] = convert(os.path.join(src, f), name)
    crop = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    for name, box in crop.items():
        icons[name] = re.sub(r'viewBox="[^"]*"', 'viewBox="%s"' % box, icons[name], count=1)
    for name, txt in icons.items():
        with open(os.path.join(OUT_DIR, name + ".svg"), "w", encoding="utf-8") as fh:
            fh.write(txt + "\n")
    with open(OUT_JS, "w", encoding="utf-8") as fh:
        fh.write("// Gerado por tools/build_icons.py a partir dos SVGs do Lucas. Nao edite a mao.\n")
        fh.write("window.GTA_ICONS = " + json.dumps(icons, ensure_ascii=False, indent=1) + ";\n")
    print("%d icones: %s" % (len(icons), ", ".join(icons)))


if __name__ == "__main__":
    main()
