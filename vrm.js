/**
 * node implementation of the most needed VRM API functions
 *
 * Documentation see https://vrm-api-docs.victronenergy.com/#/
 */
import Logger from "./logging.cjs";
import fetch from "node-fetch";
import dateformat from "dateformat";
import { encode } from "html-entities";

import { getStartAndEndFromInterval, dateMask } from "./helper.js";
import config from "./config.json" assert { type: "json" };

const log = new Logger("api");

const baseUrl = "https://vrmapi.victronenergy.com/v2";
const authUrl = `${baseUrl}/auth/login`;

function valueFromSeries(series) {
    let last = series[series.length - 1];
    let kwh = last[1];
    return kwh;
}

function groupSeriesByDay(series) {
    let grouped = {};
    series.reduce((acc, current) => {
        if (current.length === 0) return;
        let timestamp = current[0] * 1000;
        let date = new Date(timestamp);
        let day = dateformat(date, dateMask);
        if (grouped[day] === undefined) {
            grouped[day] = {};
        }

        if (grouped[day]["value"] === null) return;

        if (grouped[day]["value"] === undefined || grouped[day]["value"] < current[1]) {
            grouped[day]["value"] = current[1];
        }
    });
    return grouped;
}

class VictronApi {
    idUser;
    token;
    accessToken;

    constructor(idUser, accessToken) {
        this.idUser = idUser;
        this.accessToken = accessToken;
        log.debug("site id from config:", config.idSite);
    }

    async login(username, password) {
        log.debug(`try to login with username ${username}`);
        let reqData = {
            username,
            password,
            remember_me: true
        };

        let response = await fetch(authUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reqData)
        });
        let data = await response.json();
        this.token = data.token;
        this.idUser = data.idUser;
        log.debug("received valid data for user:", `idUser: ${this.idUser}`, `token: ${this.token}`);
    }

    async fetchInstallations() {
        if (!this.accessToken) return;

        // get installations
        const installUrl = `${baseUrl}/users/${this.idUser}/installations`;

        let options = {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "x-authorization": `Token ${this.accessToken}`
            }
        };

        let response = await fetch(installUrl, options);
        let data = await response.json();

        log.debug("received data:", data);
        return data.records;
    }

    async fetchSystemOverview() {
        if (!this.accessToken) return;

        const systemUrl = `${baseUrl}/installations/${config.idSite}/system-overview`;
        let options = {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "x-authorization": `Token ${this.accessToken}`
            }
        };
        let response = await fetch(systemUrl, options);
        let data = await response.json();

        log.debug("received system overview data:", data);
        return data.records;
    }

    async fetchData() {
        // TODO: if idUser and accessToken not present, use login
        if (!this.accessToken) return;

        let options = {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "x-authorization": `Token ${this.accessToken}`
            }
        };

        let data = [];
        data.push(dateformat(new Date(), dateMask));
        for (const charger of config.charger) {
            const solarStatusUrl = `${baseUrl}/installations/${config.idSite}/widgets/SolarChargerSummary?instance=${charger.instance}`;
            let response = await fetch(solarStatusUrl, options);
            let chargerData = await response.json();
            // log.debug(`all charger data for ${charger.name} (instance=${charger.instance}):`, chargerData);
            let production = parseFloat(chargerData.records.data["94"].value);
            data.push({
                name: encode(charger.name, { mode: "nonAscii" }),
                production
            });
            // log.debug(`data for charger '${charger.name}' (instance=${charger.instance}): ${production} kWh`);
        }

        return data;
    }

    async fetchStats(interval) {
        if (!this.accessToken) return;

        let [timeStart, timeEnd, formattedStart, formattedEnd] = getStartAndEndFromInterval(interval, true);

        let data = {};
        for (const charger of config.charger) {
            let statsUrl = `${baseUrl}/installations/${config.idSite}/widgets/Graph?instance=${charger.instance}&pointsPerPixel=1&useMinMax=0&start=${timeStart}&end=${timeEnd}&attributeIds[]=94`;
            if (charger.mppts > 1) {
                statsUrl += "&attributeIds[]=703&attributeIds[]=704";
            }

            log.debug("request url for stats:", statsUrl);
            let options = {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json, text/plain, */*",
                    "x-authorization": `Token ${this.accessToken}`
                }
            };
            let response = await fetch(statsUrl, options);
            let stats = await response.json();
            //log.debug("complete stats:", stats);
            let chargerData = stats.records.data;
            let encodedName = encode(charger.name, { mode: "nonAscii" });

            for (let id of ["94", "703", "704"]) {
                if (chargerData[id] === undefined || chargerData[id].length === 0) continue;
                let main = groupSeriesByDay(chargerData[id]);
                for (let day of Object.keys(main)) {
                    if (data[day] === undefined) {
                        data[day] = {};
                    }
                    if (data[day][id] === undefined) {
                        data[day][id] = [];
                    }
                    data[day][id].push({
                        instance: charger.instance,
                        name: encodedName,
                        value: main[day].value
                    });
                }
            }
        }
        return {
            rows: data,
            timeframe: {
                start: formattedStart,
                end: formattedEnd
            }
        };
    }
}

export default VictronApi;
