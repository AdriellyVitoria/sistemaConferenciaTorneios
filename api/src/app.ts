import express from 'express';
import { rotaSaude } from './rotas/saude';

export interface Dependencias {
  verificarBanco: () => Promise<void>;
}

// Monta o app sem abrir porta nem conexão: o servidor e os testes injetam o que precisam.
export function criarApp({ verificarBanco }: Dependencias) {
  const app = express();
  app.use(express.json());
  app.use(rotaSaude(verificarBanco));
  return app;
}
