import {test} from 'node:test';
import assert from 'node:assert/strict';
import {measurementValueType,validMeasurementValue} from '../supabase/functions/medical-reports/value-type.mjs';
test('numeric parameters reject arbitrary prose but preserve laboratory qualifiers',()=>{
 for(const value of ['1,7','1.7','0','-1.2','<0,5','>=10','≤ 0.2'])assert.equal(validMeasurementValue(value,'decimal'),true,value);
 for(const value of ['abc','1.2.3','NaN','Infinity','1 mg/dl','','1,2,3'])assert.equal(validMeasurementValue(value,'decimal'),false,value);
});
test('type is fixed by the stored source, not an edited value or parameter name alone',()=>{
 assert.equal(measurementValueType({value_type:'decimal',value:'abc',reference:''}),'decimal');
 assert.equal(measurementValueType({name:'Białko',value:'abc',reference:'5–8'}),'decimal');
 assert.equal(measurementValueType({name:'Białko',value:'nie wykryto',reference:''}),'text');
 assert.equal(validMeasurementValue('nie wykryto','text'),true);
});
