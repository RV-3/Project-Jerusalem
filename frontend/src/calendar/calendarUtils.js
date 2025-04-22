import moment from 'moment-timezone';

/** Simple labeled console.log for debugging (optional). */
export function debugLog(...args) {
  console.log('%c[CAL DEBUG]', 'color:blue;font-weight:bold;', ...args);
}

/** Check if an hour is excepted based on exceptions. */
export function isHourExcepted(exceptions = [], hStart, hEnd, tz) {
  const start = moment.tz(hStart, tz);
  const end   = moment.tz(hEnd, tz);
  const dateStr = start.format('YYYY-MM-DD');
  return exceptions.some((ex) => {
    if (!ex.date) return false;
    if (ex.date.slice(0, 10) !== dateStr) return false;
    const exDay   = start.clone().startOf('day');
    const exStart = exDay.clone().hour(parseInt(ex.startHour || '0', 10));
    const exEnd   = exDay.clone().hour(parseInt(ex.endHour   || '0', 10));
    return start.isBefore(exEnd) && end.isAfter(exStart);
  });
}

/** Check if the given hour range is covered by an auto-block hour rule. */
export function doesHourRuleCover(rule, hStart, hEnd, tz) {
  const s = moment.tz(hStart, tz);
  const e = moment.tz(hEnd, tz);
  const dayAnchor = s.clone().startOf('day');
  const rStart = dayAnchor.clone().hour(parseInt(rule.startHour, 10));
  const rEnd   = dayAnchor.clone().hour(parseInt(rule.endHour,   10));

  if (s.isBefore(rStart) || e.isAfter(rEnd)) return false;
  if (isHourExcepted(rule.timeExceptions, hStart, hEnd, tz)) return false;
  return true;
}

/** Merge contiguous or adjacent slices [[start,end],[start,end]] into bigger slices. */
export function mergeSlices(slices) {
  if (!slices.length) return [];
  slices.sort((a, b) => a[0] - b[0]);
  const merged = [slices[0]];
  for (let i = 1; i < slices.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = slices[i];
    if (prev[1].getTime() >= curr[0].getTime()) {
      // Overlapping or adjacent => merge
      prev[1] = new Date(Math.max(prev[1].getTime(), curr[1].getTime()));
    } else {
      merged.push(curr);
    }
  }
  return merged;
}

/** Convert a set of background events that overlap a day into merged coverage slices. */
export function getDayCoverageSlices(backgroundEvents, dayStart, dayEnd) {
  const slices = [];
  backgroundEvents.forEach((evt) => {
    const s = new Date(Math.max(evt.start.getTime(), dayStart.getTime()));
    const e = new Date(Math.min(evt.end.getTime(),   dayEnd.getTime()));
    if (s < e) {
      slices.push([s, e]);
    }
  });
  return mergeSlices(slices);
}

/** Check if coverage slices for a day span the entire day from dayStart..dayEnd. */
export function isFullyBlockedViaSlices(dayCoverage, dayStart, dayEnd) {
  if (!dayCoverage.length) return false;
  const [firstSlice] = dayCoverage;
  const lastSlice = dayCoverage[dayCoverage.length - 1];

  if (firstSlice[0].getTime() > dayStart.getTime()) {
    return false;
  }
  if (lastSlice[1].getTime() < dayEnd.getTime()) {
    return false;
  }
  // If there's more than 1 slice after merging => gap => not fully blocked
  if (dayCoverage.length > 1) {
    return false;
  }
  return true;
}

export function getHourRuleSlices(rule, viewStart, viewEnd, tz) {
  const slices = [];
  let dayCursor = moment.tz(viewStart, tz).startOf('day');
  const dayEnd  = moment.tz(viewEnd, tz).endOf('day');

  while (dayCursor.isSameOrBefore(dayEnd, 'day')) {
    for (let h = parseInt(rule.startHour, 10); h < parseInt(rule.endHour, 10); h++) {
      const sliceStart = dayCursor.clone().hour(h);
      const sliceEnd   = sliceStart.clone().add(1, 'hour');

      if (sliceEnd.isSameOrBefore(viewStart) || sliceStart.isSameOrAfter(viewEnd)) {
        continue;
      }
      if (isHourExcepted(rule.timeExceptions, sliceStart.toDate(), sliceEnd.toDate(), tz)) {
        continue;
      }
      slices.push([sliceStart.toDate(), sliceEnd.toDate()]);
    }
    dayCursor.add(1, 'day').startOf('day');
  }
  return mergeSlices(slices);
}

