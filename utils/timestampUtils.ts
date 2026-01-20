/**
 * Timestamp Utilities - Replicates AngularJS datetimeService
 * Based on: web_app/src/app/services/datetimeService.js
 * 
 * DO NOT MODIFY - Must match AngularJS behavior exactly
 */

const MILLI_SECS_IN_DAY = 24 * 60 * 60 * 1000;

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Formats timestamp as "h:mm a" (e.g., "10:21 AM")
 * Matches AngularJS datetimeService.getTimeFormatHmma()
 */
export function getTimeFormatHmma(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

/**
 * Checks if timestamp is today
 * Matches AngularJS datetimeService.isToday()
 */
function isToday(ts: number): boolean {
  const tsDate = formatDate(ts, "MMM d,yyyy");
  const todayDate = formatDate(Date.now(), "MMM d,yyyy");
  return tsDate === todayDate;
}

/**
 * Checks if timestamp is yesterday
 * Matches AngularJS datetimeService.isYesterday()
 */
function isYesterday(ts: number): boolean {
  const tsDate = formatDate(ts, "MMM d,yyyy");
  const yesterday = Date.now() - MILLI_SECS_IN_DAY;
  const yestDate = formatDate(yesterday, "MMM d,yyyy");
  return tsDate === yestDate;
}

/**
 * Formats date using AngularJS dateFilter format
 * Simplified version - matches AngularJS dateFilter behavior
 */
function formatDate(timestamp: number, format: string): string {
  const date = new Date(timestamp);
  
  if (format === "MMM d,yyyy") {
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day},${year}`;
  }
  
  if (format === "MMM d") {
    const month = months[date.getMonth()];
    const day = date.getDate();
    return `${month} ${day}`;
  }
  
  if (format === "M/d/yy") {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear().toString().slice(-2);
    return `${month}/${day}/${year}`;
  }
  
  return '';
}

/**
 * Formats date separator for messages (e.g., "Today", "Yesterday", "JAN 9, 2:55 PM")
 * Matches AngularJS datetimeService.dateSeparatorFromCurrentTime(ts, withTime)
 */
export function dateSeparatorFromCurrentTime(timestamp: number, withTime: boolean = false): string {
  let result = "";
  
  if (isToday(timestamp)) {
    result = "Today";
  } else if (isYesterday(timestamp)) {
    result = "Yesterday";
  } else {
    const now = Date.now();
    const diff = now - timestamp;
    const date = new Date(timestamp);
    const nowDate = new Date(now);
    const isSameOrLessThanYear = (date.getFullYear() === nowDate.getFullYear() || diff < MILLI_SECS_IN_DAY * 363);
    
    if (isSameOrLessThanYear) {
      result = formatDate(timestamp, "MMM d");
    } else {
      result = formatDate(timestamp, "M/d/yy");
    }
    result = result.toUpperCase();
  }
  
  if (withTime) {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    
    if (result.length) {
      result += ", ";
    }
    result += `${displayHours}:${displayMinutes} ${ampm}`;
  }
  
  return result;
}

/**
 * Checks if two timestamps are on different days
 * Matches AngularJS datetimeService.isDayDiff()
 */
export function isDayDiff(tsThis: number, tsBefore: number): boolean {
  const dateThis = formatDate(tsThis, "MMM d,yyyy");
  const dateBefore = formatDate(tsBefore, "MMM d,yyyy");
  return dateThis !== dateBefore;
}











