import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemin absolu vers le fichier dev.db (détection intelligente root vs prisma/dev.db)
let dbPath = path.resolve(__dirname, 'dev.db');
const prismaDbPath = path.resolve(__dirname, 'prisma', 'dev.db');

if (!fs.existsSync(dbPath) && fs.existsSync(prismaDbPath)) {
  dbPath = prismaDbPath;
}

// Nettoyage automatique des fichiers journal WAL si la BD a été collée manuellement
try {
  const walFile = `${dbPath}-wal`;
  const shmFile = `${dbPath}-shm`;
  if (fs.existsSync(walFile) || fs.existsSync(shmFile)) {
    try {
      execSync(`sqlite3 "${dbPath}" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null`);
    } catch (e) {
      // Ignorer si sqlite3 CLI n'est pas installé
    }
  }
} catch (e) {
  // Ignorer
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
