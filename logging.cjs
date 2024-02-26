const http = require('http');
const dateFormat = require('dateformat');
const mask = 'yyyy-mm-dd HH:MM:ss.l';

class Logger {
    logname;

    constructor(logname) {
        this.logname = logname;
    }

    error() {
        this.#doLog('ERROR', arguments);
    }

    warn() {
        this.#doLog('WARN', arguments);
    }

    info() {
        this.#doLog('INFO', arguments);
    }

    debug() {
        this.#doLog('DEBUG', arguments);
    }

    #doLog(level, args) {
        const now = new Date();
        let msg = '';
        if (typeof args === 'object') {
            let arg;
            for (arg in args) {
                let val = args[arg];
                if (typeof val === 'object') {
                    if (val instanceof http.IncomingMessage) {
                        const ip = val.headers['x-forwarded-for'] || val.socket.remoteAddress;
                        const sessionId = val.session.id;
                        msg += `[${ip} ${sessionId}]`;
                        const auth = val.headers['authorization'];
                        if (typeof auth !== 'undefined') {
                            let base64 = auth.split(' ')[1];
                            let decoded = Buffer.from(base64, 'base64').toString('ascii');
                            let user = decoded.split(':')[0];
                            msg += ` ${user}`;
                        }
                    } else {
                        msg += '\u001b[36m' + JSON.stringify(val) + '\u001b[0m';
                    }
                } else msg += val;

                if (arg < args.length - 1) msg += ' ';
            }
        } else {
            msg = args;
        }
        if (level === 'ERROR') {
            level = `\u001b[30m\u001b[41m${level}\u001b[0m`;
        } else if (level === 'WARN') {
            level = `\u001b[30m\u001b[43m${level}\u001b[0m`;
        }
        console.log(`\u001b[32m${dateFormat(now, mask)}\u001b[0m`, level, `[\u001b[34m${this.logname}\u001b[0m]`, msg);
    }
}

module.exports = Logger;
