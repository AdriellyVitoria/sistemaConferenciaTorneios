import { criarApp } from './app';
import { db } from './banco/conexao';
import { config } from './config';
import { iniciarJob } from './conferencia/job';
import { criarClienteSiteOficial } from './conferencia/site-oficial';

async function main() {
  // aplica as migrations pendentes antes de aceitar requisições
  const [, aplicadas] = await db.migrate.latest();
  if (aplicadas.length) console.log(`Migrations aplicadas: ${aplicadas.join(', ')}`);

  const app = criarApp({ bd: db, verificarBanco: async () => { await db.raw('select 1'); } });
  const servidor = app.listen(config.API_PORTA, () => {
    console.log(`API ouvindo na porta ${config.API_PORTA}`);
  });

  // a conferência em segundo plano roda no mesmo processo (etapa 4b)
  const job = iniciarJob({
    bd: db,
    site: criarClienteSiteOficial({ urlBase: config.SITE_URL, tempoLimiteMs: config.SITE_TEMPO_LIMITE_MS }),
    intervalosMs: config.CONFERENCIA_INTERVALOS_MS,
    lote: config.CONFERENCIA_LOTE,
    presaAposMs: config.CONFERENCIA_PRESA_APOS_MS,
    acordarACadaMs: config.CONFERENCIA_ACORDAR_A_CADA_MS,
  });
  console.log(`Conferência ligada: consulta ${config.SITE_URL}, a cada ${config.CONFERENCIA_ACORDAR_A_CADA_MS} ms`);

  // ao encerrar, espera a rodada em andamento gravar o que já consultou; o que não terminar
  // fica "em_consulta" e é recuperado na próxima subida
  const encerrar = () => {
    servidor.close(() => job.parar().finally(() => db.destroy().finally(() => process.exit(0))));
  };
  process.on('SIGTERM', encerrar);
  process.on('SIGINT', encerrar);
}

main().catch(async (erro) => {
  console.error('Falha ao subir a API:', erro);
  await db.destroy();
  process.exit(1);
});
