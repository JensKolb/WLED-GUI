const { ipcRenderer } = require('electron')
const log = require('electron-log');
log.transports.console.level = "info";
log.transports.file.level = "info";
log.catchErrors();

document.getElementById("logo").addEventListener("click", openRepositorie);
// the imgClicked variable prevents the goToWled() function from beeing triggerd when clicking in a button
var imgClicked = false;

// Light mode
if (localStorage.getItem("wledUiCfg") === null) {
    var ui = {
        theme: {
            base: "dark"
        }
    };
} else {
    var ui = JSON.parse(localStorage.getItem("wledUiCfg"));
    if (ui.theme.base == "light") {
        document.body.style.backgroundColor = "#eee";
        document.body.style.color = "black";
    }
}

// create json
if (localStorage.getItem("lights") === null) {
    log.verbose("No local storage item found. Creating one...");
    var lights = [];
    json = JSON.stringify(lights);
    localStorage.setItem("lights", json);
}

// Default PC Mode on
if (localStorage.getItem("pcm") === null) {
    localStorage.setItem("pcm", true);
}

// Opens Github page in default browser
function openRepositorie() {
    const { shell } = require('electron')
    shell.openExternal('https://github.com/Aircoookie/WLED')
}

// Opens the latest release of WLED-GUI in default browser
function openRelease() {
    const { shell } = require('electron')
    shell.openExternal('https://github.com/WoodyLetsCode/WLED-GUI/releases/latest')
}

// Shows all Lighs in main page
function showLights() {
    if (!document.getElementById("lights")) {
      return;
    }
    var lights = JSON.parse(localStorage.getItem("lights"));
    var txt = "";
    var oldTxt = document.getElementById("lights").innerHTML;
    for (let index = 0; index < lights.length; index++) {
        const element = lights[index];
        txt += "<div class=\"light\" onclick=\"goToWled(" + index + ")\" style=\"cursor: pointer;\">\n<br>\n";
        // Light mode
        if (ui.theme.base == "light") {
            txt += "<img src=\"images/icon_power.png\" id=\"img" + index + "\" class=\"darkicon ";
        }
        else {
            txt += "<img src=\"images/icon_power.png\" id=\"img" + index + "\" class=\"icon ";
        }
        if (element.on === true) {
            txt += "on";
        }
        txt += "\" onclick=\"toggleLight(" + index + ");\" height=\"75\">\n";
        txt += "<h5>" + element.name + "</h5>\n" + element.ip;
        if (element.online === false) {
            txt += " (Offline)\n";
        }
        txt += "<br><br></div><hr>";
    }
    if (txt !== oldTxt) {
        document.getElementById("lights").innerHTML = txt;
    }
}

// Shows all Lighs in delete page
function showLightsDel() {
    var lights = JSON.parse(localStorage.getItem("lights"));
    var txt = "";
    for (let index = 0; index < lights.length; index++) {
        const element = lights[index];
        txt += "<div class=\"light\">\n<br>\n";
        txt += "<img src=\"images/icon_delete.png\" onclick=\"del(" + index + ")\" class=\"icon del\" height=75>\n";
        txt += "<h5>" + element.name + "</h5>\n" + element.ip;
        if (element.online === false) {
            txt += " (Offline)\n";
        }
        txt += "<br><br></div><hr>";
    }
    document.getElementById("lights").innerHTML = txt;
}

// get the status of lights
// check if on or off and connection to them
// update tray menu
function getStatus() {
    var lights = JSON.parse(localStorage.getItem("lights"));
    for (let index = 0; index < lights.length; index++) {
        const ip = lights[index].ip;

        let xhr = new XMLHttpRequest();
        xhr.open('GET', 'http://' + ip + "/json", true);
        xhr.onload = function () {
            var json = JSON.parse(xhr.response);
            lights[index].online = true;
            lights[index].on = json.state.on;
            lights[index].version = json.info.ver;
            lights[index].preset = json.state.ps;
            lights[index].brightness = json.state.bri;
            localStorage.setItem("lights", JSON.stringify(lights));
            showLights();
            ipcRenderer.send('update-tray-menu', lights);
        };
        xhr.onerror = function () {
            lights[index].online = false;
            localStorage.setItem("lights", JSON.stringify(lights));
            showLights();
            ipcRenderer.send('update-tray-menu', lights);
        }
        xhr.send();
    }
}

