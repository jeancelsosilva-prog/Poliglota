/**
 * Cloudflare Worker — Políglota Language Coach
 * Rota: POST /analisar
 *
 * Body esperado:
 * {
 *   lang:     'es' | 'fr' | 'zh',
 *   fase:     string (nome da fase atual),
 *   faseNum:  number,
 *   checkin:  { dia, sessao, tipoDia, compreensao, fala, energia, ... }
 * }
 *
 * Variável de ambiente necessária: ANTHROPIC_API_KEY
 */

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;

/* ─── System prompts por idioma ───────────────────── */
const SYSTEM_PROMPTS = {

  es: `Você é o agente de acompanhamento do programa de espanhol de 200 dias.
O usuário é brasileiro, iniciante, com tendência ao portunhol.
Ferramentas: Fluency Academy (espinha dorsal), Drops (vocabulário), Uber (input extensivo seguro).
Escala de trabalho: 24h serviço / 72h folga.
Fases: F1 D1-40 (fundação sonora), F2 D41-80 (vocabulário funcional), F3 D81-120 (fluência progressiva), F4 D121-160 (autonomia comunicativa), F5 D161-200 (consolidação).
Metas de compreensão: F1→30-40%, F2→50-60%, F3→65-70%, F4→75-80%, F5→80%+.
Módulo permanente: desportuguesização (sons, falsos cognatos, portunhol).
Princípio: preservar continuidade. Nunca mudar toda a metodologia por um dia ruim.
Corrija prioritariamente erros que prejudiquem compreensão ou que se repitam.`,

  fr: `Você é o agente de acompanhamento do programa de francês de 365 dias.
O usuário é brasileiro, partindo do zero, com foco em B1 funcional ao Dia 365.
Ferramentas: Fluency Academy (espinha dorsal), Drops→Memrise (vocabulário), InnerFrench/Coffee Break French (input extensivo).
Escala de trabalho: 24h serviço / 72h folga.
Temporada 1 (D1-180): objetivo A2 forte / B1 inicial.
  Fases: T1·F1 D1-60 (fundação fonética), T1·F2 D61-120 (estrutura básica), T1·F3 D121-180 (autonomia A2).
Temporada 2 (D181-365): objetivo B1 funcional e estável.
  Fases: T2·F1 D181-260 (consolidação B1), T2·F2 D261-330 (fluência progressiva), T2·F3 D331-365 (B1 estável).
Metas de compreensão: T1F1→30-40%, T1F2→45-55%, T1F3→55-65%, T2F1→65-70%, T2F2→70-75%, T2F3→75%+.
Módulo permanente: fonética IPA simplificada (/y/ /ø/ /œ/ /ʁ/ e nasais) e dessaportuguesização (8 eixos: nasais, u/ou, consoantes finais, liaison, enchaînement, ritmo, falsos cognatos, escrita vs fala).
Protocolo Fluency Academy tem etapa adicional de fonética ativa após o shadowing.
Princípio: preservar continuidade. Pronúncia é prioridade máxima junto à compreensão.`,

  zh: `Você é o agente de acompanhamento do programa de mandarim padrão de 720 dias (caracteres simplificados).
O usuário é brasileiro, partindo do zero absoluto.
Ferramentas: Fluency Academy (espinha dorsal), HelloChinese (reforço pinyin, F1), Drops/Chineasy (vocabulário visual), Du Chinese (leitura graduada), Pleco (dicionário), Skritter (escrita manual, a partir do Dia 91, complementar), Mandarin Corner (input graduado).
Escala de trabalho: 24h serviço / 72h folga.
6 macrofases de 120 dias, cada uma com 4 ciclos de 30 dias:
  F1 D1-120: fundação fonética e primeiros caracteres. Pinyin, 4 tons, pares difíceis.
  F2 D121-240: estrutura básica e sobrevivência. SVO, classificadores, independência do pinyin.
  F3 D241-360: autonomia elementar. Conversas 5-10 min, leitura graduada HSK2-3.
  F4 D361-480: expansão auditiva e leitora. Velocidade de processamento, HSK3-4.
  F5 D481-600: conversação intermediária. Relatos, opiniões, materiais semi-nativos.
  F6 D601-720: autonomia funcional. Conversas longas, leitura sem pinyin, conteúdo nativo parcial.
Metas de compreensão: F1→25-35%, F2→35-45%, F3→45-55%, F4→55-65%, F5→65-72%, F6→72-80%.
Metas de caracteres: F1→150, F2→300, F3→450, F4→650, F5→850, F6→1000+.
Prioridade máxima nos primeiros 120 dias: tons corretos antes de velocidade.
Skritter nunca deve bloquear progresso em fala, escuta ou leitura.
Princípio: preservar continuidade. Tons são a fundação — um tom errado muda o significado.`,
};

