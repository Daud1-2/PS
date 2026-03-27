const { app } = require('electron');
const { autoUpdater } = require('electron-updater');
const { logError, logInfo, logWarn } = require('./logger');

let initialized = false;
let state = {
  status: 'idle',
  currentVersion: app.getVersion(),
  availableVersion: null,
  downloadedVersion: null,
  progressPercent: 0,
  bytesPerSecond: 0,
  transferred: 0,
  total: 0,
  message: 'Updates are ready to check.'
};
let getMainWindow = () => null;
let checkPromise = null;

function getUpdateState() {
  return { ...state };
}

function emitState() {
  const mainWindow = getMainWindow?.();

  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('updates:state-changed', getUpdateState());
}

function setState(patch) {
  state = {
    ...state,
    ...patch
  };

  emitState();
}

function buildStatusMessage(status, details = {}) {
  if (status === 'disabled') {
    return 'Install this app build first to receive updates here.';
  }

  if (status === 'checking') {
    return 'Checking for updates...';
  }

  if (status === 'available') {
    return `Update ${details.availableVersion || ''} found. Downloading now...`.trim();
  }

  if (status === 'downloading') {
    const percent = Number(details.progressPercent || 0);
    return `Downloading update... ${percent.toFixed(0)}%`;
  }

  if (status === 'downloaded') {
    return `Update ${details.downloadedVersion || ''} is ready to install.`;
  }

  if (status === 'up-to-date') {
    return 'This app is already up to date.';
  }

  if (status === 'error') {
    return details.message || 'Update check failed.';
  }

  return 'Updates are ready to check.';
}

function attachUpdaterListeners() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on('checking-for-update', () => {
    logInfo('Checking for application updates.');
    setState({
      status: 'checking',
      progressPercent: 0,
      bytesPerSecond: 0,
      transferred: 0,
      total: 0,
      message: buildStatusMessage('checking')
    });
  });

  autoUpdater.on('update-available', (info) => {
    logInfo('Application update available.', info);
    setState({
      status: 'available',
      availableVersion: info?.version || null,
      progressPercent: 0,
      message: buildStatusMessage('available', {
        availableVersion: info?.version || null
      })
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    setState({
      status: 'downloading',
      progressPercent: Number(progress?.percent || 0),
      bytesPerSecond: Number(progress?.bytesPerSecond || 0),
      transferred: Number(progress?.transferred || 0),
      total: Number(progress?.total || 0),
      message: buildStatusMessage('downloading', {
        progressPercent: Number(progress?.percent || 0)
      })
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    logInfo('Application is already up to date.', info);
    setState({
      status: 'up-to-date',
      availableVersion: info?.version || null,
      downloadedVersion: null,
      progressPercent: 100,
      message: buildStatusMessage('up-to-date')
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    logInfo('Application update downloaded.', info);
    setState({
      status: 'downloaded',
      downloadedVersion: info?.version || null,
      progressPercent: 100,
      message: buildStatusMessage('downloaded', {
        downloadedVersion: info?.version || null
      })
    });
  });

  autoUpdater.on('error', (error) => {
    logError('Application update failed.', error);
    setState({
      status: 'error',
      progressPercent: 0,
      message: buildStatusMessage('error', {
        message: error?.message || 'Update check failed.'
      })
    });
  });
}

function initializeUpdateService(windowGetter) {
  if (initialized) {
    return;
  }

  initialized = true;
  getMainWindow = windowGetter;

  if (!app.isPackaged) {
    setState({
      status: 'disabled',
      message: buildStatusMessage('disabled')
    });
    return;
  }

  attachUpdaterListeners();
}

async function checkForUpdates({ manual = false } = {}) {
  if (!app.isPackaged) {
    setState({
      status: 'disabled',
      message: buildStatusMessage('disabled')
    });
    return getUpdateState();
  }

  if (checkPromise) {
    return checkPromise;
  }

  checkPromise = autoUpdater
    .checkForUpdates()
    .then(() => {
      if (manual && state.status === 'idle') {
        setState({
          status: 'up-to-date',
          progressPercent: 100,
          message: buildStatusMessage('up-to-date')
        });
      }

      return getUpdateState();
    })
    .catch((error) => {
      logError('Manual update check failed.', error);
      setState({
        status: 'error',
        progressPercent: 0,
        message: buildStatusMessage('error', {
          message: error?.message || 'Update check failed.'
        })
      });
      return getUpdateState();
    })
    .finally(() => {
      checkPromise = null;
    });

  return checkPromise;
}

async function installDownloadedUpdate() {
  if (!app.isPackaged) {
    throw new Error('Updates can only be installed from the packaged app.');
  }

  if (state.status !== 'downloaded') {
    throw new Error('No downloaded update is ready to install.');
  }

  logInfo('Installing downloaded application update.', {
    version: state.downloadedVersion
  });

  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true);
  });

  return {
    installing: true
  };
}

module.exports = {
  initializeUpdateService,
  getUpdateState,
  checkForUpdates,
  installDownloadedUpdate
};
