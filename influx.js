/**
 * InfluxDB 1.x http query implementation
 */
import Logger from "./logging.cjs";
import fetch from "node-fetch";
import dateformat from "dateformat";
import { encode } from "html-entities";

import { getStartAndEndFromInterval, dateMask } from "./helper.js";
import config from "./config.json" assert { type: "json" };

const log = new Logger("influx");

const port = config.port || 8086;
const baseUrl = `http://${config.host}:${port}/query`;

class InfluxApi {
    constructor() {}

    async fetchStats(interval) {
        let [timeStart, timeEnd, formattedStart, formattedEnd] = getStartAndEndFromInterval(interval, false);

        let data = {};
        for (const charger of config.charger) {
            let query = encodeURI(
                `SELECT max("${charger.property}") FROM "${charger.bucket}" WHERE time > ${timeStart}ms and time < ${timeEnd}ms GROUP BY time(1d)`
            );
            let statsUrl = `${baseUrl}?db=${charger.database}&q=${query}&epoch=ms`;
            log.debug("request url for stats:", statsUrl);
            let options = {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json, text/plain, */*"
                }
            };
            let response = await fetch(statsUrl, options).catch((error) => log.error(error));
            let stats = await response.json();
            // log.debug("complete stats:", stats);
            if (stats.results) {
                let encodedName = encode(charger.name, { mode: "nonAscii" });
                let series = stats.results[0].series[0];
                for (let arr of series.values) {
                    const ts = new Date(arr[0]);
                    if (ts < timeStart || ts > timeEnd) continue;
                    const day = dateformat(ts, dateMask);
                    if (data[day] === undefined) {
                        data[day] = {};
                    }
                    if (data[day]["94"] === undefined) {
                        data[day]["94"] = [];
                    }
                    let value = arr[1] !== null && arr[1] !== undefined ? parseFloat(arr[1]) : 0;
                    data[day]["94"].push({
                        instance: charger.instance,
                        name: encodedName,
                        value
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

export default InfluxApi;
