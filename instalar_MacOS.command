#!/bin/bash
# GTA - Grand Tracker Auto - instalacao (Mac) [BETA]
cd "$(dirname "$0")" || exit 1
clear
echo ""
echo " === GTA - Grand Tracker Auto - instalacao (Mac) [beta] ==="
echo ""

fim() { echo ""; read -r -p " Pressione Enter para fechar..." _; exit "${1:-0}"; }

# ------------------------------------------------------------------
# 1) copia o painel para a pasta de extensoes do Premiere
# ------------------------------------------------------------------
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/GrandTrackerAuto"
mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
if ! cp -R "GrandTrackerAuto" "$DEST"; then
  echo " Nao consegui copiar os arquivos. Feche o Premiere e tente de novo."
  fim 1
fi
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null
echo " [ok] Painel copiado para $DEST"

# ------------------------------------------------------------------
# 2) libera paineis nao assinados (necessario para extensoes proprias)
# ------------------------------------------------------------------
for v in 9 10 11 12 13 14 15 16; do
  defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1 2>/dev/null
done
echo " [ok] Premiere configurado para carregar o painel"

# ------------------------------------------------------------------
# 3) Python: procura; se nao tiver, oferece instalar
# ------------------------------------------------------------------
find_python() {
  PY=""
  for c in /Library/Frameworks/Python.framework/Versions/3.*/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3; do
    if [ -x "$c" ] && "$c" -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" 2>/dev/null; then PY="$c"; fi
  done
  [ -n "$PY" ] && return 0
  # /usr/bin/python3 so existe de verdade se as Ferramentas de Linha de Comando estiverem instaladas
  if xcode-select -p >/dev/null 2>&1 && /usr/bin/python3 -c "import sys" 2>/dev/null; then PY="/usr/bin/python3"; fi
  [ -n "$PY" ]
}

if ! find_python; then
  echo ""
  echo " O Python nao esta instalado neste Mac."
  echo " Ele e necessario para o rastreamento funcionar."
  echo ""
  read -r -p " Quer que eu instale o Python agora? (S/N): " resp
  case "$resp" in
    [sS]*) ;;
    *) echo ""; echo " Sem o Python o rastreamento nao funciona. Rode este instalador de novo quando quiser."; fim 1 ;;
  esac
  PKG="/tmp/python-3.12.10-macos11.pkg"
  echo " Baixando o Python..."
  if ! curl -fL --progress-bar -o "$PKG" "https://www.python.org/ftp/python/3.12.10/python-3.12.10-macos11.pkg"; then
    echo " Nao consegui baixar o Python. Verifique a internet."
    fim 1
  fi
  echo ""
  echo " Instalando o Python. O Mac vai pedir a senha do computador:"
  if ! sudo installer -pkg "$PKG" -target /; then
    echo " A instalacao do Python falhou."
    fim 1
  fi
  rm -f "$PKG"
  find_python || { echo " Nao encontrei o Python depois de instalar."; fim 1; }
fi
echo " [ok] Python encontrado: $PY"
printf '%s\n' "$PY" > "$DEST/python_path.txt"

# ------------------------------------------------------------------
# 4) bibliotecas
# ------------------------------------------------------------------
echo " Instalando bibliotecas (OpenCV e NumPy)..."
REQ="$DEST/engine/requirements.txt"
if ! "$PY" -m pip install --upgrade --disable-pip-version-check -r "$REQ" 2>/dev/null; then
  if ! "$PY" -m pip install --user --upgrade --disable-pip-version-check -r "$REQ"; then
    if ! "$PY" -m pip install --user --break-system-packages --upgrade --disable-pip-version-check -r "$REQ"; then
      echo " Falha ao instalar as bibliotecas (verifique a internet) e rode de novo."
      fim 1
    fi
  fi
fi
echo " [ok] Bibliotecas instaladas"

echo ""
echo " Pronto! Abra o Premiere e va em:"
echo " Window > Extensions > GTA - Grand Tracker Auto V1"
fim 0
