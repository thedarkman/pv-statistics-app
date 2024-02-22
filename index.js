import auth from "./auth.cjs";
import Logger from "./logging.cjs";
import VictronApi from "./vrm.js";
import InfluxApi from "./influx.js";
import express from "express";
import cookieParser from "cookie-parser";
import session from "express-session";

import "dotenv/config";
import config from "./config.json" assert { type: "json" };

const log = new Logger("app");

// validate config

// create api connections
const apis = [];
config.apis.forEach((api, i) => {
    const apiType = api.type || "vrm";
    apis.push(
        apiType === "vrm"
            ? new VictronApi(api, process.env.VRM_ID_USER, process.env.VRM_ACCESS_TOKEN)
            : new InfluxApi(api)
    );
});

const port = process.env.PORT || 8080;

const app = express();
const contextPath = process.env.CONTEXT_PATH || "";
log.debug("context path is set to:", contextPath);
let credentials = process.env.USER_CONFIG;
let users = {};
if (credentials) {
    const config = JSON.parse(credentials);
    for (let k of Object.keys(config)) {
        users[k] = config[k];
    }
}

const globalState = {};
const updateInterval = 10 * 60 * 1000;

function shutDown() {
    log.debug("shutdown called ... bye");
    process.exit(0);
}

process.on("SIGTERM", shutDown);
process.on("SIGINT", shutDown);

app.set("view engine", "ejs");
app.disable("x-powered-by");
app.use(cookieParser(process.env.SESSION_SECRET));
app.use(contextPath, express.static("public"));
app.use(express.raw({ type: "*/*" }));

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        cookie: { path: contextPath, httpOnly: true },
        resave: false,
        saveUninitialized: true
    })
);

if (credentials) {
    app.use(auth({ users, contextPath }));
}

// default entry point - rendered via ejs template
app.get([contextPath, contextPath + "/"], (req, res) => {
    res.render("app", {
        title: config.title
    });
});

app.get(contextPath + "/state", (req, res) => {
    const interval = req.query.i;
    log.debug("state request for interval:", interval);
    if (globalState[interval] === undefined) globalState[interval] = { lastUpdate: null };

    let state = globalState[interval];
    log.debug("lastUpdate of stats was:", state.lastUpdate === null ? "null" : new Date(state.lastUpdate));
    const nextUpdate = state.lastUpdate === null ? 0 : state.lastUpdate + updateInterval;
    log.debug("next update after:", state.lastUpdate === null ? "now" : new Date(nextUpdate));
    if (state.lastUpdate === null || nextUpdate < new Date().getTime()) {
        if (state.rows === undefined) state.rows = {};
        let promises = [];
        // collect API calls as promise, so we can process them all at once
        for (const api of apis) {
            promises.push(api.fetchStats(interval));
        }
        let timeDataAdded = false;
        Promise.all(promises)
            .then((responses) => {
                state.rows = {}; // clear data for update
                for (let data of responses) {
                    for (let day of Object.keys(data.rows)) {
                        if (state.rows[day] === undefined) {
                            state.rows[day] = data.rows[day];
                        } else {
                            for (let id of Object.keys(data.rows[day])) {
                                if (state.rows[day][id] === undefined) state.rows[day][id] = data.rows[day][id];
                                else {
                                    data.rows[day][id].forEach((o) => state.rows[day][id].push(o));
                                }
                            }
                        }
                    }
                    if (!timeDataAdded) {
                        state.timeframe = responses.timeframe;
                        state.lastUpdate = new Date().getTime();
                        timeDataAdded = true;
                    }
                }
                res.status(200).type("application/json").send(JSON.stringify(state));
            })
            .catch((error) => log.error(error));
    } else {
        res.status(200).type("application/json").send(JSON.stringify(state));
    }
});

app.listen(port, () => {
    log.debug(`app listening on port ${port}`);
});
