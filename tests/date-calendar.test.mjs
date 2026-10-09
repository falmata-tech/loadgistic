import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dateOnly,todayDate,shiftDate,calendarDates,shiftCalendar,dateAllowed,ethiopianDate,calendarDay} from '../src/lib/date-calendar.js';
test('date-only validation rejects rollover and preserves ISO authority',()=>{
 for(const value of ['2026-02-29','2026-13-01','2026-00-01','2026-01-32','2026-1-01','abc',null])assert.equal(dateOnly(value),null);
 assert.equal(dateOnly('2024-02-29').toISOString(),'2024-02-29T12:00:00.000Z');
 assert.equal(shiftDate('2024-02-28',1),'2024-02-29');assert.equal(shiftDate('2024-02-29',1),'2024-03-01');
 assert.equal(shiftDate('2026-12-31',1),'2027-01-01');assert.equal(todayDate(new Date(2026,9,7,23,59)),'2026-10-07');
});
test('Monday-first weeks, variable month grids, navigation and limits',()=>{
 assert.deepEqual(calendarDates('2026-10-07'),['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10','2026-10-11']);
 assert.equal(calendarDates('2026-10-11')[0],'2026-10-05');
 assert.equal(calendarDates('2026-10-01','month').length,35);
 assert.equal(calendarDates('2026-03-01','month').length,42);
 assert.equal(shiftCalendar('2026-12-31','month',1),'2027-01-01');
 assert.equal(shiftCalendar('0099-12-31','month',1),'0100-01-01');
 assert.equal(shiftCalendar('0004-01-31','month',1),'0004-02-01');
 assert.equal(calendarDates('0004-02-12','month').includes('0004-02-29'),true);
 assert.equal(shiftCalendar('2026-01-31','month',1),'2026-02-01');
 assert.equal(shiftCalendar('2026-10-07','week',-1),'2026-09-30');
 assert.equal(dateAllowed('2026-10-07','2026-10-07','2026-10-07'),true);
 assert.equal(dateAllowed('2026-10-06','2026-10-07'),false);
 assert.equal(dateAllowed('2026-10-08','','2026-10-07'),false);
});
test('ICU Ethiopian New Year, Pagumen leap day and every app locale',()=>{
 const expected=[['2023-09-11','2015','6'],['2023-09-12','2016','1'],['2024-09-10','2016','5'],['2024-09-11','2017','1'],['2026-09-11','2019','1']];
 for(const [iso,year,day] of expected){const value=ethiopianDate(iso);assert.ok(value);assert.equal(value.year,year);assert.equal(value.day,day);}
 for(const locale of ['en','am','om','so','ti']){const value=calendarDay('2026-10-07',locale);assert.ok(value.weekday);assert.ok(value.ethiopian);assert.ok(value.ethiopian.label);}
 assert.equal(ethiopianDate('2026-02-30'),null);
});
test('date-only labels remain unchanged in distant timezones',()=>{
 const previous=process.env.TZ;
 try{for(const zone of ['America/Chicago','Pacific/Honolulu','Pacific/Kiritimati','Africa/Addis_Ababa']){process.env.TZ=zone;assert.equal(calendarDay('2023-09-12').day,'12');assert.equal(ethiopianDate('2023-09-12').day,'1');assert.equal(calendarDates('2026-10-07')[0],'2026-10-05');}}
 finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
