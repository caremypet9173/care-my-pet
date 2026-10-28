import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateReport,fileMatches,MAX_FILE} from '../supabase/functions/medical-reports/validation.mjs';
import {rangeStatus,numeric,sameParameter} from '../src/features/medical/comparison.ts';
const row={name:'CREA',value:'1,7',unit:'mg/dl',reference:'0,8–1,6',category:'renal'};
const report={title:'Blood test',test_date:'2026-09-15',laboratory:'Lab',doctor:'',notes:'',rows:[row]};
test('preserves source qualifiers and text rather than silently coercing numbers',()=>{
 assert.equal(validateReport({...report,rows:[{...row,value:'<0,5'}]}).rows[0].value,'<0,5');
 assert.equal(numeric('<0,5'),null);assert.equal(numeric('1,7'),1.7);
 assert.equal(rangeStatus(row),'above');assert.equal(rangeStatus({...row,value:'<0,5'}),'unknown');
 assert.equal(rangeStatus({...row,reference:'8–1'}),'unknown');assert.equal(rangeStatus({...row,reference:'see note'}),'unknown');
 assert.equal(rangeStatus({...row,value:'0,8'}),'within');
 assert.equal(sameParameter(row,{...row,unit:'umol/l'}),false);
});
test('rejects impossible dates, oversized reports and blank required values',()=>{
 for(const patch of [{test_date:'2026-02-30'},{test_date:'2100-01-01'},{title:' '},{rows:Array(101).fill(row)},{notes:'x'.repeat(12001)},{ai_interpretation:'x'.repeat(12001)},{rows:[{...row,value:' '}]}])assert.equal(validateReport({...report,...patch}),null);
 assert.equal(validateReport({...report,rows:[]}).rows.length,0);
 assert.equal(validateReport({...report,ai_interpretation:'Analiza'}).ai_interpretation,'Analiza');
});
test('checks file signature, MIME and byte limit independently',()=>{
 assert.equal(fileMatches(Buffer.from('%PDF-1.4\n'),'application/pdf'),true);
 assert.equal(fileMatches(Buffer.from('<svg />'),'image/png'),false);
 assert.equal(fileMatches(Buffer.from('%PDF-1.4\n'),'text/html'),false);
 const oversized=Buffer.alloc(MAX_FILE+1);oversized.write('%PDF-');assert.equal(fileMatches(oversized,'application/pdf'),false);
});
