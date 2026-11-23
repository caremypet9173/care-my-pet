// Allow unfinished numbers while editing, but reject letters and a second separator.
export function acceptsNumberInput(value:string,allowQualifier=true){
  return (allowQualifier?/^(?:[<>]=?|[≤≥])?\s*[+-]?\d*(?:[.,]\d*)?$/:/^[+-]?\d*(?:[.,]\d*)?$/).test(value);
}
