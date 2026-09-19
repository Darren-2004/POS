import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, 'dev.db');
const BACKUPS_DIR = path.resolve(__dirname, 'backups');

/**
 * Effectue la sauvegarde de la base de données SQLite (dev.db).
 * @param {boolean} force - Force la création d'une sauvegarde même si la dernière date de moins de 4 jours
 */
export async function performDatabaseBackup(force = false) {
  try {
    if (!existsSync(BACKUPS_DIR)) {
      await fs.mkdir(BACKUPS_DIR, { recursive: true });
    }

    if (!existsSync(DB_PATH)) {
      console.log('⚠️ Fichier dev.db introuvable pour la sauvegarde.');
      return null;
    }

    const files = await fs.readdir(BACKUPS_DIR);
    const backupFiles = files
      .filter(f => f.startsWith('dev_backup_') && f.endsWith('.db'))
      .sort();

    const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    let shouldBackup = force || backupFiles.length === 0;

    if (!shouldBackup && backupFiles.length > 0) {
      const latestBackupFile = backupFiles[backupFiles.length - 1];
      const latestBackupPath = path.join(BACKUPS_DIR, latestBackupFile);
      const stats = await fs.stat(latestBackupPath);
      const elapsed = now - stats.mtimeMs;

      if (elapsed >= FOUR_DAYS_MS) {
        shouldBackup = true;
      }
    }

    if (!shouldBackup) {
      console.log('ℹ️ Sauvegarde BD non requise (dernière sauvegarde effectuée il y a moins de 4 jours).');
      return null;
    }

    // Format ISO propre pour le nom de fichier (ex: dev_backup_2026-09-19T13-00-00.db)
    const dateStr = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const backupName = `dev_backup_${dateStr}.db`;
    const destPath = path.join(BACKUPS_DIR, backupName);

    await fs.copyFile(DB_PATH, destPath);
    console.log(`✅ Base de données sauvegardée avec succès : backups/${backupName}`);

    // Garder les 10 plus récentes
    const updatedFiles = (await fs.readdir(BACKUPS_DIR))
      .filter(f => f.startsWith('dev_backup_') && f.endsWith('.db'))
      .sort();

    if (updatedFiles.length > 10) {
      const toDelete = updatedFiles.slice(0, updatedFiles.length - 10);
      for (const oldFile of toDelete) {
        await fs.unlink(path.join(BACKUPS_DIR, oldFile)).catch(() => {});
      }
    }

    return backupName;
  } catch (err) {
    console.error('❌ Erreur lors de la sauvegarde automatique :', err);
    return null;
  }
}

/**
 * Récupère la liste des sauvegardes existantes avec leurs métadonnées.
 */
export async function getBackupsList() {
  try {
    if (!existsSync(BACKUPS_DIR)) {
      return [];
    }
    const files = await fs.readdir(BACKUPS_DIR);
    const backupFiles = files.filter(f => f.startsWith('dev_backup_') && f.endsWith('.db'));

    const list = await Promise.all(
      backupFiles.map(async (filename) => {
        const filePath = path.join(BACKUPS_DIR, filename);
        const stats = await fs.stat(filePath);
        return {
          filename,
          sizeBytes: stats.size,
          sizeFormatted: `${(stats.size / 1024).toFixed(1)} KB`,
          createdAt: stats.mtime.toISOString()
        };
      })
    );

    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (err) {
    console.error('Erreur lecture liste sauvegardes:', err);
    return [];
  }
}

/**
 * Lance la vérification automatique toutes les 24h.
 */
export function scheduleAutomaticBackups() {
  // Première vérification au démarrage du serveur
  performDatabaseBackup();

  // Puis vérification automatique toutes les 24 heures
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    performDatabaseBackup();
  }, TWENTY_FOUR_HOURS);
}
