import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemin absolu vers le fichier dev.db
const dbPath = path.resolve(__dirname, 'dev.db');

const adapter = new PrismaBetterSqlite3({
  url: `file:${dbPath}`
});

export const prisma = new PrismaClient({ adapter });
