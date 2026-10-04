import test from "node:test";
import assert from "node:assert/strict";
import { borrowerInterest, lenderCashFlows, readHistoryPage } from "../lib/history.ts";
import { readOpenEdenReference, OPENEDEN_REFERENCE } from "../lib/openeden.ts";

const row = (event,args,blockNumber=1n) => ({event,args,blockNumber,logIndex:0,amount:0n,decimals:6,unit:"mUSDC",id:event+blockNumber,hash:"0x"+"1".repeat(64),label:event,timestamp:1n});
test("lender cash flows include paid withdrawals and unrealized shares", () => {
  assert.deepEqual(lenderCashFlows([row("Deposit",{assets:100_000n}),row("Withdraw",{assets:20_000n})],true,83_500n),{deposits:100_000n,withdrawals:20_000n,netResult:3_500n});
});
test("partial histories and share transfers cannot invent earnings", () => {
  assert.equal(lenderCashFlows([],false,100n),null);
  assert.equal(lenderCashFlows([row("Transfer",{})],true,100n),null);
});
test("recognized losses produce a negative lender result", () => {
  assert.equal(lenderCashFlows([row("Deposit",{assets:100_000n})],true,90_000n).netResult,-10_000n);
});
test("borrower gross interest includes repayment and live debt", () => {
  const records=[row("Borrowed",{amount:50_000n,debtAfter:50_000n}),row("Repaid",{amount:20_000n,debtAfter:33_500n},2n)];
  assert.equal(borrowerInterest(records,true,33_750n),3_750n);
});
test("settlement interest includes unpaid debt without double counting initiation", () => {
  const records=[row("Borrowed",{amount:50_000n,debtAfter:50_000n}),row("LiquidationInitiated",{debtAmount:51_000n},2n),row("LiquidationSettled",{debtRepaid:40_000n,badDebt:13_500n},3n)];
  assert.equal(borrowerInterest(records,true,0n),3_500n);
});
test("missing or inconsistent borrower history is unavailable", () => {
  assert.equal(borrowerInterest([],false,5n),null);
  assert.equal(borrowerInterest([row("Borrowed",{amount:50n,debtAfter:50n})],true,0n),null);
});

const account="0x"+"2".repeat(40);
const contracts={creditVault:"0x"+"3".repeat(40),liquidityVault:"0x"+"4".repeat(40)};
test("history records confirmed wallet events and preserves unknown timestamps",async () => {
  const client={
    getBlockNumber:async()=>30n,
    getLogs:async({address})=>address===contracts.creditVault ? [{
      eventName:"Borrowed",args:{borrower:account,amount:50n,debtAfter:50n},
      blockNumber:22n,transactionHash:"0x"+"1".repeat(64),logIndex:0,removed:false,
    }]:[],
    getBlock:async()=>{throw new Error("timestamp RPC unavailable");},
  };
  const page=await readHistoryPage(client,contracts,account,10n);
  assert.equal(page.rows.length,1);
  assert.equal(page.rows[0].timestamp,null);
  assert.equal(page.nextBlock,null);
});
test("network failures are not recursively retried as range errors",async()=>{
  let calls=0;
  const client={getBlockNumber:async()=>30n,getLogs:async()=>{calls++;throw new Error("Network offline");}};
  await assert.rejects(readHistoryPage(client,contracts,account,10n),/Network offline/);
  assert.equal(calls,2);
});
function referenceClient({old=false,wrongChain=false,changedOracle=false,invalid=false}={}) {
  const now=BigInt(Math.floor(Date.now()/1000));
  return {
    getChainId:async()=>wrongChain?31337:42161,
    getBlock:async()=>({number:100n,timestamp:now}),
    readContract:async({functionName})=>{
      if(functionName==="symbol")return "TBILL";
      if(functionName==="totalSupply")return 1_000_000n;
      if(functionName==="tbillUsdPriceFeed")return changedOracle?account:OPENEDEN_REFERENCE.oracle;
      if(functionName==="decimals")return 6;
      if(functionName==="latestRoundData")return [1n,invalid?0n:1_050_000n,now,old?now-4n*86400n:now,1n];
      throw new Error("Unexpected read");
    },
  };
}
test("reference displays only verified production network and oracle data",async()=>{
  const result=await readOpenEdenReference(referenceClient());
  assert.equal(result.status,"available");
  assert.equal(result.nav,"1050000");
});
test("old production NAV is explicitly stale",async()=>{
  assert.equal((await readOpenEdenReference(referenceClient({old:true}))).status,"stale");
});
test("wrong network, changed oracle and invalid rounds have no mock fallback",async()=>{
  for(const params of [{wrongChain:true},{changedOracle:true},{invalid:true}]){
    const result=await readOpenEdenReference(referenceClient(params));
    assert.equal(result.status,"unavailable");
    assert.equal(result.nav,undefined);
  }
});

test("RPC rate limits stop without multiplying log requests",async()=>{
  let calls=0;
  const client={getBlockNumber:async()=>10_000n,getLogs:async()=>{calls++;throw new Error("HTTP 429: rate limit exceeded");}};
  await assert.rejects(readHistoryPage(client,contracts,account,10n),/429/);
  assert.equal(calls,2);
});
