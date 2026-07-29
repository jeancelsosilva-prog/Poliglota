# Políglota — Painel de Idiomas

Painel de acompanhamento para estudo de idiomas em ciclos longos. Um único arquivo HTML, sem build, sem dependências, sem backend obrigatório.

Três programas independentes num só app: **Espanhol (200 dias)**, **Francês (365 dias)** e **Mandarim (720 dias)**.

**Demo:** https://jeancelsosilva-prog.github.io/espanhol-200-dias/

---

## O que é

A maioria dos apps de idioma trata todo mundo igual e assume rotina previsível. Este não. Ele foi desenhado em torno de duas restrições concretas:

- **Escala de trabalho 24h/72h** — nem todo dia comporta a mesma carga cognitiva. O painel trabalha com três formatos de sessão (completa, padrão, mínima) e recomenda qual usar conforme o tipo de dia.
- **Tempo morto aproveitável** — trajetos longos dirigindo viram input auditivo. Todas as rotinas separam explicitamente o que exige atenção do que pode ser feito sem olhar para a tela.

O objetivo não é gamificar. É registrar com honestidade e receber leitura útil sobre o que ajustar.

---

## Funcionalidades

### Programa
| Página | O que traz |
|---|---|
| **Visão Geral** | Pilares, ferramentas, metas e regra de sessão por tipo de dia |
| **Fases** | Divisão progressiva com objetivos, conteúdo e marco de cada fase |
| **Rotinas** | Sessão completa, padrão e mínima detalhadas por bloco de tempo |
| **Método** | Protocolos fixos de estudo, fonética e prática oral |

### Acompanhamento
| Página | O que faz |
|---|---|
| **Check-in** | Formulário diário com campos específicos por idioma |
| **Avaliações** | Pontos de avaliação programados ao longo do programa |
| **Métricas** | Metas por fase e critérios de avanço, revisão ou simplificação |
| **Histórico** | Últimos 50 check-ins, com exportação e importação em JSON |

### Inteligência
Painel que lê o histórico salvo e calcula sozinho:

- Dias estudados, dias perdidos, sequência atual e maior sequência
- Consistência em 7 e 30 dias
- Compreensão média com gráfico de tendência dos últimos 10 registros
- Horas acumuladas de estudo, fala e escuta
- Projeção de conclusão do programa
- Nível estimado (CEFR para espanhol e francês, HSK para mandarim)
- Risco de abandono
- Pontos fortes, pontos a melhorar e uma recomendação objetiva

### Análise do check-in
Dois modos:

- **Análise local** — regras em JavaScript, roda offline, sem custo
- **Análise IA** — envia o check-in, o histórico recente e as métricas acumuladas para um Cloudflare Worker, que consulta a API da Anthropic com o contexto correto do idioma

---

## Estrutura de arquivos

```
/
├── index.html          # aplicação completa
├── manifest.json       # configuração PWA
├── worker.js           # Cloudflare Worker (opcional)
├── icon.svg            # ícone vetorial
├── icon-512.png        # PWA / splash Android
├── icon-192.png        # PWA padrão
├── icon-180.png        # apple-touch-icon
├── icon-152.png        # iPad
├── icon-144.png        # Windows tile
├── icon-96.png         # Android hdpi
├── icon-32.png         # aba do navegador
├── icon-16.png         # favicon
└── favicon.ico         # multi-size 16/32/48
```

---

## Instalação

### GitHub Pages

1. Suba todos os arquivos na raiz do repositório
2. **Settings → Pages → Source:** branch `main`, pasta `/ (root)`
3. Aguarde 1–3 minutos

Se o repositório tiver outro nome, ajuste o caminho em três lugares do `index.html` e no `manifest.json` — os ícones e o manifest usam caminho absoluto:

```html
<link rel="manifest" href="/SEU-REPO/manifest.json">
<link rel="apple-touch-icon" href="/SEU-REPO/icon-180.png">
```

```json
{ "start_url": "/SEU-REPO/", "scope": "/SEU-REPO/" }
```

### Como app no celular

**iOS (Safari):** Compartilhar → Adicionar à Tela de Início
**Android (Chrome):** menu → Instalar app

Se o ícone vier errado, feche o Safari por completo e abra de novo — ele guarda o manifest em cache de forma agressiva.

