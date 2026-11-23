import type { Measurement } from "./types";
export function numeric(value:string):number|null {
  const text=value.trim().replace(",",".");
  return /^-?\d+(?:\.\d+)?$/.test(text) && Number.isFinite(Number(text)) ? Number(text) : null;
}
export function rangeStatus(row:Measurement):"within"|"above"|"below"|"unknown" {
  const value=numeric(row.value);
  const match=row.reference.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*[-–—]\s*(-?\d+(?:[.,]\d+)?)$/);
  if(value===null || !match)return "unknown";
  const min=numeric(match[1])!,max=numeric(match[2])!;
  if(min>max)return "unknown";
  return value<min?"below":value>max?"above":"within";
}
export function sameParameter(a:Measurement,b:Measurement){return a.name.trim().toLocaleLowerCase()===b.name.trim().toLocaleLowerCase() && a.unit.trim()===b.unit.trim();}