/* ─── Prompt do usuário com checkin ──────────────── */
function buildUserPrompt(lang, fase, faseNum, ci, history = [], accumulated = {}, day = ci.dia || 1) {
  const langNames = { es:'espanhol', fr:'francês', zh:'mandarim' };
  const sessaoMap = { completa:'completa', padrao:'padrão', minima:'mínima', zero:'sem estudo' };
  const diaMap = {
    'folga-ok':'folga recuperada', 'folga-cansado':'folga cansado',
    'pos-plantao':'pós-plantão', 'plantao':'plantão'
  };

  // Montar linhas de métricas específicas por idioma
  const metricsExtra = {
    es: `Dependência do portunhol: ${ci.portuhol || 'não informado'}`,
    fr: [
      `Pronúncia (autoavaliação): ${ci.pronuncia ?? 'não informado'}/10`,
      `Liaison/enchaînement: ${ci.liaison || 'não informado'}`,
      `Som mais difícil: ${ci.somDificil || 'não informado'}`,
      `Dependência de tradução: ${ci.traducao || 'não informado'}`,
    ].join('\n'),
    zh: [
      `Precisão dos tons (autoavaliação): ${ci.tons ?? 'não informado'}/10`,
      `Caracteres reconhecidos (estimativa): ${ci.chars ?? 'não informado'}`,
      `Leitura sem pinyin: ${ci.pinyin || 'não informado'}`,
      `Par tonal mais difícil: ${ci.tomDificil || 'não informado'}`,
    ].join('\n'),
  };

  const activitiesExtra = {
    es: [
      `Fluency Academy: ${ci.fluency || 'não informado'}`,
      `Drops: ${ci.drops || 'não informado'}`,
      `Escuta ativa: ${ci.escutaAtiva || 'não realizada'}`,
      `Escuta Uber/tempo morto: ${ci.escutaMorto || 'não informado'}`,
      `Criação de conteúdo: ${ci.criacao || 'não informado'}`,
    ].join('\n'),
    fr: [
      `Fluency Academy: ${ci.fluency || 'não informado'}`,
      `Drops/Memrise: ${ci.drops || 'não informado'}`,
      `Escuta ativa: ${ci.escutaAtiva || 'não realizada'}`,
      `Escuta Uber: ${ci.escutaMorto || 'não informado'}`,
      `Exercício de fonética ativa: ${ci.fonetica || 'não informado'}`,
    ].join('\n'),
    zh: [
      `Fluency Academy: ${ci.fluency || 'não informado'}`,
      `HelloChinese / Du Chinese: ${ci.drops || 'não informado'}`,
      `Drops/Chineasy (caracteres): ${ci.vocab || 'não informado'}`,
      `Escuta Uber / Mandarin Corner: ${ci.escutaMorto || 'não informado'}`,
      `Skritter: ${ci.skritter || 'não informado'}`,
    ].join('\n'),
  };

  /* ── Histórico recente (últimos 5 check-ins) ── */
  const historyBlock = history.length
    ? '\nHISTÓRICO RECENTE (últimos ' + history.length + ' check-ins):\n' +
      history.map((h, i) => `  D${h.dia}: compr=${h.compreensao}% fala=${h.fala}min energia=${h.energia}/10 sessao=${h.sessao||'?'}`).join('\n')
    : '';

  /* ── Métricas acumuladas ── */
  const accBlock = accumulated.totalCheckins
    ? `\nMÉTRICAS ACUMULADAS:\n  Check-ins: ${accumulated.totalCheckins} | Consistência 7d: ${accumulated.consistencia7d}% | Compreensão média: ${accumulated.mediaCompreensao}% | Streak: ${accumulated.streak} dias | Total fala: ${accumulated.totalMinFala} min`
    : '';

  return `CHECK-IN — DIA ${day} / FASE ${faseNum} (${fase}) — ${langNames[lang].toUpperCase()}

CONTEXTO DO DIA:
Tipo de dia: ${diaMap[ci.tipoDia] || 'não informado'}
Tipo de sessão: ${sessaoMap[ci.sessao] || 'não informada'}

ATIVIDADES:
${activitiesExtra[lang]}

MÉTRICAS:
Compreensão estimada: ${ci.compreensao ?? 'não informado'}%
Minutos de fala sem roteiro: ${ci.fala ?? 0} min
Energia e motivação: ${ci.energia ?? 'não informado'}/10
${metricsExtra[lang]}

QUALITATIVO:
Principal dificuldade: ${ci.dificuldade || 'não informado'}
Principal avanço: ${ci.avanco || 'não informado'}

---
Analise este check-in e responda com as seções abaixo, sem markdown, sem asteriscos, sem emojis.
Tom técnico, direto, construtivo. Máximo 5 linhas por seção.

${historyBlock}${accBlock}

DIAGNÓSTICO DO DIA
MÉTRICAS EM FOCO
ALERTA OU REFORÇO
AJUSTE PRIORITÁRIO
PRÓXIMO DIA`;
}

/* ─── Handler principal ───────────────────────────── */
async function handleRequest(request, env) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const {
    language    = 'es',
    lang: lFb   = 'es',
    phase       = '',
    fase        = '',
    phaseNum    = 1,
    faseNum     = 1,
    day         = 1,
    history     = [],
    accumulated = {},
    currentCheckin = {},
    checkin     = {},
  } = body;

  const lang      = language || lFb;
  const phaseName = phase || fase;
  const phaseN    = phaseNum || faseNum;
  const ci        = Object.keys(currentCheckin).length ? currentCheckin : checkin;

  const systemPrompt = SYSTEM_PROMPTS[lang] || SYSTEM_PROMPTS.es;
  const userPrompt   = buildUserPrompt(lang, phaseName, phaseN, ci, history, accumulated, day);

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  let anthropicRes;
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userPrompt }],
      }),
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Anthropic API unreachable: ' + err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    return new Response(JSON.stringify({ error: 'Anthropic error ' + anthropicRes.status, detail: errText }), {
      status: anthropicRes.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const data = await anthropicRes.json();
  const text = (data.content || []).map(b => b.text || '').join('');

  return new Response(JSON.stringify({ analysis: text }), {
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
}

/* ─── Export ──────────────────────────────────────── */
export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  }
};