// get the available presets of lights
// update tray menu
function getPresets() {
    var lights = JSON.parse(localStorage.getItem("lights"));
    for (let index = 0; index < lights.length; index++) {
        const ip = lights[index].ip;

        let xhr = new XMLHttpRequest();
        xhr.open('GET', 'http://' + ip + "/presets.json", true);
        xhr.onload = function () {
            var json = JSON.parse(xhr.response);
            lights[index].presets = Object.values(json).map((preset, index) => {
              return {
              name: preset.n,
              icon: preset.ql
            }});
            localStorage.setItem("lights", JSON.stringify(lights));

            ipcRenderer.send('update-tray-menu', lights);
        };
        xhr.onerror = function () {
        }
        xhr.send();
    }
}

// listener for main thread call to set brightness
ipcRenderer.on('set-brightness', (event, ip, br) => {
  let xhr = new XMLHttpRequest();
  xhr.open('GET', 'http://' + ip + "/win&A=" + br, true);
  xhr.onload = function () {
    getStatus();
  };
  xhr.send();
});

// listener for main thread call to set preset
ipcRenderer.on('set-preset', (event, ip, ps) => {
  let xhr = new XMLHttpRequest();
  xhr.open('GET', 'http://' + ip + "/win&PL=" + ps, true);
  xhr.onload = function () {
    getStatus();
  };
  xhr.send();
});

// listener for main thread call to set on/off (0=Off, 1=On, 2=Toggle)
ipcRenderer.on('set-on-off', (event, ip, onOff) => {
  let xhr = new XMLHttpRequest();
  xhr.open('GET', 'http://' + ip + "/win&T=" + onOff, true);
  xhr.onload = function () {
    getStatus();
  };
  xhr.send();
});

// opens the WLED page and set the correct ip address to localstorage
function goToWled(index) {
    // doesent trigger when a button is clicked
    if (imgClicked !== true) {
        var lights = JSON.parse(localStorage.getItem("lights"));
        var ip = lights[index].ip;
        var version = lights[index].version;
        var onlineMode = lights[index].onlineMode;
        localStorage.setItem("locIp", ip);
        localStorage.setItem("locVersion", version);
        localStorage.setItem("onlineMode", onlineMode);
        location.href = "wled-viewer.html";
    }
}

// toggels the light
function toggleLight(index) {
    imgClicked = true;
    var lights = JSON.parse(localStorage.getItem("lights"));
    var ip = lights[index].ip;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'http://' + ip + "/win&T=2", true);
    xhr.onload = function () {
        imgClicked = false;
        getStatus();
    };
    xhr.send();
}

// deletes a light from localstorage
function del(index) {
    var lights = JSON.parse(localStorage.getItem("lights"));
    lights.splice(index, 1);
    localStorage.setItem("lights", JSON.stringify(lights));
    showLightsDel();
}

// set remind later time
function remindLater() {
    localStorage.setItem('remindLaterTime', Date.now());
}

// continuous sync to keep the status up to date
if (typeof syncRunning === 'undefined' || syncRunning === null) {
  var syncRunning = false;
}
function startSync() {
  if (syncRunning !== false) {
    log.warn('%cSYNC ALREADY RUNNING!');
    return;
  }

  syncRunning = true;
  let syncCount = 4;

  function sync(){
    syncCount++;

    if (syncCount > 4) {
      syncCount = 0;
      getPresets();
    } else {
      getStatus();
    }

    setTimeout(sync, 1000);
  }
  sync();
}
