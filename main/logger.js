const fs = require('fs');
const os = require('os');
const path = require('path');

function getElectronApp() {
  try {
    return require('electron').app;
  } catch (_error) {
    return null;
  }
}

function getLogsDirectory() {
  const electronApp = getElectronApp();

  if (electronApp && electronApp.isReady()) {
    return path.join(electronApp.getPath('userData'), 'logs');
  }

  return path.join(os.tmpdir(), 'grocery-pos-logs');
}

function getLogFilePath() {
  return path.join(getLogsDirectory(), 'error.log');
}

function ensureLogFile() {
  const filePath = getLogFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', 'utf8');
  }

  return filePath;
}

function serializeMetadata(metadata) {
  if (!metadata) {
    return '';
  }

  if (metadata instanceof Error) {
    return `${metadata.name}: ${metadata.message}\n${metadata.stack || ''}`.trim();
  }

  if (typeof metadata === 'object') {
    try {
      return JSON.stringify(metadata);
    } catch (_error) {
      return String(metadata);
    }
  }

  return String(metadata);
}

function mirrorToConsole(level, message, metadata) {
  const electronApp = getElectronApp();
  const isPackaged = electronApp ? electronApp.isPackaged : false;

  if (isPackaged) {
    return;
  }

  const logger =
    level === 'ERROR'
      ? console.error
      : level === 'WARN'
        ? console.warn
        : console.log;

  try {
    if (metadata) {
      logger(message, metadata);
    } else {
      logger(message);
    }
  } catch (_error) {
    // Ignore broken stdio in detached sessions.
  }
}

function writeLog(level, message, metadata) {
  const timestamp = new Date().toISOString();
  const details = serializeMetadata(metadata);
  const line = `[${timestamp}] [${level}] ${message}${
    details ? ` | ${details}` : ''
  }\n`;

  try {
    fs.appendFileSync(ensureLogFile(), line, 'utf8');
  } catch (_error) {
    // Ignore file write failures to avoid crashing the app while logging.
  }

  mirrorToConsole(level, message, metadata);
}

function logInfo(message, metadata) {
  writeLog('INFO', message, metadata);
}

function logWarn(message, metadata) {
  writeLog('WARN', message, metadata);
}

function logError(message, metadata) {
  writeLog('ERROR', message, metadata);
}

module.exports = {
  getLogFilePath,
  logInfo,
  logWarn,
  logError
};
