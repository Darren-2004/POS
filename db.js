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

// ─────────────────────────────────────────────────────────────────────────────
// Nettoyage WAL : si la BD a été copiée manuellement avec ses fichiers WAL/SHM
// orphelins, on doit les fusionner ou les supprimer avant d'ouvrir Prisma.
// ─────────────────────────────────────────────────────────────────────────────
const walFile = `${dbPath}-wal`;
const shmFile = `${dbPath}-shm`;

if (fs.existsSync(walFile) || fs.existsSync(shmFile)) {
  console.log('⚠️  Fichiers WAL/SHM détectés — tentative de nettoyage...');
  let cleaned = false;

  // Méthode 1 : better-sqlite3 (disponible dans le projet)
  try {
    const { default: Database } = await import('better-sqlite3');
    const db = new Database(dbPath);
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
    console.log('✅ Checkpoint WAL réussi via better-sqlite3.');
    cleaned = true;
  } catch (e) {
    console.warn('⚠️  better-sqlite3 checkpoint échoué:', e.message);
  }

  // Méthode 2 : sqlite3 CLI
  if (!cleaned) {
    try {
      execSync(`sqlite3 "${dbPath}" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null`);
      console.log('✅ Checkpoint WAL réussi via sqlite3 CLI.');
      cleaned = true;
    } catch (e) {
      console.warn('⚠️  sqlite3 CLI checkpoint échoué:', e.message);
    }
  }

  // Méthode 3 (dernier recours) : supprimer les fichiers WAL/SHM orphelins
  if (!cleaned) {
    try {
      if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
      if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);
      console.log('✅ Fichiers WAL/SHM orphelins supprimés (dernier recours).');
    } catch (e) {
      console.error('❌ Impossible de supprimer les fichiers WAL/SHM:', e.message);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialisation de Prisma
// ─────────────────────────────────────────────────────────────────────────────
let prismaInstance;

try {
  const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3');
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  prismaInstance = new PrismaClient({ adapter });
  console.log('✅ Prisma initialisé avec better-sqlite3 adapter.');
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
