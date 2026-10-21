# GTA • Grand Tracker Auto

Painel para **Adobe Premiere Pro** que reenquadra vídeos 16:9 em **9:16** seguindo o pregador. Ele cria keyframes de **Position (eixo X)** que você ajusta normalmente no Effect Controls.

Feito para transformar pregações gravadas para o YouTube em cortes verticais para Instagram e Reels.

## Recursos

- **Dois estilos de câmera**
  - *Rosto no centro*: segue o rosto continuamente.
  - *Câmera parada*: só anda quando a pessoa muda de lugar, com movimentos suaves.
- **Mais opções**: zona morta, suavidade, posição do rosto (centro ou deslocado para um lado) e ajuste automático de escala.
- **Fila de clipes**: trackeie vários clipes de uma vez, com progresso, tempo estimado e cancelamento. Clique num clipe para achá-lo na timeline e use "Tentar de novo os que falharam".
- **Limpar Motion**: zera o Motion dos clipes selecionados.
- **Qualidade da análise** (Rápida, Normal ou Precisa) e uso automático de **proxy**.
- **Avisos**: "Missão cumprida!", sons de sucesso e falha com volume ajustável, e notificação do Windows ao terminar.
- **Atualização automática** pelas releases deste repositório, com notas da versão e botão para reiniciar o Premiere.
- **Tamanho da interface** ajustável (Pequena, Média ou Grande).

## Instalação (Windows)

1. Instale o [Python](https://www.python.org/downloads/) marcando *Add python.exe to PATH*.
2. Baixe o zip da [última release](https://github.com/lchedick/grand-tracker-auto/releases/latest) e descompacte.
3. Feche o Premiere e rode `instalar.bat`.
4. No Premiere: **Window → Extensions → GTA • Grand Tracker Auto V1**.

macOS: em breve.

## Como usar

1. Crie uma sequência vertical (1080×1920) com os trechos do vídeo.
   O clipe **não** pode estar com *Scale to Frame Size* ligado.
2. Selecione um ou mais clipes na timeline.
3. Clique em **Trackear**.
4. Os keyframes aparecem em **Effect Controls → Motion → Position**.

## Como funciona

1. O motor (`GrandTrackerAuto/engine/seguir_pregador.py`) analisa o trecho do clipe: 5, 10 ou 15 quadros por segundo, conforme a qualidade escolhida.
2. Um detector de pessoas (YOLOX-nano) e um detector de rosto (YuNet) localizam o pregador e a posição do rosto.
3. A trajetória é limpa (mediana + suavização sem atraso) e vira um caminho de câmera conforme o estilo escolhido.
4. O painel converte esse caminho em keyframes de Position no clipe, via ExtendScript.

## Estrutura

```
GrandTrackerAuto/          extensão CEP (o que vai para a pasta de extensões)
├── CSXS/manifest.xml
├── index.html             painel (interface)
├── js/main.js             painel (lógica)
├── jsx/host.jsx           integração com o Premiere (ExtendScript)
├── engine/                motor de rastreamento em Python + modelos ONNX
├── assets/                ícones e sons
├── CHANGELOG.md           notas de cada versão (mostradas no painel)
└── version.json           versão usada pelo atualizador
instalar.bat               instalador Windows
LEIA-ME.txt                guia rápido que vai junto no zip
tools/build_release.py     gera o zip da release
```


## Publicar uma versão nova

Veja [RELEASE.md](RELEASE.md). O histórico de versões fica em [GrandTrackerAuto/CHANGELOG.md](GrandTrackerAuto/CHANGELOG.md).

---

Grand Tracker Auto | Desenvolvido por Lucas Chedick · [Licença MIT](LICENSE) · Licenças de terceiros em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
