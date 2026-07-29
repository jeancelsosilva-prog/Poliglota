# Backend — Configuração da IA

O painel funciona sem backend. A **Análise local** roda offline, no navegador, sem custo. O backend só é necessário para a **Análise IA**, que dá leituras mais ricas e contextuais.

---

## Antes de começar: assinatura ≠ API

Este é o ponto que mais confunde. São produtos separados, com cobrança separada:

| Você tem | Serve para | Funciona aqui? |
|---|---|---|
| Claude Pro / Max | usar claude.ai | não |
| ChatGPT Plus | usar chat.openai.com | não |
| Gemini Advanced | usar gemini.google.com | não |

Para um app chamar a IA, é preciso uma **API key** — conta à parte, com crédito próprio.

### Onde criar

| Provedor | Endereço | Custo inicial |
|---|---|---|
| **Anthropic** | console.anthropic.com → API Keys | ~US$ 5 de crédito |
| **Google** | aistudio.google.com/apikey | **grátis** (camada gratuita) |
| **OpenAI** | platform.openai.com → API keys | ~US$ 5 de crédito |

Para uso pessoal — alguns check-ins por dia — o gasto real fica em centavos por mês. Com Gemini, provavelmente zero.

---

## Como funciona o fallback

O Worker tenta os provedores em ordem. Se um falhar por qualquer motivo — erro, crédito esgotado, instabilidade, timeout — o próximo assume sozinho, sem você perceber.

```
Claude  →  Gemini  →  GPT
```

Você configura **apenas as chaves que tiver**. Os provedores sem chave são pulados. Com só uma configurada, funciona normalmente — sem fallback, mas funciona.

Ao final da análise, um rodapé discreto mostra qual IA respondeu e se houve fallback.

---

## Setup

### 1. Criar o Worker

Em [dash.cloudflare.com](https://dash.cloudflare.com):

**Workers & Pages** → **Create** → **Create Worker** → dê um nome → **Deploy**

Clique em **Edit code**, apague tudo e cole o conteúdo de `worker.js`. Salve com **Deploy**.

### 2. Adicionar as chaves

No Worker: **Settings** → **Variables and Secrets** → **Add**

Para cada chave que tiver, adicione como tipo **Secret** (não Text — Secret fica oculto):

| Nome | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `GEMINI_API_KEY` | `AIza...` |
| `OPENAI_API_KEY` | `sk-proj-...` |

Adicione só as que possui. Salve e faça **Deploy** de novo.

### 3. Testar

Abra a URL do Worker direto no navegador. Deve responder algo assim:

```json
{
  "status": "ok",
  "service": "Políglota Worker",
  "providers": [
    { "id": "claude", "model": "claude-sonnet-4-6", "configurado": true },
    { "id": "gemini", "model": "gemini-2.0-flash",  "configurado": true },
    { "id": "gpt",    "model": "gpt-4o-mini",       "configurado": false }
  ]
}
```

Confira se `configurado: true` aparece nas chaves que você cadastrou.

### 4. Conectar ao painel

No `index.html`, localize e substitua pela URL do seu Worker:

```javascript
const WORKER_URL = 'https://SEU-WORKER.workers.dev/analisar';
```

Suba o arquivo. Pronto — o botão **Análise IA** já funciona.

---

## Segurança

**A chave nunca deve sair do painel do Cloudflare.** Não cole em chat, print, e-mail ou commit. Se isso acontecer, revogue e gere outra imediatamente no console do provedor — chave exposta é chave comprometida, mesmo que pareça que ninguém viu.

As chaves ficam **no Worker**, nunca no navegador. O `index.html` é público no GitHub Pages; se as chaves estivessem nele, qualquer um poderia copiá-las e gastar seu crédito.

### Restringir quem pode chamar

Por padrão o Worker aceita chamadas de qualquer origem. Para limitar, adicione mais uma variável:

| Nome | Valor |
|---|---|
| `ALLOWED_ORIGIN` | `https://jeancelsosilva-prog.github.io` |

Recomendado se você não quer que terceiros usem seu Worker.

---

## Trocar de modelo

No topo do `worker.js`:

Modelos padrão:

| Provedor | Modelo padrão |
|---|---|
| Claude | `claude-sonnet-5` |
| Gemini | `gemini-3.6-flash` |
| GPT | `gpt-5-mini` |

**Você não precisa editar o código para trocar.** Adicione a variável correspondente no Worker:

| Variável | Exemplo |
|---|---|
| `CLAUDE_MODEL` | `claude-opus-5` |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `OPENAI_MODEL` | `gpt-5.4-mini` |

Reordenar o array `PROVIDERS` no código muda a prioridade da cadeia.

### Modelo descontinuado

Provedores aposentam modelos periodicamente. O Gemini 2.0 Flash, por exemplo, foi desligado em 1º de junho de 2026.

Se isso acontecer, a análise retorna uma mensagem explícita dizendo qual modelo falhou. A correção é adicionar a variável de ambiente com um modelo atual — sem tocar no código.

---

## Problemas comuns

**Todos os provedores falharam**
Nenhuma chave configurada ou todas inválidas. Abra a URL do Worker no navegador e confira o `configurado` de cada uma.

**Erro de CORS**
`ALLOWED_ORIGIN` não bate com o domínio do site. Confira se está exatamente igual, sem barra no final.

**401 ou 403**
Chave inválida ou sem crédito. Verifique o saldo no console do provedor.

**429**
Limite de requisições atingido. Se houver outro provedor configurado, o fallback resolve sozinho.

**A análise não responde**
Confirme que `WORKER_URL` no `index.html` aponta para a URL correta e termina em `/analisar`.

---

## Custo estimado

Um check-in gasta em torno de 1.500 tokens de entrada e 500 de saída.

| Modelo | ~30 check-ins/mês |
|---|---|
| gemini-2.0-flash | grátis na camada gratuita |
| gpt-4o-mini | menos de US$ 0,05 |
| claude-sonnet-4-6 | cerca de US$ 0,30 |

Mesmo usando Claude todo dia, o custo mensal fica abaixo de um café.
