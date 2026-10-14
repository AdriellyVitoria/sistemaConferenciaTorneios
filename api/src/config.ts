import { z } from 'zod';

// Variáveis de ambiente validadas na subida: se faltar algo, a API para com uma mensagem clara.
// Os padrões servem para rodar fora do Docker, apontando para o MySQL do compose (porta 3307).
const esquema = z.object({
  API_PORTA: z.coerce.number().int().positive().default(3000),
  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(3307),
  MYSQL_DATABASE: z.string().min(1).default('torneios'),
  MYSQL_USER: z.string().min(1).default('torneios'),
  MYSQL_PASSWORD: z.string().min(1).default('torneios'),
});

export const config = esquema.parse(process.env);
