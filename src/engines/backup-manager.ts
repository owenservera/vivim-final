// src/engines/backup-manager.ts
// BackupManager — manages database backups before migrations

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { getLogger } from '../lib/logger.js'

const log = getLogger('backup-manager')

export interface BackupManagerConfig {
  backupDir: string
  maxBackups: number
}

export class BackupManager {
  constructor(
    private config: BackupManagerConfig = {
      backupDir: '.backups',
      maxBackups: 10,
    },
  ) {
    // Ensure backup directory exists
    if (!existsSync(config.backupDir)) {
      mkdirSync(config.backupDir, { recursive: true })
    }
  }

  async createBackup(
    dbPath: string,
    reason: string,
  ): Promise<{ backupPath: string; sizeBytes: number }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupName = `vivim-backup-${timestamp}-${reason}.db`
    const backupPath = join(this.config.backupDir, backupName)

    log.info('Creating backup')

    try {
      copyFileSync(dbPath, backupPath)
      const stats = statSync(backupPath)

      log.info('Backup created')

      // Clean up old backups
      await this.cleanupOldBackups()

      return { backupPath, sizeBytes: stats.size }
    } catch (err) {
      log.error({ err }, 'Backup creation failed')
      throw err
    }
  }

  async cleanupOldBackups(): Promise<void> {
    const files = readdirSync(this.config.backupDir)
    const backupFiles = files
      .filter((f) => f.startsWith('vivim-backup-') && f.endsWith('.db'))
      .map((f) => ({
        name: f,
        path: join(this.config.backupDir, f),
        mtime: statSync(join(this.config.backupDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime) // Sort by mtime descending (newest first)

    if (backupFiles.length > this.config.maxBackups) {
      const toDelete = backupFiles.slice(this.config.maxBackups)
      for (const file of toDelete) {
        try {
          unlinkSync(file.path)
          log.info('Deleted old backup')
        } catch (err) {
          log.warn({ err, file: file.name }, 'Failed to delete old backup')
        }
      }
    }
  }

  async listBackups(): Promise<
    Array<{ name: string; path: string; sizeBytes: number; mtime: number }>
  > {
    const files = readdirSync(this.config.backupDir)
    return files
      .filter((f) => f.startsWith('vivim-backup-') && f.endsWith('.db'))
      .map((f) => {
        const path = join(this.config.backupDir, f)
        const stats = statSync(path)
        return {
          name: f,
          path,
          sizeBytes: stats.size,
          mtime: stats.mtimeMs,
        }
      })
      .sort((a, b) => b.mtime - a.mtime)
  }

  async restoreBackup(backupPath: string, targetPath: string): Promise<void> {
    log.info('Restoring backup')

    try {
      copyFileSync(backupPath, targetPath)
      log.info('Backup restored')
    } catch (err) {
      log.error({ err }, 'Backup restoration failed')
      throw err
    }
  }

  async deleteBackup(backupPath: string): Promise<void> {
    log.info('Deleting backup')

    try {
      unlinkSync(backupPath)
      log.info('Backup deleted')
    } catch (err) {
      log.error({ err }, 'Backup deletion failed')
      throw err
    }
  }

  getBackupPath(reason: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupName = `vivim-backup-${timestamp}-${reason}.db`
    return join(this.config.backupDir, backupName)
  }
}
