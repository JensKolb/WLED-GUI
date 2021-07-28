const { app, BrowserWindow, Menu, Tray, ipcMain  } = require('electron')
const path = require('path')
const log = require('electron-log');

/* LOG LEVEL */
// log.transports.console.level = "error";
// log.transports.file.level = "error";
// log.transports.console.level = "warn";
// log.transports.file.level = "warn";
log.transports.console.level = "info";
log.transports.file.level = "info";
// log.transports.console.level = "verbose";
// log.transports.file.level = "verbose";
// log.transports.console.level = "debug";
// log.transports.file.level = "debug";
// log.transports.console.level = "silly";
// log.transports.file.level = "silly";

log.catchErrors();

log.info('WLED-GUI started');

log.debug("Start arguments:");
log.debug(process.argv);

const gotTheLock = app.requestSingleInstanceLock()
const autostarted = process.argv.indexOf('--hidden') !== -1;
const dev = process.argv.indexOf('--dev') !== -1;
const iconDir = getIconDir();
log.debug("iconDir: " + iconDir);

var win;
var tray;
var settings;

// Create the browser window.
function createWindow() {
  log.debug("Create browser window");
  win = new BrowserWindow({
    width: 1263,
    height: 900,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
      contextIsolation: false
    }
  })

  // and load the index.html of the app.
  win.loadFile('index.html')

  // remove menubar
  if (!dev) {
    win.removeMenu()
  }

  // Open the DevTools.
  // win.webContents.openDevTools()

  // check if app was autostarted
  if (autostarted) {
    log.verbose('App is started by AutoLaunch');
  }
  else {
    log.verbose('App is started by User');
    win.once('ready-to-show', () => {
      win.show()
    })
  }
}

// create hidden worker window
function createWorker() {
  log.debug("Create autostart worker window");
  const workerWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  // and load the autostart.html
  workerWindow.loadFile('autostart.html');
}

function createTrayMenu(appendMenu) {
  menuTemplate = appendMenu || [];

  menuTemplate = menuTemplate.concat([
    {
      label: 'Open', click: function () {
        win.show();
      }
    },
    {
      label: 'Hide', click: function () {
        win.hide();
      }
    },
    {
      label: 'Close', click: function () {
        log.debug("Close window via tray");
        win.close();
      }
    },
  ]);

  const contextMenu = Menu.buildFromTemplate(menuTemplate);
  tray.setContextMenu(contextMenu)
}

// tray
function createTray() {
  log.debug("Create tray icon");
  let iconFile;
  let iconPath;
  // tray icon for macOS
  if (process.platform === 'darwin' || process.platform === 'win32') {
    iconFile = "trayIcon.png";
  } else {
    iconFile = "icon.png";
  }
  iconPath = path.join(iconDir, iconFile);
  log.debug("Tray icon path: " + iconPath);
  tray = new Tray(iconPath)


  tray.setToolTip('WLED');
  createTrayMenu();

  tray.on('click', function () {
    win.show();
  });
}

ipcMain.on('updateTrayMenu', (event, lights) => {
  var presetMenu = [];
  for (let index = 0; index < lights.length; index++) {
    //console.log(lights[index].presets);
    if (lights[index].online) {
      presetMenu.push({
        label: lights[index].name,
        enabled: false,
      });

      // add brightness submenu
      presetMenu.push({
        label: 'Brightness: ' + (lights[index].on ? (Math.round(lights[index].brightness / 2.55) + '%') : 'OFF'),
        submenu: [
          { label: lights[index].on ? 'OFF' : 'ON',  click: () => win.webContents.send('set-on-off', lights[index].ip, 2)},
          { label: '20%', click: () => win.webContents.send('set-brightness', lights[index].ip, 51)},
          { label: '40%', click: () => win.webContents.send('set-brightness', lights[index].ip, 102)},
          { label: '60%', click: () => win.webContents.send('set-brightness', lights[index].ip, 153)},
          { label: '80%', click: () => win.webContents.send('set-brightness', lights[index].ip, 204)},
          { label: '100%',click: () => win.webContents.send('set-brightness', lights[index].ip, 255)},
        ]
      });

      // add presets menu
      if (lights[index].presets && lights[index].presets.length > 0) {
        lights[index].presets.forEach((preset, i) => {

          // only include presets with quickload label
          if (preset.icon) {
            presetMenu.push({
              label: (preset.icon ? (preset.icon + ' ') : '') + preset.name,
              type: "checkbox",
              checked: lights[index].preset == i,
              click: () => win.webContents.send('set-preset', lights[index].ip, i),
            });
            hasQuickloads = true;
          }
        });

        presetMenu.push({ type: 'separator' });
      }
    }
  }
  createTrayMenu(presetMenu);
})

// read settings from localstorage
function loadSettings() {
  log.debug("Load settings from localstorage");
  win.webContents.executeJavaScript('localStorage.getItem("settings");').then(result => {
    settings = JSON.parse(result);
    log.debug("Settings:");
    log.debug(settings);
    checkWorker();
    checkTray();
  });
}

function checkWorker() {
  if (autostarted) {
    createWorker();
  } else {
    if (settings !== null) {
      // start worker only if enabled
      if (!settings[2].value) {
        createWorker();
      }
    }
  }
}

function checkTray() {
  if (autostarted) {
    createTray();
  } else {
    if (settings !== null) {
      // show tray only if enabled
      if (settings[1].value) {
        createTray();
      }
    }
  }
}

function getIconDir() {
  const installPath = path.dirname(app.getPath("exe"));
  log.debug("installPath: " + installPath);
  let dir;
  if (dev) {
    dir = "build/";
  } else if (process.platform === 'darwin') {
    dir = path.join(installPath, "../", "build");
  }
  else {
    dir = path.join(installPath, "build");
  }
  return dir;
}

// check if second instance was started
if (!gotTheLock) {
  log.info('WLED-GUI quitted');
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (win) {
      log.info('Someone tried to run a second instance. Focus our main window');
      win.show()
    }
  })

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(createWindow)
  app.whenReady().then(loadSettings)

  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on('window-all-closed', () => {
    log.debug("All windows are closed");
    if (process.platform === 'darwin') {
      if (settings !== null) {
        if (settings[1].value) {
          tray.destroy();
        }
      }
      log.info('WLED-GUI closed');
    } else {
      log.info('WLED-GUI quitted');
      app.quit();
    }
  })

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