/** For day-based block docs that list daysOfWeek. */
export function getDayBlockSlices(dayDoc, viewStart, viewEnd, tz) {
  if (!dayDoc?.daysOfWeek?.length) return [];
  const slices = [];
  let current = moment.tz(viewStart, tz).startOf('day');
  const limit = moment.tz(viewEnd, tz).endOf('day');

  while (current.isBefore(limit)) {
    const dayName = current.format('dddd');
    if (dayDoc.daysOfWeek.includes(dayName)) {
      for (let h = 0; h < 24; h++) {
        const sliceStart = current.clone().hour(h);
        const sliceEnd   = sliceStart.clone().add(1, 'hour');
        if (sliceEnd.isSameOrBefore(viewStart) || sliceStart.isSameOrAfter(viewEnd)) {
          continue;
        }
        if (!isHourExcepted(dayDoc.timeExceptions, sliceStart.toDate(), sliceEnd.toDate(), tz)) {
          slices.push([sliceStart.toDate(), sliceEnd.toDate()]);
        }
      }
    }
    current.add(1, 'day').startOf('day');
  }
  return mergeSlices(slices);
}

/** Build background events from auto-block rules/hours and days. */
export function buildAutoBlockAllEvents(autoBlockHours, autoBlockDaysDoc, viewStart, viewEnd, tz) {
  const events = [];

  // Day-based auto blocks
  if (autoBlockDaysDoc) {
    const daySlices = getDayBlockSlices(autoBlockDaysDoc, viewStart, viewEnd, tz);
    daySlices.forEach(([s, e]) => {
      events.push({
        id: `auto-day-${autoBlockDaysDoc._id}-${s.toISOString()}`,
        start: s,
        end: e,
        display: 'background',
        color: '#ffcccc'
      });
    });
  }

  // Hour-based auto blocks
  autoBlockHours.forEach((rule) => {
    const hourSlices = getHourRuleSlices(rule, viewStart, viewEnd, tz);
    hourSlices.forEach(([s, e]) => {
      events.push({
        id: `auto-hour-${rule._id}-${s.toISOString()}`,
        start: s,
        end: e,
        display: 'background',
        color: '#ffcccc'
      });
    });
  });

  return events;
}

/** Check if the day is "fully blocked" by merging coverage from all background events. */
export function isDayFullyBlocked(dayEvents, dayStart, dayEnd) {
  const backgroundEvents = dayEvents.filter((e) => e.display === 'background');
  const coverageSlices = getDayCoverageSlices(backgroundEvents, dayStart, dayEnd);
  const merged = mergeSlices(coverageSlices);
  return isFullyBlockedViaSlices(merged, dayStart, dayEnd);
}

/** Scroll horizontally so the day column for dateStr is visible. */
export function scrollDayColumnIntoView(dateStr) {
  debugLog('scrollDayColumnIntoView => dateStr=', dateStr);
  requestAnimationFrame(() => {
    let scroller = document.querySelector('.fc-timegrid-body .fc-timegrid-slots .fc-scroller');
    if (!scroller) {
      scroller = document.querySelector('.fc-timegrid-body .fc-scroller');
    }
    if (!scroller) {
      debugLog('No suitable scroller found => skip horizontal scroll');
      return;
    }

    const col = scroller.querySelector(`[data-date="${dateStr}"]`);
    if (!col) {
      debugLog('No column found for data-date=', dateStr);
      return;
    }

    const colRect      = col.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const offset = (colRect.left - scrollerRect.left) + scroller.scrollLeft - 20;

    debugLog('Scrolling horizontally => offset=', offset);
    scroller.scrollTo({
      left: offset,
      behavior: 'smooth'
    });
  });
}

/**
 * Identify the first day (within 14 days) that has an upcoming reservation
 * or is not fully blocked.
 */
export function findEarliestRelevantDay(allEvents, tz) {
  const nowMidnight = moment.tz(tz).startOf('day');
  const lookaheadEnd = nowMidnight.clone().add(14, 'days').endOf('day');

  for (
    let day = nowMidnight.clone();
    day.isSameOrBefore(lookaheadEnd, 'day');
    day.add(1, 'day')
  ) {
    const dayStart = day.clone().startOf('day').toDate();
    const dayEnd   = day.clone().endOf('day').toDate();

    const dayEvents = allEvents.filter((evt) => {
      const evtStart = evt.start instanceof Date ? evt.start : new Date(evt.start);
      const evtEnd   = evt.end   instanceof Date ? evt.end   : new Date(evt.end);
      return evtStart < dayEnd && evtEnd > dayStart;
    });

    // If any event is not a background event => there's a real reservation
    const hasRealReservation = dayEvents.some((e) => e.display !== 'background');
    const fullyBlocked       = isDayFullyBlocked(dayEvents, dayStart, dayEnd);

    if (hasRealReservation || !fullyBlocked) {
      return dayStart;
    }
  }
  return null;
}
