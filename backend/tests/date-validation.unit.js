import assert from 'node:assert/strict';
import express from 'express';
import { isValidDate, validateDateFields, validateDates } from '../src/middleware/validateDates.js';

for (const date of ['2026-09-17', '2024-02-29', '2000-02-29', '1000-01-01', '9999-12-31']) assert.equal(isValidDate(date), true, date);
for (const date of ['200001-09-17', '17-09-2026', '2026/09/17', '2026-9-7', '2026-02-29', '1900-02-29', '2026-04-31', '2026-00-10', '2026-13-01', '2026-01-00', '0000-01-01', '0999-01-01', '2026-09-17garbage', 20260917]) assert.equal(isValidDate(date), false, String(date));
assert.equal(isValidDate('2026-09-17T23:59',true),true);
assert.equal(isValidDate('2026-09-17T24:00',true),false);
assert.equal(isValidDate('2026-09-17T12:60',true),false);
assert.equal(isValidDate('2026-09-17T12:20:61',true),false);
assert.doesNotThrow(() => validateDateFields({ requiredDate: '', installationDate: null, notes: '17/9/2026', candidate: 'not a date' }));
assert.throws(() => validateDateFields({ items: [{ drawingRevisionDate: '2026-02-30' }] }), /items.0.drawingRevisionDate/);
assert.throws(() => validateDateFields({ suppliers: [{ effectiveFrom: '200001-09-17' }] }), /effectiveFrom/);
assert.throws(() => validateDateFields({ expectedDelivery: '31-12-2026' }), /expectedDelivery/);
assert.throws(() => validateDateFields({ entryDateTime: '2026-09-17T30:00' }), /entryDateTime/);

const app=express(); app.use(express.json()); app.use(validateDates);
app.post('/test',(_req,res)=>res.json({success:true}));
app.get('/test',(_req,res)=>res.json({success:true}));
app.use((err,_req,res,_next)=>res.status(err.statusCode || 400).json({message:err.message}));
const server=app.listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
try {
  const url=`http://127.0.0.1:${server.address().port}/test`;
  assert.equal((await fetch(url+'?dateFrom=200001-09-17')).status,400);
  for (const token of ['ALL','TODAY','OVERDUE','WEEK']) assert.equal((await fetch(url+`?dueDate=${token}`)).status,200);
  assert.equal((await fetch(url+'?dueDate=NOT_A_FILTER')).status,400);
  for(const [payload,status] of [[{requiredDate:'200001-09-17'},400],[{quotationDate:'2026-02-29'},400],[{units:[{installationDate:'2026-04-31'}]},400],[{requiredDate:'2026-09-17'},200]]){
    const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    assert.equal(response.status,status);
  }
  console.log('PASS: real calendar dates, four-digit years, leap years, date/time bounds, optional dates, nested fields and HTTP rejection.');
} finally {server.close();}
