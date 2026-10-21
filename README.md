# GTA • Grand Tracker Auto

Painel para **Adobe Premiere Pro** que reenquadra vídeos 16:9 em **9:16** seguindo o pregador, criando keyframes de **Position (eixo X)** que você pode ajustar normalmente no Effect Controls.

Feito para transformar pregações gravadas para o YouTube em cortes verticais para Instagram/Reels.

## Recursos

- **Fila de clipes**: selecione vários clipes e trackeie todos de uma vez, com progresso por clipe, progresso geral e tempo estimado.
- **Dois estilos de câmera**
  - *Rosto no centro*: segue o rosto continuamente.
  - *Câmera parada*: só anda quando a pessoa muda de lugar, com pans suaves.
- **Zona morta** e **Suavidade** ajustáveis.
- **Limpar Motion**: zera o Motion dos clipes selecionados.
- **Avisos sonoros** ao terminar a fila (OK / FAIL).
- **Atualização automática** pelas releases deste repositório.

## Instalação (Windows)

1. Instale o [Python](https://www.python.org/downloads/) marcando *Add python.exe to PATH*.
2. Baixe o zip da [última release](https://github.com/lchedick/grand-tracker-auto/releases/latest) e descompacte.
3. Feche o Premiere e rode `instalar.bat`.
4. No Premiere: **Window → Extensions → GTA • Grand Tracker Auto V1**.

macOS: em breve.

## Como funciona

1. O motor (`GrandTrackerAuto/engine/seguir_pregador.py`) analisa ~10 quadros por segundo do trecho do clipe.
2. Um detector de pessoas (YOLOX-nano) e um detector de rosto (YuNet) localizam o pregador e a posição X do rosto.
3. A trajetória é limpa (mediana + suavização sem atraso) e convertida num caminho de câmera conforme o estilo escolhido.
4. O painel converte o caminho em keyframes de Position no clipe via ExtendScript.

## Estrutura

```
GrandTrackerAuto/        extensão CEP (é o que vai para a pasta de extensões)
  CSXS/manifest.xml
  index.html, js/main.js painel
  jsx/host.jsx           integração com o Premiere (ExtendScript)
  engine/                motor de rastreamento em Python + modelos ONNX
  assets/                ícones e sons
  version.json           versão usada pelo atualizador
instalar.bat             instalador Windows
tools/build_release.py   gera o zip da release
```

## Publicar uma versão nova

Veja [RELEASE.md](RELEASE.md).

---

Grand Tracker Auto | Desenvolvido por Lucas Chedick · Licenças de terceiros em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
