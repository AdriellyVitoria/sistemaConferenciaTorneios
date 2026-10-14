import express from 'express';

// Esqueleto do site oficial simulado. As partidas, a demora e as falhas entram na etapa 2.
const porta = Number(process.env.SITE_PORTA ?? 4000);
const app = express();

app.get('/saude', (_req, res) => {
  res.json({ site: 'ok' });
});

const servidor = app.listen(porta, () => {
  console.log(`Site oficial simulado ouvindo na porta ${porta}`);
});

process.on('SIGTERM', () => servidor.close(() => process.exit(0)));
process.on('SIGINT', () => servidor.close(() => process.exit(0)));
