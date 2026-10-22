# GTA • Grand Tracker Auto

Painel para **Adobe Premiere Pro** que reenquadra vídeos 16:9 em **9:16** seguindo o assunto (a pessoa em cena). Ele cria keyframes de **Position (eixo X)** que você ajusta normalmente no Effect Controls.

Feito para transformar pregações gravadas para o YouTube em cortes verticais para Instagram e Reels.

## Recursos

- **Dois estilos de câmera**
  - *Trackear rosto*: acompanha o rosto continuamente.
  - *Trackear corpo*: ignora o balanço e só anda quando o assunto muda de lugar, com movimentos suaves.
- **Mais opções**: zona morta, suavidade, posição do rosto (centro ou deslocado para um lado) e ajuste automático de escala.
- **Fila de clipes**: trackeie vários clipes de uma vez, com progresso (também no ícone da barra de tarefas no Windows), tempo estimado, pausa e cancelamento. Clique num clipe para achá-lo na timeline e use "Tentar de novo os que falharam".
- **Limpar Motion**: zera o Motion dos clipes selecionados.
- **Qualidade da análise** (Rápida, Normal ou Precisa) e uso automático de **proxy**.
- **Avisos**: "Missão cumprida!", sons de sucesso e falha (a cada clipe ou ao fim da fila) com volume ajustável, e notificação do Windows ou do Mac ao terminar.
- **Atualização automática** pelas releases deste repositório, com notas da versão e botão para reiniciar o Premiere.
- **Tamanho da interface** ajustável (Pequena, Média ou Grande).

## Instalação

1. Baixe o zip da [última release](https://github.com/lchedick/grand-tracker-auto/releases/latest) e descompacte.
2. Feche o Premiere e rode o instalador:
   - **Windows:** dois cliques em `instalar_Windows.bat`.
   - **Mac (beta):** botão direito em `instalar_MacOS.command` → **Abrir** → **Abrir**.
3. Se o Python não estiver instalado, o instalador oferece instalar sozinho.
4. No Premiere: **Window → Extensions → GTA • Grand Tracker Auto V1**.

## Como usar

1. Crie uma sequência vertical (1080×1920) com os trechos do vídeo.
   O clipe **não** pode estar com *Scale to Frame Size* ligado.
2. Selecione um ou mais clipes na timeline.
3. Clique em **Trackear**.
4. Os keyframes aparecem em **Effect Controls → Motion → Position**.

## Como funciona

1. O motor (`GrandTrackerAuto/engine/rastreador.py`) analisa o trecho do clipe: 5, 10 ou 15 quadros por segundo, conforme a qualidade escolhida.
2. Um detector de pessoas (YOLOX-nano) e um detector de rosto (YuNet) localizam o assunto e a posição do rosto.
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
├── assets/                ícones (SVG) e sons
├── js/icons.js            ícones usados pelo painel (gerado por tools/build_icons.py)
├── CHANGELOG.md           notas de cada versão (mostradas no painel)
└── version.json           versão usada pelo atualizador
instalar_Windows.bat       instalador Windows
instalar_MacOS.command     instalador Mac (beta)
LEIA-ME.txt                guia rápido que vai junto no zip
tools/build_release.py     gera o zip da release
tools/build_icons.py       converte os SVGs exportados do Illustrator nos ícones do painel
```

## Publicar uma versão nova

Veja [RELEASE.md](RELEASE.md). O histórico de versões fica em [GrandTrackerAuto/CHANGELOG.md](GrandTrackerAuto/CHANGELOG.md).

---

Grand Tracker Auto | Desenvolvido por Lucas Chedick · [Licença MIT](LICENSE) · Licenças de terceiros em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
