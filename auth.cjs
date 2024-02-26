require('dotenv').config();
const Logger = require('./logging.cjs');
const log = new Logger('Auth');

module.exports = (options) => {
    return function (req, res, next) {
        let cookies = req.cookies;
        let user = cookies['un'];
        let validated = user && user in options.users;
        if (validated) {
            next();
            return;
        }

        const hAuth = req.get('Authorization');
        if (hAuth) {
            // get username / passwd
            const buff = Buffer.from(hAuth.replace('Basic ', ''), 'base64');
            const credentials = buff.toString('ascii');
            let userName = credentials.split(':')[0];
            log.debug('username received:', userName);
            let password = credentials.split(':')[1];
            let validated = userName in options.users && options.users[userName] === password;
            if (validated) {
                // 30 * 24 * 60 * 60 * 1000
                res.cookie('un', userName, { maxAge: 2592000000, path: options.contextPath, httpOnly: true });
                next();
                return;
            }
        }

        if (req.session && (!req.session.challengeShown || req.session.challangeCount < 3)) {
            req.session.challengeShown = true;
            if (typeof req.session.challangeCount === 'undefined' || req.session.challangeCount === 0)
                req.session.challangeCount = 1;
            else req.session.challangeCount++;
            log.warn(`Unauthorized - creating challenge ${req.session.challangeCount}`);
            res.set('WWW-Authenticate', 'Basic realm="Access to staging site"');
            res.sendStatus(401);
        } else {
            if (req.session) {
                req.session.challengeShown = false;
                req.session.challangeCount = 0;
            }
            log.warn('Forbidden');
            res.status(403).sendFile('unauthorized.html', { root: './public' });
        }
    };
};
