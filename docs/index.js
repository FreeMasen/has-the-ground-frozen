
/**@type HTMLDivElement */
const ANS = document.getElementById("answer");
/**@type HTMLSummaryElement */
const OL_TITLE = document.getElementById("observations-title");
/**@type HTMLOLElement */
const OL = document.getElementById("observations");
/**@type HTMLInputElement */
const ZIPS = document.getElementById("zipcode");
/**@type HTMLButtonElement */
const CHECK_BTN = document.getElementById("check-now");

const ZIP_KEY = "saved-zip-code";

const YES_CLASS = "yes";
const NO_CLASS = "no";
const ERROR_CLASS = "error";


import { ZIP_CODES } from "./zipCodes.js"

ZIPS.addEventListener("change", lookupAnswer);
CHECK_BTN.addEventListener("click", lookupAnswer);

async function lookupAnswer() {
    let latLong = getLatLong();
    let stationId = await getStationId(latLong);
    if (!stationId) {
        return;
    }
    await getObservations(stationId);
}

function getLatLong() {
    let selected = ZIPS.value;
    if (!selected || selected == "") {
        return;
    }
    let zip = ZIP_CODES[selected.trim()];
    if (!zip) {
        return console.warn("Unknown zip code", zip)
    }
    localStorage.setItem(ZIP_KEY, selected.trim());
    return `${zip.lat},${zip.long}`;
}


function calculateDateRange() {
    let end = new Date();
    let start = new Date();
    start.setDate(start.getDate() - 5);
    return {
        start: start.toISOString(),
        end: end.toISOString()
    }
}

async function getStationId(latLong) {
    latLong = latLong || getLatLong();
    if (!latLong) {
        return console.warn("No lat long found");
    }
    let pointsRes = await fetch(encodeURI(`https://api.weather.gov/points/${latLong}`));
    if (!pointsRes.ok) {
        return console.error("Bad response to points", await pointsRes.text())
    }
    let info = await pointsRes.json();
    
    let nextUrl = info.properties?.observationStations;
    if (!nextUrl) {
        console.warn("No observationStations for points", latLong, info);
    }
    let stationsRes = await fetch(nextUrl);
    if (!stationsRes.ok) {
        return console.error("Bad response to observationStations", await stationsRes.text())
    }
    let gridStations = await stationsRes.json();
    let station = gridStations?.features[0]?.properties?.stationIdentifier;
    if (!station) {
        console.warn("No grid station found: ", gridStations);
    }
    return station;
}
let timeoutId;
function recursiveUpdate() {
    ANS.innerText += ".";
    timeoutId = setTimeout(recursiveUpdate, 500);
}
async function getObservations(stationId) {
    stationId = stationId || getStationId();
    setFrozen(null);
    recursiveUpdate();
    while (OL.hasChildNodes()) {
        OL.removeChild(OL.lastChild);
    }
    OL_TITLE.classList.remove(ERROR_CLASS);
    let { start, end } = calculateDateRange();
    let res = await fetch(encodeURI(`https://api.weather.gov/stations/${stationId}/observations?start=${start}&end=${end}`));
    if (!res.ok) {
        console.error("Error in req: ", await res.text());
        return;
    }
    let observations = await res.json();
    let temps = observations.features.filter(obs => obs.properties?.temperature?.value)
    let frozen = true;
    if (temps.length == 0) {
        let li = document.createElement("li");
        let txt = document.createTextNode("No observations found, try a different station")
        li.appendChild(txt);
        OL.appendChild(li);
        OL_TITLE.classList.add(ERROR_CLASS);
        return setFrozen();
    }
    
    for (let obs of temps) {
        let props = obs.properties;
        let temp = props.temperature.value;
        if (!temp) {
            continue;
        }
        frozen = frozen && temp <= 0
        let dt = new Date(props.timestamp);
        let ts = dt.toLocaleString([], { dateStyle: "short", timeStyle: "short" });
        let unitCode = props.temperature.unitCode;
        unitCode = unitCode.substring(unitCode.length - 1);
        let li = document.createElement("li");
        let txt = document.createTextNode(`${ts}: ${temp}${unitCode}`);
        li.appendChild(txt);
        OL.appendChild(li)
    }
    setFrozen(frozen);
}

function setFrozen(isFrozen) {
    clearTimeout(timeoutId);
    if (isFrozen === true) {
        ANS.innerText = "YES!"
        ANS.classList.add(YES_CLASS);
        ANS.classList.remove(NO_CLASS);
    } else if (isFrozen === false) {
        ANS.innerText = "NOPE";
        ANS.classList.add(NO_CLASS);
        ANS.classList.remove(YES_CLASS);
    } else {
        ANS.innerText = "?";
        ANS.classList.remove(NO_CLASS);
        ANS.classList.remove(YES_CLASS);
    }
}

(async () => {
    let savedZip = localStorage.getItem(ZIP_KEY);
    if (savedZip && ZIP_CODES[savedZip]) {
        ZIPS.value = savedZip;
    }
    await lookupAnswer();
})().catch(console.error);
