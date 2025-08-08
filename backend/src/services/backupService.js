const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const db = require('../db/connection');

class BackupService {
  constructor() {
    this.backupDir = path.join(__dirname, '../../backups');
    this.ensureBackupDirectory();
  }

  async ensureBackupDirectory() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create backup directory:', error);
    }
  }

  /**
   * Create a full database backup
   */
  async createBackup(type = 'manual', userId = 'system') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `backup_${type}_${timestamp}`;
      const fileName = `${backupName}.sql`;
      const filePath = path.join(this.backupDir, fileName);

      // Get database connection details from environment
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        throw new Error('DATABASE_URL not configured');
      }

      // Parse database URL
      const urlParts = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
      if (!urlParts) {
        throw new Error('Invalid DATABASE_URL format');
      }

      const [, user, password, host, port, database] = urlParts;

      // Create pg_dump command
      const dumpCommand = `PGPASSWORD=${password} pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -f ${filePath}`;

      // Execute backup
      console.log(`Creating backup: ${backupName}`);
      await execAsync(dumpCommand);

      // Get file stats
      const stats = await fs.stat(filePath);

      // Get table list and record counts
      const tables = await db.getMany(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      `);

      let totalRecords = 0;
      const tableNames = [];
      for (const table of tables) {
        const count = await db.getOne(`SELECT COUNT(*) as count FROM ${table.table_name}`);
        totalRecords += parseInt(count.count);
        tableNames.push(table.table_name);
      }

      // Save backup metadata to database
      const backupRecord = await db.insert('backups', {
        backup_name: backupName,
        backup_type: type,
        file_path: filePath,
        size_bytes: stats.size,
        tables_included: tableNames,
        record_count: totalRecords,
        created_by: userId,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      });

      console.log(`Backup created successfully: ${backupName}`);

      return {
        success: true,
        backupId: backupRecord.id,
        backupName,
        filePath,
        sizeBytes: stats.size,
        recordCount: totalRecords
      };
    } catch (error) {
      console.error('Backup creation failed:', error);
      throw error;
    }
  }

  /**
   * Restore from a backup
   */
  async restoreBackup(backupId) {
    try {
      // Get backup metadata
      const backup = await db.getOne('SELECT * FROM backups WHERE id = $1', [backupId]);
      if (!backup) {
        throw new Error('Backup not found');
      }

      // Check if backup file exists
      await fs.access(backup.file_path);

      // Create a safety backup first
      console.log('Creating safety backup before restore...');
      await this.createBackup('pre-restore', 'system');

      // Get database connection details
      const dbUrl = process.env.DATABASE_URL;
      const urlParts = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
      const [, user, password, host, port, database] = urlParts;

      // Drop and recreate database (BE VERY CAREFUL!)
      console.log(`Restoring from backup: ${backup.backup_name}`);
      
      // Note: This is a simplified version. In production, you'd want more safety checks
      const restoreCommand = `PGPASSWORD=${password} psql -h ${host} -p ${port} -U ${user} -d ${database} -f ${backup.file_path}`;
      
      await execAsync(restoreCommand);

      console.log('Restore completed successfully');

      // Log the restore
      await db.insert('audit_log', {
        table_name: 'system',
        record_id: backupId,
        action: 'RESTORE',
        new_values: { backup_id: backupId, backup_name: backup.backup_name },
        created_at: new Date()
      });

      return {
        success: true,
        message: `Database restored from backup: ${backup.backup_name}`
      };
    } catch (error) {
      console.error('Restore failed:', error);
      throw error;
    }
  }

  /**
   * List available backups
   */
  async listBackups() {
    try {
      const backups = await db.getMany(`
        SELECT * FROM backups 
        WHERE expires_at > NOW() 
        ORDER BY created_at DESC
      `);

      // Check which files actually exist
      for (const backup of backups) {
        try {
          await fs.access(backup.file_path);
          backup.file_exists = true;
        } catch {
          backup.file_exists = false;
        }
      }

      return backups;
    } catch (error) {
      console.error('Failed to list backups:', error);
      throw error;
    }
  }

  /**
   * Delete old backups
   */
  async cleanupOldBackups() {
    try {
      const expiredBackups = await db.getMany(`
        SELECT * FROM backups 
        WHERE expires_at < NOW()
      `);

      for (const backup of expiredBackups) {
        try {
          await fs.unlink(backup.file_path);
          console.log(`Deleted expired backup: ${backup.backup_name}`);
        } catch (error) {
          console.error(`Failed to delete backup file: ${backup.file_path}`, error);
        }
      }

      // Remove from database
      await db.query('DELETE FROM backups WHERE expires_at < NOW()');

      return {
        success: true,
        deletedCount: expiredBackups.length
      };
    } catch (error) {
      console.error('Cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Create automated daily backup
   */
  async createDailyBackup() {
    try {
      // Check if we already have a backup today
      const today = new Date().toISOString().split('T')[0];
      const existingBackup = await db.getOne(`
        SELECT id FROM backups 
        WHERE backup_type = 'daily' 
        AND DATE(created_at) = $1
      `, [today]);

      if (existingBackup) {
        console.log('Daily backup already exists for today');
        return { success: true, message: 'Daily backup already exists' };
      }

      // Create the backup
      const result = await this.createBackup('daily', 'scheduler');
      
      // Cleanup old daily backups (keep last 7)
      const oldDailyBackups = await db.getMany(`
        SELECT * FROM backups 
        WHERE backup_type = 'daily' 
        ORDER BY created_at DESC 
        OFFSET 7
      `);

      for (const oldBackup of oldDailyBackups) {
        try {
          await fs.unlink(oldBackup.file_path);
          await db.query('DELETE FROM backups WHERE id = $1', [oldBackup.id]);
        } catch (error) {
          console.error(`Failed to delete old daily backup: ${oldBackup.backup_name}`, error);
        }
      }

      return result;
    } catch (error) {
      console.error('Daily backup failed:', error);
      throw error;
    }
  }
}

module.exports = new BackupService();