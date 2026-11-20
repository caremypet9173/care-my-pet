import {test,expect} from '@playwright/test';
import {readFile,appendFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {createClient} from '@supabase/supabase-js';
import AxeBuilder from '@axe-core/playwright';
test.use({trace:'off',screenshot:'off',video:'off'});
test('weight create, edit, validation and persistence',async({page},info)=>{
 const hydrationErrors:string[]=[];
 page.on('pageerror',error=>{if(/hydration|server rendered HTML/i.test(error.message))hydrationErrors.push(error.message);});
 test.setTimeout(120000);test.skip(!process.env.PETS_TEST_CREDENTIALS,'Requires test credentials');
 const credentials=JSON.parse(await readFile(process.env.PETS_TEST_CREDENTIALS!,'utf8'));
 const env=parseEnv(await readFile('.env.local','utf8'));
 const client=createClient(env.NEXT_PUBLIC_SUPABASE_URL!,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false}});
 expect((await client.auth.signInWithPassword(credentials)).error).toBeNull();
 const {data,error}=await client.functions.invoke('pets',{body:{action:'create',pet:{imie:`TEST WEIGHT ${info.project.name}`,gatunek:'cat',rasa:null,data_urodzenia:null,plec:'unknown',kastracja:null,identyfikacja:'unknown',numer_id:null,notatki:null}}});expect(error).toBeNull();
 const pet=data.pet;await appendFile('tmp/weight-test-fixtures.jsonl',JSON.stringify({pet_id:pet.id})+'\n');
 await page.goto('/pl/login');await page.getByLabel('Adres e-mail').fill(credentials.email);await page.getByLabel('Hasło',{exact:true}).fill(credentials.password);await page.getByRole('button',{name:'Zaloguj się',exact:true}).click();await expect(page).toHaveURL(/\/pl\/app$/,{timeout:20000});await page.getByRole('button',{name:'Rozumiem',exact:true}).click();
 await page.goto(`/pl/app/pets/${pet.id}?tab=weight`);
 await page.getByRole('button',{name:'Dodaj pomiar',exact:false}).first().click();
 const dialog=page.getByRole('dialog');await dialog.locator('#weight-kg').fill('abc');await expect(dialog.locator('#weight-kg')).toHaveValue('');
 await dialog.locator('#weight-kg').fill('0');await dialog.getByRole('button',{name:'Zapisz pomiar',exact:true}).click();await expect(dialog.getByRole('alert')).toBeVisible();
 await dialog.locator('#weight-kg').fill('4,4');await dialog.locator('#weight-date').fill('2026-10-05');await dialog.getByRole('button',{name:'Anuluj'}).click();
 expect((await client.from('pet_weight').select('id').eq('pet_id',pet.id)).data).toEqual([]);
 for(const [kg,date] of [['4,4','2026-10-05'],['4,25','2026-10-18']]){
  await page.getByRole('button',{name:'Dodaj pomiar',exact:false}).first().click();await dialog.locator('#weight-kg').fill(kg);await dialog.locator('#weight-date').fill(date);
  expect((await new AxeBuilder({page}).include('.weight-dialog').analyze()).violations).toEqual([]);
  await page.screenshot({path:`tmp/weight-dialog-${info.project.name}.png`});
  const response=page.waitForResponse(r=>r.url().includes('/functions/v1/pet-weight')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Zapisz pomiar',exact:true}).click();const saved=await response;expect(saved.status()).toBe(200);
  expect((await client.functions.invoke('pet-weight',{body:saved.request().postDataJSON()})).error).toBeNull();await expect(dialog).not.toBeVisible();
 }
 await page.reload();await page.getByRole('button',{name:'Edytuj',exact:false}).first().click();await expect(dialog.locator('#weight-kg')).toHaveValue('4,25');await dialog.locator('#weight-kg').fill('4,3');await dialog.locator('#weight-note').fill('Synthetic test note');
 const response=page.waitForResponse(r=>r.url().includes('/functions/v1/pet-weight')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Zapisz zmiany'}).click();const edited=await response;expect(edited.status()).toBe(200);const body=edited.request().postDataJSON();
 expect((await client.functions.invoke('pet-weight',{body})).error?.context.status).toBe(409);
 for(const measurement of [{kg:'abc',measured_on:'2026-10-18',note:''},{kg:'4',measured_on:'2099-01-01',note:''}])expect((await client.functions.invoke('pet-weight',{body:{...body,measurement}})).error?.context.status).toBe(400);
 await expect(dialog).not.toBeVisible();await page.reload();await expect(page.getByText('Synthetic test note',{exact:true})).toBeVisible();
 expect((await client.from('pet_weight').select('id').eq('pet_id',pet.id)).data).toHaveLength(2);
 expect(hydrationErrors).toEqual([]);
 expect((await new AxeBuilder({page}).include('main').analyze()).violations).toEqual([]);
 if(info.project.name==='desktop')expect(await page.locator('.weight-layout').evaluate(el=>getComputedStyle(el).display)).toBe('grid');
 await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();});
 await page.screenshot({path:`tmp/weight-${info.project.name}.png`,fullPage:true});
 await page.getByRole('button',{name:'Edytuj',exact:false}).first().click();await expect(dialog.locator('#weight-kg')).toHaveValue('4,3');await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
 const remove=page.getByRole('button',{name:'Usuń pomiar',exact:false}).first();
 await remove.click();const confirmation=page.getByRole('dialog',{name:'Usunąć pomiar wagi?'});
 await expect(confirmation).toContainText('4,30');await expect(confirmation.getByRole('button',{name:'Anuluj'})).toBeFocused();
 expect((await new AxeBuilder({page}).include('.weight-delete-dialog').analyze()).violations).toEqual([]);
 await page.screenshot({path:`tmp/weight-delete-${info.project.name}.png`});
 await confirmation.getByRole('button',{name:'Anuluj'}).click();await expect(remove).toBeFocused();expect((await client.from('pet_weight').select('id').eq('pet_id',pet.id)).data).toHaveLength(2);
 await remove.click();await page.keyboard.press('Escape');await expect(confirmation).not.toBeVisible();
 const staleDelete=await client.functions.invoke('pet-weight',{body:{action:'delete',id:body.id,pet_id:pet.id,revision:body.revision}});expect(staleDelete.error?.context.status).toBe(409);
 for(let remaining=1;remaining>=0;remaining--){
  await remove.click();const deleted=page.waitForResponse(r=>r.url().includes('/functions/v1/pet-weight')&&r.request().postDataJSON()?.action==='delete');await confirmation.getByRole('button',{name:'Usuń pomiar',exact:true}).click();expect((await deleted).status()).toBe(200);await expect(confirmation).not.toBeVisible();await expect(page.getByRole('button',{name:'Usuń pomiar',exact:false})).toHaveCount(remaining);
 }
 await page.reload();await expect(page.getByText('Nie ma jeszcze pomiarów wagi',{exact:true})).toBeVisible();expect((await client.from('pet_weight').select('id').eq('pet_id',pet.id)).data).toHaveLength(0);
 await page.setViewportSize({width:320,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
