function processData(data) {
    const info = document.querySelector("#message");
    if (data.rows === undefined || Object.keys(data.rows).length === 0) {
        info.innerHTML = `Keine Daten zwischen ${data.timeframe.start} und ${data.timeframe.end} gefunden`;
        info.style.display = "block";
        return;
    } else {
        info.style.display = "none";
    }

    let table = document.querySelector("table");
    // header
    let tHead = table.createTHead();
    let hRow = tHead.insertRow();
    let dateCell = hRow.insertCell();
    dateCell.innerHTML = "Tag";

    let gainSumCell = hRow.insertCell();
    gainSumCell.innerHTML = "Tagesertrag";

    let keys = Object.keys(data.rows);
    let lastKey = keys[keys.length - 1];
    let last = data.rows[lastKey];
    for (let key of Object.keys(last)) {
        let chargerArray = last[key]; // array of objects
        let id = parseInt(key);
        for (let charger of chargerArray) {
            let c = hRow.insertCell();
            c.scope = "col";
            c.innerHTML =
                id > 100 ? `${charger.name}<br><span class="smaller">Tracker ${id - 702}</span>` : charger.name;
        }
    }

    let totals = {};
    // data in table body
    let tBody = table.createTBody();
    for (const key of Object.keys(data.rows)) {
        let tableRow = tBody.insertRow();
        let dateCell = tableRow.insertCell();
        dateCell.innerHTML = key;
        // sum of all charger
        let gainSum = data.rows[key]["94"].reduce((acc, charger) => {
            return acc + parseFloat(charger.value);
        }, 0);
        let rowGain = tableRow.insertCell();
        rowGain.classList.add("right");
        rowGain.innerHTML = `${gainSum.toFixed(2)} kWh`;
        // individual charger
        for (let id of Object.keys(data.rows[key])) {
            if (totals[id] === undefined) totals[id] = {};
            for (const charger of data.rows[key][id]) {
                let chargerCell = tableRow.insertCell();
                let kwh = parseFloat(charger.value);
                if (totals[id][charger.instance] === undefined) totals[id][charger.instance] = 0;
                totals[id][charger.instance] = totals[id][charger.instance] + kwh;
                chargerCell.classList.add("kwh");
                chargerCell.style.padding = "2px";
                chargerCell.innerHTML = kwh.toFixed(2) + " kWh";
            }
        }
    }

    let tFoot = table.createTFoot();
    let footRow = tFoot.insertRow();

    let cell = footRow.insertCell();
    cell.innerHTML = "Summe";

    footRow.insertCell();

    for (const key of Object.keys(totals)) {
        for (const charger of Object.keys(totals[key])) {
            cell = footRow.insertCell();
            cell.innerHTML = totals[key][charger].toFixed(2) + " kWh";
            cell.classList.add("kwh");
        }
    }

    let totalSolarKwh = Object.values(totals["94"]).reduce((acc, value) => {
        return acc + value;
    }, 0);
    let updateRow = tFoot.insertRow();
    let labelCell = updateRow.insertCell();
    labelCell.innerHTML = "Gesamtertrag";
    let gainCell = updateRow.insertCell();
    gainCell.classList.add("right");
    gainCell.innerHTML = `${totalSolarKwh.toFixed(2)} kWh`;
    gainCell.colSpan = 1;
    gainCell.style.fontWeight = "bold";
    let infoCell = updateRow.insertCell();
    infoCell.innerHTML = `Letztes update: ${new Date(data.lastUpdate).toLocaleString()}`;
    infoCell.colSpan = tHead.childNodes[0].childElementCount - 2;
    infoCell.classList.add("right");
}

function fetchState(interval) {
    fetch(`state?i=${interval}`)
        .then((r) => r.json())
        .then((data) => processData(data))
        .catch((err) => console.log("error on fetch stats:", err));
}

function checkAndSubmit() {
    const dd = document.querySelector("#interval");
    const alert = document.querySelector("#errorMsg");
    let table = document.querySelector("table");
    table.innerHTML = ""; // clear table first

    if (dd.selectedIndex === 0) {
        alert.innerHTML = "Bitte Zeitraum ausw&auml;hlen!";
        alert.style.display = "block";
        return;
    } else {
        alert.style.display = "none";
    }

    const info = document.querySelector("#message");
    info.style.display = "none";

    fetchState(dd.value);
}

function copyToClipboard(h) {
    const sep = ";";
    let text = "";
    const tHead = document.querySelector("thead");
    if (tHead === undefined || tHead === null) {
        return;
    }
    console.log("will copy table data to clipboard with" + (h ? "" : "out") + " headers");

    if (h) {
        let headers = document.querySelector("thead").childNodes;
        for (let h of headers[0].childNodes) {
            text += `"${h.textContent}"${sep}`;
        }
        text = text.slice(0, -1);
        text += "\n";
    }

    let rows = document.querySelector("tbody").childNodes;
    for (let row of rows) {
        for (let col of row.childNodes) {
            let cleanText = col.textContent.replace(" kWh", "");
            if (isNaN(cleanText)) text += `"${cleanText}"${sep}`;
            else text += `${cleanText.replace(".", ",")}${sep}`;
        }
        text = text.slice(0, -1);
        text += "\n";
    }
    // console.log(text);
    navigator.clipboard.writeText(text).then(() => {
        document.querySelector("#liveToast .toast-body").innerHTML = "Daten in die Zwischenablage kopiert.";
        let toast = new bootstrap.Toast(document.querySelector("#liveToast"));
        toast.show();
    });
}
