export const decimalValue: RegExp;
export function measurementValueType(row:{value:string;reference:string;value_type?:'decimal'|'text'}):'decimal'|'text';
export function validMeasurementValue(value:string,type:'decimal'|'text'):boolean;
