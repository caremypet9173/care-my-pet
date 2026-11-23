export function today():string;
export function validateWeight(input:unknown):{errors:{kg?:string;measured_on?:string;note?:string};value:{kg:string;measured_on:string;note:string}|null};
