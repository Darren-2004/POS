import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemin absolu vers le fichier dev.db (détection intelligente root vs prisma/dev.db)
let dbPath = path.resolve(__dirname, 'dev.db');
const prismaDbPath = path.resolve(__dirname, 'prisma', 'dev.db');

// Si dev.db n'existe pas à la racine mais existe dans ./prisma/dev.db (créé par npx prisma db push)
if (!fs.existsSync(dbPath) && fs.existsSync(prismaDbPath)) {
  dbPath = prismaDbPath;
}

const adapter = new PrismaBetterSqlite3({
  url: `file:${dbPath}`
});

export const prisma = new PrismaClient({ adapter });
