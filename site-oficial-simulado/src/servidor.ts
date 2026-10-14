import path from 'node:path';
import { criarApp } from './app';
import { carregarPartidas } from './dados';

// Por padrão (fora do Docker), lê os arquivos do próprio repositório; no Docker, SITE_ARQUIVOS
// aponta para os arquivos montados somente leitura.
const RAIZ = path.resolve(__dirname, '../..');
const ARQUIVOS_PADRAO = [
  path.join(RAIZ, 'testes/site-oficial.json'),
  path.join(RAIZ, 'api/test/fixtures/site-setembro.json'), // setembro com a #40923 da D15
];

const porta = Number(process.env.SITE_PORTA ?? 4000);
const arquivos = process.env.SITE_ARQUIVOS?.split(',').map((a) => a.trim()) ?? ARQUIVOS_PADRAO;

const partidas = carregarPartidas(arquivos);
const servidor = criarApp(partidas).listen(porta, () => {
  console.log(`Site oficial simulado ouvindo na porta ${porta}, com ${partidas.size} partidas`);
});

process.on('SIGTERM', () => servidor.close(() => process.exit(0)));
process.on('SIGINT', () => servidor.close(() => process.exit(0)));
