
const ANS = document.getElementById("answer");
const OL = document.getElementById("observations");
/**@type HTMLSelectElement */
const STATE = document.getElementById("state-select");
const STATION = document.getElementById("station-select");
const STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
    "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA",
    "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC",
    "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
    "VA", "WA", "WV", "WI", "WY",];
const STATE_KEY = "saved-state";
const STATION_KEY = "saved-station";

function createOpt(text, value) {
    let opt = document.createElement("option");
    opt.innerText = text;
    opt.value = value;
    return opt;
}
function populateStates() {
    while (STATE.hasChildNodes()) {
        STATE.removeChild(STATE.lastChild);
    }
    let opt = createOpt("", "")
    STATE.appendChild(opt);
    for (let abbr of STATES) {
        let opt = createOpt(abbr, abbr);
        STATE.appendChild(opt);
    }
}

function getState() {
    let state = STATE.selectedOptions[0]?.value;
    if (!state || state.length == 0) {
        localStorage.removeItem(STATION_KEY);
        return;
    }
    return state;
}

async function populateStations() {
    let state = getState();
    if (state !== localStorage.getItem(STATE_KEY)) {
        localStorage.removeItem(STATION_KEY);
    } else {
        localStorage.setItem(STATE_KEY, state);
    }
    setFrozen(null);
    while (STATION.hasChildNodes()) {
        STATION.removeChild(STATION.lastChild);
    }
    if (!state || state.length == 0) {
        localStorage.removeItem(STATION_KEY);
        return;
    }
    let res = await fetch(encodeURI(`https://api.weather.gov/stations?state=${state}`));
    if (!res.ok) {
        return console.warn("Error from request", await res.text());
    }
    let stations = await res.json();
    STATION.appendChild(createOpt("", ""));
    stations.features.sort((l, r) => {
        let ll = l.properties.name.toLowerCase();
        let rl = r.properties.name.toLowerCase();
        if (ll < rl) {
            return -1;
        }
        if (ll > rl) {
            return 1;
        }
        return 0;
    });
    for (let station of stations.features) {
        let opt = createOpt(
            station.properties.name,
            station.properties.stationIdentifier,
        );
        STATION.appendChild(opt);
    }
}

async function stationSelected() {
    setFrozen(null);
    let stationId = getStationId();
    if (!stationId) {
        return;
    }
    localStorage.setItem(STATION_KEY, stationId);
    await getObservations();
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

function getStationId() {
    let stationId = STATION.selectedOptions[0]?.value;
    if (!stationId || stationId.length == 0) {
        return null;
    }
    return stationId;
}

async function getObservations() {
    setFrozen(null);
    while (OL.hasChildNodes()) {
        OL.removeChild(OL.lastChild);
    }
    let { start, end } = calculateDateRange();
    let res = await fetch(encodeURI(`https://api.weather.gov/stations/${getStationId()}/observations?start=${start}&end=${end}`));
    if (!res.ok) {
        console.error("Error in req: ", await res.text());
        return;
    }
    let observations = await res.json();
    let frozen = true;
    for (let obs of observations.features) {
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
        let li = document.createElement('li');
        let txt = document.createTextNode(`${ts}: ${temp}${unitCode}`);
        li.appendChild(txt);
        OL.appendChild(li)
    }
    setFrozen(frozen);
}

function setFrozen(isFrozen) {
    if (isFrozen == true) {
        ANS.innerText = "YES!"
        ANS.classList.add("yes");
        ANS.classList.remove("no");
    } else if (isFrozen == false) {
        ANS.innerText = "NOPE";
        ANS.classList.add("no");
        ANS.classList.remove("yes");
    } else {
        ANS.innerText = "????";
        ANS.classList.remove("no");
        ANS.classList.remove("yes");
    }
}

populateStates();

(async () => {
    let savedState = localStorage.getItem(STATE_KEY);
    let savedStation = localStorage.getItem(STATION_KEY);
    if (savedState && savedState.length > 0) {
        STATE.value = savedState;
        await populateStations();
        if (savedStation && savedStation.length > 0) {
            STATION.value = savedStation;
            await getObservations();
        }
    }
})().catch(console.error);
