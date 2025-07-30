# App de Chat IA por Roberto Junior

Este é um aplicativo web de chat alimentado por Inteligência Artificial, desenvolvido em React. O usuário pode enviar mensagens e receber respostas automáticas de um sistema de IA integrado (via `window.puter.ai.chat`).

---

## Funcionalidades

- Interface moderna e responsiva com estilização via Tailwind CSS.
- Detecção automática de disponibilidade da IA.
- Envio e recebimento de mensagens em tempo real.
- Indicador de carregamento enquanto a IA está processando a resposta.
- Scroll automático para mostrar a última mensagem.
- Suporte a envio de mensagens via tecla Enter (com Shift+Enter para nova linha).

---

## Como usar

1. Certifique-se que a IA está disponível (indicador "IA Pronta" será exibido).
2. Digite sua mensagem na caixa de texto.
3. Envie clicando no botão **Enviar** ou pressionando **Enter**.
4. Aguarde a resposta da IA aparecer na tela.

---

## Tecnologias usadas

- React (Hooks: useState, useEffect, useRef)
- Tailwind CSS para estilização
- API externa simulada por `window.puter.ai.chat`

---

## Como executar localmente

1. Clone este repositório:
   ```bash
   git clone <url-do-repositorio>
