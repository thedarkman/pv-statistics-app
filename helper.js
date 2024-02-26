import dateformat from 'dateformat';
import {
    endOfISOWeek,
    endOfMonth,
    startOfISOWeek,
    startOfMonth,
    startOfYear,
    endOfYear,
    subDays,
    subMonths,
    subYears
} from 'date-fns';
import Logger from './logging.cjs';

const log = new Logger('helper');
const dateMask = 'yyyy-mm-dd';

const getStartAndEndFromInterval = (interval, seconds) => {
    let divider = seconds ? 1000 : 1;

    // https://date-fns.org/v3.3.1/docs/startOfWeek
    // interval: tw | lw | tm | lm

    let now = new Date();

    let start, end;
    switch (interval) {
        case 'tw':
            start = startOfISOWeek(now);
            end = now;
            break;
        case 'lw':
            start = startOfISOWeek(now);
            start = subDays(start, 7);
            end = endOfISOWeek(start);
            break;
        case 'tm':
            start = startOfMonth(now);
            end = now;
            break;
        case 'lm':
            start = startOfMonth(now);
            start = subMonths(start, 1);
            end = endOfMonth(start);
            break;
        case 'ty':
            start = startOfYear(now);
            end = now;
            break;
        case 'ly':
            start = startOfYear(now);
            start = subYears(start, 1);
            end = endOfYear(start);
            break;
    }
    let formattedStart = dateformat(start, dateMask);
    let formattedEnd = dateformat(end, dateMask);
    log.debug('using start:', formattedStart, 'and end:', formattedEnd);

    let timeStart = parseInt(start.getTime() / divider);
    let timeEnd = parseInt(end.getTime() / divider);

    return [timeStart, timeEnd, formattedStart, formattedEnd];
};

export { getStartAndEndFromInterval, dateMask };
