(() => {
"use strict";
const API="/api/admin/legitimate-products", byId=id=>document.getElementById(id);
const form=byId("productForm"),list=byId("productList"),message=byId("lpMessage");let products=[];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const countryCodes={"United States":"US","United Kingdom":"GB","Canada":"CA","Australia":"AU","Germany":"DE","France":"FR","India":"IN"};
const countryEntries=Object.entries(countryCodes);
const countryByCode=Object.fromEntries(countryEntries.map(([name,code])=>[code,name]));
const normalizeCountry=value=>String(value||"").trim().toLowerCase();
function countryCodeFor(value){const v=normalizeCountry(value);const match=countryEntries.find(([name,code])=>normalizeCountry(name)===v||code.toLowerCase()===v);return match?match[1]:"";}
function countryNameFor(value){const v=String(value||"").trim().toUpperCase();return countryByCode[v]||countryEntries.find(([name])=>normalizeCountry(name)===normalizeCountry(value))?.[0]||"";}
function setupCountryAutocomplete(){
 const market=byId("market"),code=byId("intendedCountry");
 const marketList=byId("marketCountryOptions")||document.createElement("datalist");
 marketList.id="marketCountryOptions";
 marketList.innerHTML=countryEntries.map(([name,countryCode])=>'<option value="'+esc(name)+'" label="'+countryCode+'"></option>').join("");
 if(!marketList.parentNode)document.body.appendChild(marketList);
 market.setAttribute("list",marketList.id);
 const codeList=byId("countryCodeOptions")||document.createElement("datalist");
 codeList.id="countryCodeOptions";
 codeList.innerHTML=countryEntries.map(([name,countryCode])=>'<option value="'+countryCode+'" label="'+esc(name)+'"></option>').join("");
 if(!codeList.parentNode)document.body.appendChild(codeList);
 code.setAttribute("list",codeList.id);
 market.addEventListener("input",()=>{const match=countryEntries.find(([name])=>normalizeCountry(name)===normalizeCountry(market.value));if(match)code.value=match[1];});
 market.addEventListener("change",()=>{const match=countryEntries.find(([name])=>normalizeCountry(name)===normalizeCountry(market.value));if(match)code.value=match[1];});
 code.addEventListener("input",()=>{const name=countryNameFor(code.value);if(name)market.value=name;});
 code.addEventListener("change",()=>{const name=countryNameFor(code.value);if(name){market.value=name;code.value=countryCodeFor(name);}});
}
async function request(url,options={}){const response=await fetch(url,{credentials:"same-origin",...options,headers:{"Accept":"application/json",...(options.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||("Request failed ("+response.status+")"));return data;}
function clearForm(){form.reset();byId("productId").value="";byId("quality").value="Very High";byId("description").value="Good";byId("formHeading").textContent="Add a product";}
function editProduct(id){const p=products.find(x=>Number(x.id)===Number(id));if(!p)return;byId("productId").value=p.id;byId("name").value=p.name;byId("market").value=p.market||"";byId("state").value=p.state||"";byId("format").value=p.format||"digital";byId("price").value=p.price;byId("seller").value=p.seller||"";byId("quality").value="Very High";byId("productCode").value=p.product_code||"";byId("expiry").value=p.expiry||"";byId("intendedCountry").value=p.intended_country||countryCodeFor(p.market)||"";byId("refundPeriod").value=String(p.refund_period??0);byId("status").value=p.status;byId("description").value=p.description||"Good";byId("formHeading").textContent="Edit product #"+p.product_code;window.scrollTo({top:0,behavior:"smooth"});}
function render(){if(!products.length){list.textContent="No products have been added.";return;}list.innerHTML=products.map(p=>'<article class="lp-item"><div><strong>'+esc(p.name)+'</strong><p>'+esc(p.seller)+' · '+esc(p.quality)+' · '+esc(p.product_code)+' · '+esc(p.market)+', '+esc(p.state)+' · $'+Number(p.price).toFixed(2)+'</p><span class="lp-status">'+esc(p.status)+'</span></div><div class="lp-actions"><button class="lp-button secondary" type="button" data-edit="'+Number(p.id)+'">Edit</button><button class="lp-button secondary" type="button" data-delete="'+Number(p.id)+'">Delete</button></div></article>').join("");}
async function load(){try{const data=await request(API);products=Array.isArray(data.products)?data.products:[];render();}catch(error){list.textContent=error.message;}}
function currentProduct(){return {id:byId("productId").value||null,name:byId("name").value,market:byId("market").value,state:byId("state").value,format:byId("format").value,seller:byId("seller").value,quality:"Very High",price:byId("price").value,product_code:byId("productCode").value,expiry:byId("expiry").value,status:byId("status").value,intended_country:countryCodeFor(byId("market").value)||countryCodeFor(byId("intendedCountry").value),refund_period:byId("refundPeriod").value,description:byId("description").value};}
form.addEventListener("submit",async event=>{event.preventDefault();message.textContent="Saving…";const product=currentProduct();const expected=countryCodeFor(product.market);if(!expected){message.textContent="Choose a supported country from the Market suggestions.";return;}product.intended_country=expected;try{await request(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save",product})});message.textContent="Product saved.";clearForm();await load();}catch(error){message.textContent=error.message;}});
byId("resetForm").addEventListener("click",()=>{clearForm();message.textContent="";});
list.addEventListener("click",async event=>{const edit=event.target.closest("[data-edit]"),del=event.target.closest("[data-delete]");if(edit){editProduct(edit.dataset.edit);return;}if(del&&window.confirm("Delete this product permanently?")){try{await request(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"delete",id:del.dataset.delete})});message.textContent="Product deleted.";await load();}catch(error){message.textContent=error.message;}}});

const publishAllButton=byId("publishAllDrafts");
if(publishAllButton){
 publishAllButton.addEventListener("click",async()=>{
  const draftCount=products.filter(p=>p.status==="draft").length;
  if(!draftCount){message.textContent="There are no draft products to publish.";return;}
  const prompt="Publish all "+draftCount+" draft products to the customer-facing legitimate catalogue? This cannot be undone here.";
  if(!window.confirm(prompt))return;
  publishAllButton.disabled=true;message.textContent="Validating and publishing drafts…";
  try{
   const result=await request("/api/admin/legitimate-products/publish-all-drafts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({})});
   message.textContent=result.published+" products published.";
   await load();
  }catch(error){message.textContent=error.message;await load();}
  finally{publishAllButton.disabled=false;}
 });
}

const csvFile=byId("csvFile"),csvPreview=byId("csvPreview"),csvMessage=byId("csvMessage"),previewButton=byId("previewCsv"),importButton=byId("importCsv");
let csvRows=[];
function parseCsv(text){
 const rows=[];let row=[],field="",quoted=false;
 for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}else if(ch==='"'){quoted=false;}else{field+=ch;}}else if(ch==='"'&&field===""){quoted=true;}else if(ch===","){row.push(field);field="";}else if(ch==="\n"){row.push(field);rows.push(row);row=[];field="";}else if(ch==="\r"){if(text[i+1]==="\n")i++;row.push(field);rows.push(row);row=[];field="";}else{field+=ch;}}
 if(quoted)throw new Error("CSV contains an unclosed quoted field.");if(field!==""||row.length){row.push(field);rows.push(row);}return rows.filter(r=>r.some(v=>String(v).trim()!==""));
}
function resetCsv(){csvRows=[];csvPreview.innerHTML="";importButton.disabled=true;}
function normalizeFormat(value){return String(value||"").trim();}
function normalizeExpiry(value){
 const v=String(value||"").trim();
 let m=v.match(/^(0?[1-9]|1[0-2])[\/. -](\d{2}|\d{4})$/);
 if(m)return String(m[1]).padStart(2,"0")+"/"+(m[2].length===2?"20"+m[2]:m[2]);
 m=v.match(/^(\d{4})-(0?[1-9]|1[0-2])(?:-\d{1,2})?$/);
 if(m)return String(m[2]).padStart(2,"0")+"/"+m[1];
 m=v.match(/^(0?[1-9]|1[0-2])-(\d{4})-(?:\d{1,2})$/);
 if(m)return String(m[1]).padStart(2,"0")+"/"+m[2];
 return v;
}
const expected=["product","market","state","format","seller","quality","price","id","expiry","status","intended_country","refund_period","description"];
previewButton.addEventListener("click",async()=>{
 resetCsv();csvMessage.textContent="";const file=csvFile.files&&csvFile.files[0];if(!file){csvMessage.textContent="Choose a CSV file first.";return;}if(file.size>120*1024){csvMessage.textContent="CSV is too large. Keep it under 120 KB.";return;}
 try{
  const parsed=parseCsv((await file.text()).replace(/^\uFEFF/,""));const headers=(parsed.shift()||[]).map(x=>x.trim().toLowerCase().replace(/\s+/g,"_"));
  if(headers.length!==expected.length||expected.some((h,i)=>headers[i]!==h))throw new Error("CSV headers must be exactly: Product, Market, State, Format, Seller, Quality, Price, ID, Expiry, Status, Intended country, Refund period, Description.");
  if(!parsed.length)throw new Error("The CSV has no product rows.");if(parsed.length>200)throw new Error("Maximum 200 product rows per import.");
  const malformed=parsed.findIndex(values=>values.length!==expected.length);if(malformed!==-1)throw new Error("CSV row "+(malformed+2)+" does not contain exactly "+expected.length+" columns.");
  csvRows=parsed.map((values,index)=>{const row={};expected.forEach((key,i)=>row[key]=String(values[i]??"").trim());row.format=normalizeFormat(row.format);row.expiry=normalizeExpiry(row.expiry);row.quality=row.quality||"Very High";row.status="Draft";return {...row,_row:index+2};});
  const errors=[];const ids=new Set();csvRows.forEach(r=>{if(!r.product||!r.market||!r.state||!r.seller||!r.price||!r.expiry||!r.description)errors.push("Row "+r._row+": missing required field");if(r.quality!=="Very High")errors.push("Row "+r._row+": quality must be Very High");if(!/^(42|47|51|34|37)\d{4}$/.test(r.id))errors.push("Row "+r._row+": ID must be six digits with an approved prefix");if(ids.has(r.id))errors.push("Row "+r._row+": duplicate ID in file");ids.add(r.id);if(countryCodes[r.market]!==String(r.intended_country).toUpperCase())errors.push("Row "+r._row+": intended country does not match Market");if(!/^(0[1-9]|1[0-2])\/\d{4}$/.test(r.expiry))errors.push("Row "+r._row+": Expiry must be MM/YYYY");if(!["0","3"].includes(r.refund_period))errors.push("Row "+r._row+": refund period must be 0 or 3");if(!r.format)errors.push("Row "+r._row+": format is required");});
  const preview=csvRows.slice(0,8);csvPreview.innerHTML='<p><strong>'+csvRows.length+' rows loaded.</strong> Showing first '+preview.length+'. '+(errors.length?errors.length+' validation issue(s) found.':'All client-side checks passed; the server will validate again.')+'</p><div style="overflow-x:auto"><table><thead><tr><th>Row</th><th>Product</th><th>Seller</th><th>Quality</th><th>ID</th><th>Address</th><th>Refund</th><th>Price</th></tr></thead><tbody>'+preview.map(r=>'<tr><td>'+r._row+'</td><td>'+esc(r.product)+'</td><td>'+esc(r.seller)+'</td><td>'+esc(r.quality)+'</td><td>'+esc(r.id)+'</td><td>'+esc(r.market+', '+r.state)+'</td><td>'+esc(r.refund_period)+'</td><td>'+esc(r.price)+'</td></tr>').join("")+'</tbody></table></div>'+(errors.length?'<h3>Validation issues</h3><ul>'+errors.slice(0,30).map(e=>'<li>'+esc(e)+'</li>').join("")+'</ul>':'');
  importButton.disabled=errors.length>0;csvMessage.textContent=errors.length?"Correct the listed issues before importing.":"Preview ready. All rows will be imported as drafts.";
 }catch(error){resetCsv();csvMessage.textContent=error.message;}
});
importButton.addEventListener("click",async()=>{
 if(!csvRows.length)return;if(!window.confirm("Import "+csvRows.length+" products as drafts? Nothing will be published."))return;
 importButton.disabled=true;previewButton.disabled=true;csvMessage.textContent="Importing drafts…";
 try{
  const products=csvRows.map(r=>({name:r.product,market:r.market,state:r.state,format:r.format,seller:r.seller,quality:r.quality,price:r.price,product_code:r.id,expiry:r.expiry,status:"draft",intended_country:r.intended_country,refund_period:r.refund_period,description:r.description}));
  const result=await request("/api/admin/legitimate-products/import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({products})});
  const duplicateCount=(result.duplicates||[]).length,errorCount=(result.errors||[]).length;csvMessage.textContent="Imported "+result.imported+" draft(s). Skipped "+duplicateCount+" duplicate ID(s); "+errorCount+" invalid row(s).";
  const details=[...(result.duplicates||[]).map(x=>"Row "+x.row+": "+x.name+" — "+x.reason),...(result.errors||[]).map(x=>"Row "+x.row+": "+x.error)];if(details.length)csvPreview.innerHTML+='<h3>Skipped rows</h3><ul>'+details.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul>';
  const importedIds=Array.isArray(result.imported_ids)?result.imported_ids:[];
  if(importedIds.length&&window.confirm("Publish these "+importedIds.length+" newly imported products to the customer-facing catalogue now?")){
   csvMessage.textContent="Publishing "+importedIds.length+" imported products…";
   const published=await request("/api/admin/legitimate-products/publish-import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids:importedIds})});
   csvMessage.textContent="Published "+published.published+" products. They are now visible on the customer-facing catalogue.";
  }else{csvMessage.textContent+=" They remain drafts and are not visible to customers.";}
  csvRows=[];csvFile.value="";importButton.disabled=true;await load();
 }catch(error){csvMessage.textContent=error.message;importButton.disabled=false;}finally{previewButton.disabled=false;}
});
setupCountryAutocomplete();
load();
})();