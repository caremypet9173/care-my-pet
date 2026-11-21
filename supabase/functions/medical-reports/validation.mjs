import {measurementValueType,validMeasurementValue} from './value-type.mjs';
export const MAX_FILE = 12 * 1024 * 1024;
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const mimeExtensions = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01'
    && value <= new Date().toISOString().slice(0,10) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function validateReport(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.rows) || input.rows.length > 100) return null;
  const text = (v,max,required=false) => typeof v === 'string' && v.trim().length <= max && (!required || v.trim().length>0) ? v.trim() : null;
  const ai_interpretation = input.ai_interpretation === undefined || input.ai_interpretation === null
    ? ''
    : text(input.ai_interpretation, 12000);
  if (ai_interpretation === null) return null;
  const value = { title:text(input.title,160,true),test_date:input.test_date,laboratory:text(input.laboratory,160),doctor:text(input.doctor,160),notes:text(input.notes,12000),ai_interpretation,rows:[] };
  if (!validDate(value.test_date) || Object.values(value).some(v=>v===null)) return null;
  for (const row of input.rows) {
    if (!row || !['blood','renal','liver','other'].includes(row.category)) return null;
    const result = {name:text(row.name,100,true),value:text(row.value,60,true),unit:text(row.unit,40),reference:text(row.reference,100),category:row.category};
    if (Object.values(result).some(v=>v===null)) return null;
    if (!validMeasurementValue(result.value,measurementValueType(result))) return null;
    value.rows.push(result);
  }
  return value;
}
export function fileMatches(bytes,mime) {
  if (!bytes.length || bytes.length>MAX_FILE) return false;
  if (mime==='application/pdf') return new TextDecoder().decode(bytes.slice(0,5))==='%PDF-';
  if (mime==='image/jpeg') return bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  if (mime==='image/png') return [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
  return false;
}

const VALID_REPORT_DOC_TYPES = new Set(['veterinary_report', 'human_lab_report', 'non_medical', 'unreadable']);
const VALID_DISCHARGE_DOC_TYPES = new Set(['veterinary_discharge', 'human_lab_report', 'non_medical', 'unreadable']);

export function classifyDocumentGate(extracted, mode = 'report') {
  const allowed = mode === 'discharge' ? VALID_DISCHARGE_DOC_TYPES : VALID_REPORT_DOC_TYPES;
  const fallbackAllow = mode === 'discharge' ? 'veterinary_discharge' : 'veterinary_report';
  const rawType = typeof extracted?.document_type === 'string' ? extracted.document_type.trim() : '';
  const documentType = allowed.has(rawType) ? rawType : fallbackAllow;
  const reason = typeof extracted?.rejection_reason === 'string'
    ? extracted.rejection_reason.trim().slice(0, 300)
    : '';

  if (documentType === 'non_medical' || documentType === 'unreadable') {
    return { action: 'reject', documentType, reason };
  }
  if (documentType === 'human_lab_report') {
    return { action: 'warn_human', documentType, reason: '' };
  }
  return { action: 'allow', documentType, reason: '' };
}
