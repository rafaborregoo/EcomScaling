import assert from "node:assert/strict";
import { test } from "node:test";
import { agentOutputDecisionSchema } from "./agent-approval.js";

test("approval permits bounded human edits and one-proposal dismissal",()=>{
  assert.equal(agentOutputDecisionSchema.safeParse({decision:"approved",edits:[{index:0,title:"Revisar costes",priority:"high"}]}).success,true);
  assert.equal(agentOutputDecisionSchema.safeParse({decision:"dismiss_proposal",edits:[{index:1,skip:true}]}).success,true);
});
test("caller cannot supply scope, executor fields, receipt, duplicate indexes or unbounded edits",()=>{
  for(const bad of [
    {decision:"approved",organization_id:"foreign"}, {decision:"approved",receipt_id:"invented"},
    {decision:"approved",edits:[{index:0,store_id:"foreign"}]},
    {decision:"approved",edits:[{index:0,kind:"publish_ad"}]},
    {decision:"approved",edits:[{index:0},{index:0}]},
    {decision:"approved",edits:[{index:0,description:"x".repeat(12001)}]},
    {decision:"approved",edits:"invalid"}, {decision:"dismiss_proposal",edits:[{index:0}]},
    {decision:"approved",reason_category:"incorrecto"},
  ])assert.equal(agentOutputDecisionSchema.safeParse(bad).success,false);
});
