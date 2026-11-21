import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateReport,fileMatches,MAX_FILE,classifyDocumentGate} from '../supabase/functions/medical-reports/validation.mjs';
import {rangeStatus,numeric,sameParameter} from '../src/features/medical/comparison.ts';
import {isPatientNameMismatch,findMatchingOtherPet} from '../src/features/medical/patient-name-match.ts';
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
test('classifies non-medical, unreadable, human-lab and veterinary documents properly',()=>{
 assert.deepEqual(classifyDocumentGate({document_type:'veterinary_report',rejection_reason:''}),{action:'allow',documentType:'veterinary_report',reason:''});
 assert.deepEqual(classifyDocumentGate({document_type:'human_lab_report',rejection_reason:''}),{action:'warn_human',documentType:'human_lab_report',reason:''});
 const rejected=classifyDocumentGate({document_type:'non_medical',rejection_reason:`  Paragon ze sklepu ${'x'.repeat(400)}  `});
 assert.equal(rejected.action,'reject');
 assert.equal(rejected.documentType,'non_medical');
 assert.equal(rejected.reason.length,300);
 assert.deepEqual(classifyDocumentGate({document_type:'unreadable',rejection_reason:'Rozmazane zdjęcie'},'discharge'),{action:'reject',documentType:'unreadable',reason:'Rozmazane zdjęcie'});
 assert.deepEqual(classifyDocumentGate({document_type:'veterinary_discharge'},'discharge'),{action:'allow',documentType:'veterinary_discharge',reason:''});
});
test('detects pet name mismatches without false positives on Polish diacritics or declensions',()=>{
 assert.equal(isPatientNameMismatch('Maniuś','Maniuś'),false);
 assert.equal(isPatientNameMismatch('Manius, Kowalska','Maniuś'),false);
 assert.equal(isPatientNameMismatch('Maniusia','Maniuś'),false);
 assert.equal(isPatientNameMismatch('','Maniuś'),false);
 assert.equal(isPatientNameMismatch('Kruszyna','Kruszek'),true);
 assert.equal(isPatientNameMismatch('Kruszek, Jan Nowak','Kruszyna'),true);
 const found=findMatchingOtherPet('Kruszyna, Anna Nowak',[{id:'p1',imie:'Burek'},{id:'p2',imie:'Kruszyna'}]);
 assert.equal(found?.id,'p2');
});
