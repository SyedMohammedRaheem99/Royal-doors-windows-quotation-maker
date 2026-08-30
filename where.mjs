import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
const BASE="http://localhost:3000";
const [,,email,password]=process.argv;
const ids={ "1":"6a948cfb60f9c374dd2a4c1e", "5":"6a948cfd60f9c374dd2a4c20",
            "14":"6a948e6b60f9c374dd2a4c2c", "25":"6a948e6e60f9c374dd2a4c2e", "50":"6a948e7160f9c374dd2a4c30" };
const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(`${BASE}/login`,{waitUntil:"networkidle"});
await p.fill("#email",email); await p.fill("#password",password);
await p.click('button:has-text("Sign in")'); await p.waitForURL("**/dashboard",{timeout:15000});
for(const [n,id] of Object.entries(ids)){
  await p.goto(`${BASE}/quotations/${id}/print`,{waitUntil:"networkidle"}).catch(()=>{});
  if(!p.url().includes("/print")){console.log(n,"skip");continue;}
  await p.waitForTimeout(250);
  const buf=await p.pdf({format:"A4",printBackground:true,preferCSSPageSize:true});
  const doc=await pdfjs.getDocument({data:new Uint8Array(buf)}).promise;
  const marks=[];
  for(let i=1;i<=doc.numPages;i++){
    const t=(await (await doc.getPage(i)).getTextContent()).items.map(x=>x.str).join(" ").replace(/\s+/g," ");
    const has=[];
    if(/S\.NO|DESCRIPTION/i.test(t)) has.push("table");
    if(/GRAND TOTAL/i.test(t)) has.push("totals");
    if(/SPECIFICATION/i.test(t)) has.push("terms");
    if(/PAYMENT SCHEDULE/i.test(t)) has.push("pay");
    if(/CUSTOMER ACCEPTANCE/i.test(t)) has.push("accept");
    marks.push(`p${i}[${has.join(",")||"-"}]`);
  }
  console.log(`${String(n).padStart(3)} items -> ${doc.numPages}pg  ${marks.join(" ")}`);
}
await b.close();
