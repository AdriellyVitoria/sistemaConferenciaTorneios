import { criarApp } from './app';
import { db } from './banco/conexao';
import { config } from './config';

async function main() {
  // aplica as migrations pendentes antes de aceitar requisições
  const [, aplicadas] = await db.migrate.latest();
  if (aplicadas.length) console.log(`Migrations aplicadas: ${aplicadas.join(', ')}`);

  const app = criarApp({ bd: db, verificarBanco: async () => { await db.raw('select 1'); } });
  const servidor = app.listen(config.API_PORTA, () => {
    console.log(`API ouvindo na porta ${config.API_PORTA}`);
  });

  const encerrar = () => {
    servidor.close(() => db.destroy().finally(() => process.exit(0)));
  };
  process.on('SIGTERM', encerrar);
  process.on('SIGINT', encerrar);
}

main().catch(async (erro) => {
  console.error('Falha ao subir a API:', erro);
  await db.destroy();
  process.exit(1);
});
