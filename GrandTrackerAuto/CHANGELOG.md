# Changelog

## v1.1.0 — outubro de 2026

- **Visual novo**: todos os ícones foram redesenhados e agora são vetoriais (SVG), nítidos em qualquer tamanho de interface.
- **Logo novo** no cabeçalho.
- **Botões principais repaginados**: cantos mais arredondados, mais espaço entre eles e uma animação que aumenta o botão quando você passa o mouse.
- **Pausar e Continuar** com ícones próprios.
- **Correção do "Reiniciar o Premiere" no Mac**: o Premiere fechava e não abria de novo. Agora ele reabre com o projeto.
- **Correção do erro "This file path does not exist on disk"** ao reiniciar pelo botão (Windows): o projeto agora é aberto como num duplo clique no arquivo. Se mesmo assim o Premiere abrir sem ele, o painel abre o projeto sozinho.
- **Botão "Reiniciar o Premiere"** em Configurações → Suporte.
- Correção: a barra azul do controle "Posição do rosto" agora sai do centro e cresce só para o lado em que você arrasta.
- Removido o contador no título do painel (o Premiere não deixa o painel mudar o título).

## v1.0.9 — outubro de 2026

- **Estilos renomeados**: "Trackear rosto" (acompanha o rosto o tempo todo) e "Trackear corpo" (ignora o balanço e só anda quando o assunto muda de lugar). Agora são botões grandes, que ficam um embaixo do outro quando o painel está estreito.
- **Pausar fila**: o clipe atual termina e a fila espera até você clicar em "Continuar".
- **Barra de progresso no ícone do Premiere** na barra de tarefas (Windows): verde durante a fila, amarela pausada e vermelha se algo falhar.
- **Som a cada clipe ou ao fim da fila**: escolha em Configurações → Avisos (padrão: ao fim da fila).
- **Mês e ano** de cada versão nas notas da versão.
- Correção: a barra azul do controle "Posição do rosto" agora acompanha a bolinha.
- Textos mais genéricos: o painel e a documentação agora falam em **assunto** (a pessoa em cena) em vez de "pregador".

## v1.0.8 — outubro de 2026
- **Notificação mais esperta**: se o Premiere estiver em primeiro plano quando a fila terminar, a notificação não aparece (o som continua tocando). Dá para desligar em Configurações → Avisos.
- **Ícone piscando (Windows)**: se o Premiere estiver minimizado ou atrás de outra janela, o ícone dele pisca na barra de tarefas até você voltar.
- **Selo de confiança na fila**: cada clipe pronto mostra em quanto do tempo o assunto foi encontrado (verde acima de 90%, amarelo de 70% a 89%, vermelho abaixo de 70%).
- **Tempo de cada clipe** na fila (ex.: "39 keyframes · 18s").
- **Resumo dos ajustes** ao lado de "Mais opções" (ex.: "Zona 0% · Suav. 0.5 · Centro").

## v1.0.7 — outubro de 2026
- **Instalação do Python automática (Windows)**: se o Python não estiver instalado, o instalador pergunta e instala sozinho, sem pedir senha de administrador.
- **Mac (beta)**: novo instalador `instalar_MacOS.command`, que também oferece instalar o Python. "Reiniciar o Premiere agora" e notificações funcionam no Mac.
- Instaladores renomeados: `instalar_Windows.bat` e `instalar_MacOS.command`.
- O painel passa a usar automaticamente o Python encontrado pelo instalador.
- LEIA-ME reorganizado, com instruções para Windows e Mac.

## v1.0.6 — outubro de 2026
- **Correção do "Reiniciar o Premiere agora"**: o Premiere fechava mas não abria de novo. Agora quem reabre o Premiere é um processo do próprio Windows, que não é encerrado junto com ele.
- O diagnóstico (Configurações → Copiar diagnóstico) agora inclui o registro do último reinício.
- **Mais opções**: zona morta, suavidade, posição do rosto e "Ajustar escala" agora ficam num menu recolhível. A tela inicial mostra só os botões e o Estilo.
- **Novos padrões**: zona morta 0%, suavidade 0.5 e rosto no centro (use Configurações → Restaurar padrões para aplicar).
- **Tamanho da interface** nas Configurações: Pequena, Média ou Grande.
- Seções **Python**, **Suporte** e **Log** das Configurações agora são recolhíveis.
- **Sons mais altos** e volume padrão em 100%.
- Trackear e Limpar Motion ficam **um embaixo do outro** quando o painel está estreito.

## v1.0.5 — outubro de 2026
- **Missão cumprida!**: quando a fila termina sem erro, a mensagem de conclusão ganha animação de entrada e um brilho.
- **Ícones da fila animados**: o ✓ dá um pulinho quando o clipe termina e o ✗ dá uma tremidinha quando falha.
- **Sons novos** de sucesso e de falha.
- **Testar sons e volume** nas Configurações.
- **Notas da versão**: aparecem sozinhas depois de atualizar, e também no botão "Ver notas da versão" (quando já está atualizado e em Configurações → Sobre).
- **Notificação do Windows** ao terminar a fila, com status das permissões e botão "Testar notificação" nas Configurações.

## v1.0.4 — outubro de 2026
- Cabeçalho novo: "GTA" + "Grand Tracker Auto V1", com botão de atualização (bolinha verde quando há versão nova) ao lado das Configurações.
- Botões Trackear e Limpar Motion do mesmo tamanho (meio a meio).
- Configurações em pop-up (fecha no X, no Esc ou clicando fora), com:
  - Qualidade da análise: Rápida, Normal ou Precisa.
  - Usar proxy quando existir (automático).
  - Sons e verificação de atualizações ao abrir (liga/desliga).
  - Testar Python, Copiar diagnóstico, Restaurar padrões e Sobre.
- Posição do rosto: deixa o rosto no centro ou deslocado para um lado.
- Fila: clique num clipe para selecioná-lo na timeline; botão "Tentar de novo os que falharam".
- Licença MIT.

## v1.0.3 — outubro de 2026
- Mensagens de conclusão vermelhas com a mesma formatação das verdes (tamanho e centralização).
- Botão "Reiniciar o Premiere agora" depois de uma atualização (Windows): fecha o Premiere, pedindo para salvar se precisar, e abre de novo com o mesmo projeto.

## v1.0.2 — outubro de 2026
- Ícones 50% maiores (ícones exportados em alta resolução).
- Novo ícone do Limpar Motion.
- Aviso de atualização em verde.
- Mensagens de conclusão em verde menores e centralizadas.
- Botões de Estilo com ícone em cima do texto; título não quebra mais linha.
- Painel abre um pouco mais largo por padrão.

## v1.0.1 — outubro de 2026
- Ícones 2x maiores.
- Avisos de "Pronto", "Motion limpo" e resumo da fila em destaque (texto maior), com o tempo total em negrito.
- Botões principais se reorganizam quando o painel está estreito.
- Lista da fila mais alta.

## v1.0.0 — outubro de 2026
Primeira versão como **GTA • Grand Tracker Auto V1** (antes "Seguir Pregador").

- Fila com vários clipes: [n/N], progresso por clipe e geral, tempo estimado.
- Clipes com falha não param a fila; clipes aninhados (nest) ou sem arquivo de vídeo são pulados com o motivo.
- Botão Cancelar fila.
- Estilos "Rosto no centro" e "Câmera parada" com botões e ícones.
- Botão Limpar Motion (zera o Motion dos clipes selecionados).
- Sons ao final da fila (OK / FAIL).
- Verificação e instalação de atualizações pelo GitHub.
- Nova interface no padrão do Premiere, com ícones e rodapé de créditos.
