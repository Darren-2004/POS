import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemin absolu vers le fichier dev.db (détection intelligente root vs prisma/dev.db)
let dbPath = path.resolve(__dirname, 'dev.db');
const prismaDbPath = path.resolve(__dirname, 'prisma', 'dev.db');

if (!fs.existsSync(dbPath) && fs.existsSync(prismaDbPath)) {
  dbPath = prismaDbPath;
}

let prismaInstance;

try {
  const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3');
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  prismaInstance = new PrismaClient({ adapter });
} catch (err) {
  console.warn('⚠️ Fallback vers PrismaClient standard:', err.message);
  prismaInstance = new PrismaClient({
    datasources: {
      db: {
        url: `file:${dbPath}`
      }
    }
  });
}

export const prisma = prismaInstance;
