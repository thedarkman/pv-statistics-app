/**
 * InfluxDB 1.x http query implementation
 */
import Logger from "./logging.cjs";
import fetch from "node-fetch";
import dateformat from "dateformat";
import {encode} from "html-entities";

import {getStartAndEndFromInterval, dateMask} from "./helper.js";
import config from "./config.json" assert {type: "json"};

const log = new Logger("influx");

class InfluxApi {
    config;
    baseUrl;

    constructor(config) {
        this.config = config;
        let port = config.port || 8086;
        this.baseUrl = `http://${config.host}:${port}/query`;
    }

    async fetchStats(interval) {
        let [timeStart, timeEnd, formattedStart, formattedEnd] = getStartAndEndFromInterval(interval, false);

        let data = {};
        for (const charger of this.config.charger) {
            let query;
            let timeFilter = `time > ${timeStart}ms and time < ${timeEnd}ms`;
            if (charger["query"] === undefined) {
                query = encodeURI(
                    `SELECT max("${charger.property}")
                     FROM "${charger.bucket}"
                     WHERE ${timeFilter}
                     GROUP BY time (1d)`
                );
            } else {
                query = encodeURI(charger.query.replace(/\$timeFilter/, timeFilter));
            }
            let statsUrl = `${this.baseUrl}?db=${charger.database}&q=${query}&epoch=ms`;
            log.debug("request url for stats:", statsUrl);
            let options = {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json, text/plain, */*"
                }
            };
            try {
                let response = await fetch(statsUrl, options).catch((error) => log.error(error));
                let stats = await response.json();
                // log.debug("complete stats:", stats);
                if (stats.results) {
                    let encodedName = encode(charger.name, {mode: "nonAscii"});
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
            } catch (error) {
                log.error('error occurred:', error);
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
