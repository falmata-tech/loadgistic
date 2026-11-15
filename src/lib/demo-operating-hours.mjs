// Owner-requested limited credit use: daily 09:00–11:00 Africa/Addis_Ababa.
// Ethiopia stays UTC+3; use UTC arithmetic, independent of the server timezone.
export const DEMO_OPERATING_CRON='* 6-7 * * *';
export function demoOperatingWindowEnd(now){
 if(!Number.isFinite(now)||now<0)return null;
 const date=new Date(now),hour=date.getUTCHours();
 if(hour<6||hour>=8||!Number.isFinite(hour))return null;
 return Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate(),8);
}
export const demoOperatingHoursOpen=now=>demoOperatingWindowEnd(now)!==null;
