import assert from "node:assert/strict";
import test from "node:test";
import { generateOverlaySlides } from "./overlay-generation";
test("carousel retains successful slides and retries only the failed slide", async () => {
  const completed=new Set<number>(),calls:number[]=[],applied:number[]=[];
  const first=await generateOverlaySlides([0,1,2],completed,async index=>{calls.push(index);return index===2?null:[`copy-${index}`]},index=>applied.push(index));
  assert.equal(first,false);assert.deepEqual(applied,[0,1]);
  const next=await generateOverlaySlides([0,1,2],completed,async index=>{calls.push(index);return [`copy-${index}`]},index=>applied.push(index));
  assert.equal(next,true);assert.deepEqual(calls,[0,1,2,2]);assert.deepEqual(applied,[0,1,2]);
});
