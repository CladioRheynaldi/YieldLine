import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encodeFunctionData } from "viem";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const deployment=JSON.parse(fs.readFileSync(path.join(root,"deployments/anvil.json"),"utf8"));
const abiSource=fs.readFileSync(path.join(root,"packages/shared/src/generated/abis.ts"),"utf8");
const abis=Object.fromEntries([...abiSource.matchAll(/export const (\w+) = ([\s\S]+?) as const;/g)].map(m=>[m[1],JSON.parse(m[2])]));
async function rpc(method,params=[]) {
  const response=await fetch("http://127.0.0.1:8545",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
  const data=await response.json();
  if(data.error) throw Object.assign(new Error(data.error.message),{code:data.error.code});
  return data.result;
}
async function send(from,address,abi,functionName,args) {
  const hash=await rpc("eth_sendTransaction",[{from,to:address,data:encodeFunctionData({abi,functionName,args}),gas:"0x4c4b40"}]);
  await expect.poll(()=>rpc("eth_getTransactionReceipt",[hash])).not.toBeNull();
  const receipt=await rpc("eth_getTransactionReceipt",[hash]);
  expect(receipt.status).toBe("0x1");
  return hash;
}
let accounts;
let snapshot;
test.beforeEach(async()=>{accounts=await rpc("eth_accounts");snapshot=await rpc("evm_snapshot");});
test.afterEach(async()=>{await rpc("evm_revert",[snapshot]);});

async function wallet(page,index=1,wrongNetwork=false) {
  await page.exposeFunction("__walletRpc",async(method,params)=> {
    try { return {result:await rpc(method,params)}; } catch(error) {return {error:{message:error.message,code:error.code}};}
  });
  await page.addInitScript(({account,wrongNetwork})=>{
    const listeners=new Map();
    const state={account,chainId:wrongNetwork?"0x1":"0x7a69",rejectSend:false,failSend:false};
    const emit=(event,value)=>{for(const cb of listeners.get(event)||[])cb(value);};
    window.__wallet={state,emit};
    window.ethereum={
      isMetaMask:true,
      on(event,cb){listeners.set(event,[...(listeners.get(event)||[]),cb]);},
      removeListener(event,cb){listeners.set(event,(listeners.get(event)||[]).filter(f=>f!==cb));},
      async request({method,params=[]}){
        if(method==="eth_requestAccounts"||method==="eth_accounts")return [state.account];
        if(method==="eth_chainId")return state.chainId;
        if(method==="wallet_switchEthereumChain"){state.chainId=params[0].chainId;emit("chainChanged",state.chainId);return null;}
        if(method==="wallet_requestPermissions"||method==="wallet_getPermissions")return [{parentCapability:"eth_accounts"}];
        if(method==="wallet_revokePermissions")return null;
        if(method==="eth_sendTransaction"&&state.rejectSend){state.rejectSend=false;throw Object.assign(new Error("User rejected the request."),{code:4001});}
        if(method==="eth_sendTransaction"&&state.failSend){state.failSend=false;throw Object.assign(new Error("Transaction broadcast failed."),{code:-32000});}
        const answer=await window.__walletRpc(method,params);
        if(answer.error)throw Object.assign(new Error(answer.error.message),{code:answer.error.code});
        return answer.result;
      },
    };
  },{account:accounts[index],wrongNetwork});
}
async function connect(page,url) {
  await page.goto(url);
  const connect=page.getByRole("button",{name:"Connect wallet",exact:true});
  if(await connect.count())await connect.click();
  await expect(page.getByText("Loading onchain state…")).toHaveCount(0);
}
async function switchAccount(page,index) {
  await page.evaluate(address=>{window.__wallet.state.account=address;window.__wallet.emit("accountsChanged",[address]);},accounts[index]);
}
async function form(page,title,value) {
  const form=page.locator("form").filter({has:page.getByRole("heading",{name:title,exact:true})});
  await form.locator("input").fill(value);
  await form.locator('button[type="submit"]').click();
  await expect(form.getByText("Confirmed onchain.")).toBeVisible();
}
async function supplyAndBorrow(page) {
  await wallet(page,1);
  await connect(page,"/lend");
  await form(page,"Supply liquidity","100000");
  await expect(page.getByText("Liquidity supplied",{exact:true})).toBeVisible();
  await switchAccount(page,2);
  await page.getByRole("link",{name:"Borrow",exact:true}).first().click();
  await form(page,"Deposit collateral","100000");
  await form(page,"Borrow liquidity","50000");
}
test("lender and borrower complete UI workflows, interest reads and real history",async({page})=>{
  await supplyAndBorrow(page);
  await rpc("evm_increaseTime",[31536000]);
  await rpc("evm_mine");
  await send(accounts[0],deployment.mockUSDC,abis.mockUsdcAbi,"mint",[accounts[2],10_000n*10n**6n]);
  await send(accounts[0],deployment.mockOracle,abis.mockOracleAbi,"setCurrentPrice",[deployment.mockTBILL,1_050_000_000_000_000_000n]);
  await page.reload();
  await expect(page.getByRole("button",{name:"Approve balance & repay all"})).toBeEnabled();
  const full=page.getByRole("button",{name:"Approve balance & repay all"});
  await full.click();
  await expect(page.getByText("Confirmed onchain.").first()).toBeVisible();
  await form(page,"Withdraw collateral","100000");
  await page.getByRole("link",{name:"Position",exact:true}).first().click();
  await expect(page.getByRole("heading",{name:"Interest accounting"})).toBeVisible();
  await expect(page.getByText("Repayment",{exact:true})).toBeVisible();
  await expect(page.getByText("Collateral withdrawal",{exact:true})).toBeVisible();
  await switchAccount(page,1);
  await page.getByRole("link",{name:"Lend",exact:true}).first().click();
  await expect(page.getByText("Current share value",{exact:true})).toBeVisible();
  const redeem=page.locator("form").filter({has:page.getByRole("heading",{name:"Withdraw liquidity",exact:true})});
  await redeem.getByRole("button",{name:"Max",exact:true}).click();
  await redeem.locator('button[type="submit"]').click();
  await expect(redeem.getByText("Confirmed onchain.")).toBeVisible();
  await expect(page.getByText("Liquidity withdrawn",{exact:true})).toBeVisible();
});
test("wrong network blocks writes and switching restores the action",async({page})=>{
  await wallet(page,1,true);
  await connect(page,"/lend");
  await expect(page.getByRole("button",{name:/Switch to Anvil/})).toBeVisible();
  await expect(page.getByRole("button",{name:"Approve & supply"})).toBeDisabled();
  await page.getByRole("button",{name:/Switch to Anvil/}).click();
  await expect(page.getByRole("button",{name:"Approve & supply"})).toBeEnabled();
});
test("wallet rejection and broadcast failure keep the form recoverable",async({page})=>{
  await wallet(page);
  await connect(page,"/lend");
  const supply=page.locator("form").filter({has:page.getByRole("heading",{name:"Supply liquidity",exact:true})});
  await supply.locator("input").fill("100");
  await page.evaluate(()=>{window.__wallet.state.rejectSend=true;});
  await supply.locator('button[type="submit"]').click();
  await expect(supply.getByRole("alert")).toContainText("rejected");
  await page.evaluate(()=>{window.__wallet.state.failSend=true;});
  await supply.locator('button[type="submit"]').click();
  await expect(supply.getByRole("alert")).toBeVisible();
  await expect(supply.locator('button[type="submit"]')).toBeEnabled();
  await supply.locator('button[type="submit"]').click();
  await expect(supply.getByText("Confirmed onchain.")).toBeVisible();
});
test("pending transactions show confirmation before success",async({page})=>{
  await wallet(page);
  await connect(page,"/lend");
  const supply=page.locator("form").filter({has:page.getByRole("heading",{name:"Supply liquidity",exact:true})});
  await supply.locator("input").fill("100");
  await rpc("anvil_setAutomine",[false]);
  try {
    await supply.locator('button[type="submit"]').click();
    await expect(supply.getByText(/Waiting for.*confirm/)).toBeVisible();
    await rpc("evm_mine");
    await rpc("anvil_setAutomine",[true]);
    await expect(supply.getByText("Confirmed onchain.")).toBeVisible();
  } finally {await rpc("anvil_setAutomine",[true]);}
});
test("mobile layout and unavailable production data stay distinct from mock positions",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route("**/api/openeden",route=>route.fulfill({json:{status:"unavailable",message:"Production RPC unavailable. No mock fallback is shown.",observedAt:new Date().toISOString()}}));
  await wallet(page);
  await connect(page,"/markets");
  const panel=page.getByRole("region",{name:"OpenEden production reference"});
  await expect(panel).toContainText("Arbitrum One");
  await expect(panel).toContainText("Unavailable");
  await expect(panel).toContainText("No mock fallback");
  await expect(panel.getByRole("button",{name:/deposit|borrow|approve|redeem/i})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:"test-results/mobile-markets.png",fullPage:true});
});
