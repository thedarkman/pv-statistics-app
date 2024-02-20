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
log.debug("message from the logger");

const apiType = config.type || "vrm";
const api = apiType === "vrm" ? new VictronApi(process.env.VRM_ID_USER, process.env.VRM_ACCESS_TOKEN) : new InfluxApi();
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

app.disable("x-powered-by");
app.use(cookieParser(process.env.SESSION_SECRET));
app.use(contextPath, express.static("public"));
app.use(
    express.raw({
        type: "*/*"
    })
);

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        cookie: {
            path: contextPath,
            httpOnly: true
        },
        resave: false,
        saveUninitialized: true
    })
);

if (credentials) {
    app.use(auth({ users, contextPath }));
}

// default entry point
app.get([contextPath, contextPath + "/"], (req, res) => {
    res.sendFile("app.html", {
        root: "./public"
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
        api.fetchStats(interval)
            .then((data) => {
                state.rows = data.rows;
                state.timeframe = data.timeframe;
                state.lastUpdate = new Date().getTime();
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
