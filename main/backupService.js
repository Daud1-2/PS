const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { getDatabase, getDatabasePath } = require('../database/db');
const { logInfo, logError } = require('./logger');

const DAILY_BACKUP_CHECK_MS = 60 * 60 * 1000;
let backupInterval = null;

function getBackupsDirectory() {
  return path.join(app.getPath('userData'), 'backups');
}

function formatDateStamp(date) {
  return date.toISOString().slice(0, 10);
}

function formatTimestampStamp(date) {
  return date.toISOString().replace(/[:]/g, '-').replace(/\..+$/, '');
}

async function runBackup(destinationPath) {
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  await getDatabase().backup(destinationPath);

  return {
    path: destinationPath,
    createdAt: new Date().toISOString()
  };
}

async function createManualBackup() {
  const timestamp = formatTimestampStamp(new Date());
  const destinationPath = path.join(
    getBackupsDirectory(),
    `offline-pos-manual-${timestamp}.sqlite`
  );
  const backup = await runBackup(destinationPath);

  logInfo('Backup service: manual backup created.', {
    path: backup.path
  });
  return {
    ...backup,
    mode: 'manual'
  };
}

async function ensureDailyBackup() {
  const today = formatDateStamp(new Date());
  const destinationPath = path.join(
    getBackupsDirectory(),
    `offline-pos-auto-${today}.sqlite`
  );

  if (fs.existsSync(destinationPath)) {
    return {
      path: destinationPath,
      createdAt: new Date().toISOString(),
      mode: 'auto',
      skipped: true
    };
  }

  const backup = await runBackup(destinationPath);
  logInfo('Backup service: daily backup created.', {
    path: backup.path
  });

  return {
    ...backup,
    mode: 'auto',
    skipped: false
  };
}

function startBackupService() {
  if (backupInterval) {
    clearInterval(backupInterval);
  }

  setTimeout(() => {
    ensureDailyBackup().catch((error) => {
      logError('Backup service failure.', error);
    });
  }, 3000);

  backupInterval = setInterval(() => {
    ensureDailyBackup().catch((error) => {
      logError('Backup service failure.', error);
    });
  }, DAILY_BACKUP_CHECK_MS);
}

function stopBackupService() {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
  }
}

function getBackupStatus() {
  return {
    databasePath: getDatabasePath(),
    backupsDirectory: getBackupsDirectory()
  };
}

module.exports = {
  startBackupService,
  stopBackupService,
  ensureDailyBackup,
  createManualBackup,
  getBackupStatus
};
