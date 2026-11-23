// Preserve source strings and decimal separators; never coerce prose to a number.
export const decimalValue = /^(?:[<>]=?|[≤≥])?\s*[+-]?\d+(?:[.,]\d+)?$/;
const decimalRange = /^[+-]?\d+(?:[.,]\d+)?\s*[-–—]\s*[+-]?\d+(?:[.,]\d+)?$/;
export function measurementValueType(row) {
  if (row.value_type === 'decimal' || row.value_type === 'text') return row.value_type;
  return decimalValue.test(row.value.trim()) || decimalRange.test(row.reference.trim()) || decimalValue.test(row.reference.trim()) ? 'decimal' : 'text';
}
export function validMeasurementValue(value, type) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 60
    && (type === 'text' || type === 'decimal' && decimalValue.test(value.trim()));
}
