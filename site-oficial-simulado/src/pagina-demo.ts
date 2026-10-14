/**
 * Página do modo demonstração: mostra o estado do site e tem os botões para derrubar
 * (com erro ou sem resposta) e religar. Também consulta uma partida, para ver o efeito na hora.
 * HTML simples, sem dependências, servido pelo próprio simulador em GET /demo.
 */
export const PAGINA_DEMO = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Site oficial simulado</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px 16px; color: #1f2933; background: #f5f7fa; }
  h1 { font-size: 1.4rem; }
  .estado { padding: 12px 16px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
  .no_ar { background: #d1f2dc; }
  .fora_com_erro { background: #fbd5d5; }
  .sem_resposta { background: #fde8c8; }
  .botoes { display: flex; flex-wrap: wrap; gap: 8px; }
  button { padding: 10px 14px; border-radius: 6px; border: 1px solid #9aa5b1; background: #fff; cursor: pointer; font-size: 0.95rem; }
  button:hover { background: #e4e7eb; }
  section { margin-top: 28px; }
  input { padding: 9px; border-radius: 6px; border: 1px solid #9aa5b1; width: 120px; }
  pre { background: #fff; border: 1px solid #e4e7eb; border-radius: 6px; padding: 12px; overflow-x: auto; white-space: pre-wrap; }
</style>
</head>
<body>
<h1>Site oficial simulado — modo demonstração</h1>
<div id="estado" class="estado">Carregando…</div>
<div class="botoes">
  <button onclick="derrubar('erro')">Derrubar com erro</button>
  <button onclick="derrubar('sem_resposta')">Derrubar sem resposta</button>
  <button onclick="religar()">Religar</button>
</div>

<section>
  <h2>Consultar uma partida</h2>
  <p>ID só com os números, como 40923.</p>
  <input id="id" value="40923" aria-label="ID da partida">
  <button onclick="consultar()">Consultar</button>
  <pre id="resultado">—</pre>
</section>

<script>
  const TEXTO = {
    no_ar: 'No ar: as consultas respondem normalmente (com a demora de sempre).',
    fora_com_erro: 'Fora do ar, com erro: as consultas respondem 503 na hora.',
    sem_resposta: 'Fora do ar, sem resposta: as consultas ficam penduradas, sem resposta nenhuma.',
  };
  function mostrar({ estado }) {
    const caixa = document.getElementById('estado');
    caixa.textContent = TEXTO[estado] ?? estado;
    caixa.className = 'estado ' + estado;
  }
  async function atualizar() { mostrar(await (await fetch('/demo/estado')).json()); }
  async function derrubar(modo) {
    mostrar(await (await fetch('/demo/derrubar', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ modo }),
    })).json());
  }
  async function religar() { mostrar(await (await fetch('/demo/religar', { method: 'POST' })).json()); }
  async function consultar() {
    const id = document.getElementById('id').value.trim();
    const saida = document.getElementById('resultado');
    const inicio = performance.now();
    saida.textContent = 'Consultando… (até 15 s; depois desiste)';
    try {
      const resposta = await fetch('/partidas/' + encodeURIComponent(id), { signal: AbortSignal.timeout(15000) });
      const segundos = ((performance.now() - inicio) / 1000).toFixed(1);
      saida.textContent = 'HTTP ' + resposta.status + ' em ' + segundos + ' s\\n\\n' + JSON.stringify(await resposta.json(), null, 2);
    } catch {
      const segundos = ((performance.now() - inicio) / 1000).toFixed(1);
      saida.textContent = 'Sem resposta depois de ' + segundos + ' s (o navegador desistiu ou a conexão caiu).';
    }
  }
  atualizar();
</script>
</body>
</html>
`;
