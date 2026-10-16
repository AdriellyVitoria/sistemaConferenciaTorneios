import { db } from './conexao';

async function main() {
  const [lote, aplicadas] = await db.migrate.latest();
  console.log(aplicadas.length ? `Lote ${lote}: ${aplicadas.join(', ')}` : 'Banco já está atualizado');
  await db.destroy();
}

main().catch(async (erro) => {
  console.error('Falha ao migrar:', erro);
  await db.destroy();
  process.exit(1);
});