### Análise por IA (opcional)

O painel funciona sem isso. Para ativar:

1. Crie um Worker em [dash.cloudflare.com](https://dash.cloudflare.com) e cole o conteúdo de `worker.js`
2. Em **Settings → Variables**, adicione `ANTHROPIC_API_KEY` como variável secreta
3. No `index.html`, substitua a URL:

```javascript
const WORKER_URL = 'https://seu-worker.workers.dev/analisar';
```

---

## Dados

Tudo fica no `localStorage` do navegador. Nada é enviado a lugar nenhum, exceto quando você aciona a análise por IA — e nesse caso só o conteúdo daquele check-in.

Cada idioma usa namespace próprio:

```
polyglot.es.checkins
polyglot.fr.checkins
polyglot.zh.checkins
polyglot.{lang}.currentDay
polyglot.meta.theme
polyglot.meta.migratedVersion
```

Trocar de idioma não mistura nem sobrescreve nada.

**Migração automática:** ao abrir uma versão nova, o app detecta dados de formatos anteriores e migra sozinho, em silêncio. Roda uma vez só.

**Cuidado:** limpar os dados do site apaga o histórico. Use **Exportar JSON** de vez em quando.

---

## Arquitetura

Orientada a dados. Adicionar um idioma novo é adicionar uma entrada em dois objetos — não duplicar HTML.

```javascript
PROGRAMS = {
  es: { totalDays: 200, phases: [...], accent: '#e8c547', ... },
  fr: { totalDays: 365, phases: [...], accent: '#4f8ef7', ... },
  zh: { totalDays: 720, phases: [...], accent: '#e84c3d', ... },
}

CONTENT = {
  es: { visao: () => `...`, fases: () => `...`, ... },
  fr: { ... },
  zh: { ... },
}
```

A cor de destaque, a barra de fases, o contador de dias, o formulário de check-in e as métricas mudam sozinhos ao trocar de idioma — tudo lê do objeto, nada é fixo no HTML.

**Componentes compartilhados:** `buildCheckinForm()`, `buildAvaliacoes()`, `buildMetricas()`, `buildPainel()` e `buildHistorico()` recebem o idioma como parâmetro e se adaptam.

---

## Métricas por idioma

Cada idioma acompanha o que faz sentido para ele.

**Comum aos três:** tempo de exposição, compreensão estimada, consistência semanal, minutos de fala sem roteiro, energia e motivação.

**Espanhol:** dependência do portunhol, expressões reutilizadas, capacidade de contornar palavras desconhecidas.

**Francês:** qualidade dos sons-chave (`/y/`, `/ø/`, `/œ/`, `/ʁ/`, nasais), liaison e enchaînement em contexto, dependência de tradução, reconhecimento na escrita versus na fala.

**Mandarim:** precisão dos tons, caracteres reconhecidos, leitura sem pinyin, pares tonais confundidos, produção escrita por digitação.

---

## Interface

- Tema claro e escuro, com paleta recalibrada em cada um — não é inversão automática
- Segue a preferência do sistema até você escolher manualmente
- Aplica o tema antes do primeiro paint, sem flash branco ao abrir
- Responsivo de 375px a desktop
- Alvos de toque de 44px e inputs de 16px no mobile (evita o zoom automático do iOS)
- Navegação por teclado com foco visível, ESC fecha o menu lateral
- Estilos de impressão

---

## Compatibilidade

Chrome, Firefox, Safari e Edge em versões recentes. Safari a partir da 13 (há fallback para `matchMedia.addListener`, que a 14 substituiu).

Sem build, sem `npm install`, sem framework. É um arquivo HTML — abre com duplo clique.

---

## Roadmap

- [x] Espanhol completo
- [x] Painel de Inteligência
- [x] Tema claro e escuro
- [x] PWA instalável
- [ ] Conteúdo completo de francês e mandarim
- [ ] Separação em módulos (`/js/`, `/data/`) quando os três idiomas estiverem completos
- [ ] Módulos pedagógicos transversais: Pronúncia, Vocabulário, Escuta, Conversação, Escrita

---

## Licença

Projeto pessoal. Sinta-se livre para adaptar ao seu contexto.
