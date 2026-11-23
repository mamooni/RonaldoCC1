(() => {
"use strict";
const API="/api/admin/legitimate-products", byId=id=>document.getElementById(id);
const form=byId("productForm"),list=byId("productList"),message=byId("lpMessage");let products=[];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function request(url,options={}){const response=await fetch(url,{credentials:"same-origin",...options,headers:{"Accept":"application/json",...(options.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||("Request failed ("+response.status+")"));return data;}
function clearForm(){form.reset();byId("productId").value="";byId("formHeading").textContent="Add a product";}
function editProduct(id){const p=products.find(x=>Number(x.id)===Number(id));if(!p)return;byId("productId").value=p.id;byId("name").value=p.name;byId("category").value=p.category;byId("format").value=p.format;byId("price").value=p.price;byId("seller").value=p.seller||"";byId("imageUrl").value=p.image_url||"";byId("status").value=p.status;byId("description").value=p.description;byId("formHeading").textContent="Edit product #"+p.id;window.scrollTo({top:0,behavior:"smooth"});}
function render(){if(!products.length){list.textContent="No products have been added.";return;}list.innerHTML=products.map(p=>'<article class="lp-item"><div><strong>'+esc(p.name)+'</strong><p>'+esc(p.category)+' · '+esc(p.format)+' · $'+Number(p.price).toFixed(2)+'</p><span class="lp-status">'+esc(p.status)+'</span></div><div class="lp-actions"><button class="lp-button secondary" type="button" data-edit="'+Number(p.id)+'">Edit</button><button class="lp-button secondary" type="button" data-delete="'+Number(p.id)+'">Delete</button></div></article>').join("");}
async function load(){try{const data=await request(API);products=Array.isArray(data.products)?data.products:[];render();}catch(error){list.textContent=error.message;}}
form.addEventListener("submit",async event=>{event.preventDefault();message.textContent="Saving…";const product={id:byId("productId").value||null,name:byId("name").value,category:byId("category").value,format:byId("format").value,price:byId("price").value,seller:byId("seller").value,image_url:byId("imageUrl").value,description:byId("description").value,status:byId("status").value};try{await request(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save",product})});message.textContent="Product saved.";clearForm();await load();}catch(error){message.textContent=error.message;}});
byId("resetForm").addEventListener("click",()=>{clearForm();message.textContent="";});
list.addEventListener("click",async event=>{const edit=event.target.closest("[data-edit]"),del=event.target.closest("[data-delete]");if(edit){editProduct(edit.dataset.edit);return;}if(del&&window.confirm("Delete this product permanently?")){try{await request(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"delete",id:del.dataset.delete})});message.textContent="Product deleted.";await load();}catch(error){message.textContent=error.message;}}});

const csvFile=byId("csvFile"),csvPreview=byId("csvPreview"),csvMessage=byId("csvMessage"),previewButton=byId("previewCsv"),importButton=byId("importCsv");
let csvRows=[];
function parseCsv(text){
 const rows=[];let row=[],field="",quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}else if(ch==='"'){quoted=false;}else{field+=ch;}}
  else if(ch==='"'&&field===""){quoted=true;}
  else if(ch===","){row.push(field);field="";}
  else if(ch==="\\n"){row.push(field);rows.push(row);row=[];field="";}
  else if(ch==="\\r"){if(text[i+1]==="\\n")i++;row.push(field);rows.push(row);row=[];field="";}
  else{field+=ch;}
 }
 if(quoted)throw new Error("CSV contains an unclosed quoted field.");
 if(field!==""||row.length){row.push(field);rows.push(row);}
 return rows.filter(r=>r.some(v=>String(v).trim()!==""));
}
function resetCsv(){csvRows=[];csvPreview.innerHTML="";importButton.disabled=true;}
previewButton.addEventListener("click",async()=>{
 resetCsv();csvMessage.textContent="";
 const file=csvFile.files&&csvFile.files[0];if(!file){csvMessage.textContent="Choose a CSV file first.";return;}
 if(file.size>120*1024){csvMessage.textContent="CSV is too large. Keep it under 120 KB.";return;}
 try{
  const raw=(await file.text()).replace(/^\\uFEFF/,""),parsed=parseCsv(raw);
  const headers=(parsed.shift()||[]).map(x=>x.trim().toLowerCase());
  const expected=["name","description","category","format","seller","price","image_url","status"];
  if(headers.length!==expected.length||expected.some((h,i)=>headers[i]!==h))throw new Error("CSV headers must be exactly: "+expected.join(", "));
  if(!parsed.length)throw new Error("The CSV has no product rows.");
  if(parsed.length>200)throw new Error("Maximum 200 product rows per import.");
  const malformed=parsed.findIndex(values=>values.length!==expected.length);
  if(malformed!==-1)throw new Error("CSV row "+(malformed+2)+" does not contain exactly "+expected.length+" columns.");
  csvRows=parsed.map((values,index)=>{const row={};expected.forEach((key,i)=>row[key]=String(values[i]??"").trim());return {...row,_row:index+2};});
  if(malformed.length)throw new Error("CSV rows have inconsistent columns. Check row "+malformed[0]._row+".");
  const missing=csvRows.filter(r=>!r.name||!r.description||!r.category||!r.price||!["physical","digital","service"].includes(r.format.toLowerCase()));
  const preview=csvRows.slice(0,8);
  csvPreview.innerHTML='<p><strong>'+csvRows.length+' rows loaded.</strong> Showing first '+preview.length+'. '+(missing.length?missing.length+' row(s) need checking for required values or format.':'Required fields appear present; server will validate all rows too.')+'</p><div style="overflow-x:auto"><table><thead><tr><th>Row</th><th>Name</th><th>Category</th><th>Format</th><th>Price</th><th>CSV status</th></tr></thead><tbody>'+preview.map(r=>'<tr><td>'+r._row+'</td><td>'+esc(r.name)+'</td><td>'+esc(r.category)+'</td><td>'+esc(r.format)+'</td><td>'+esc(r.price)+'</td><td>'+esc(r.status)+'</td></tr>').join("")+'</tbody></table></div>';
  importButton.disabled=false;
  csvMessage.textContent="Preview ready. Review your CSV, then import when satisfied.";
 }catch(error){resetCsv();csvMessage.textContent=error.message;}
});
importButton.addEventListener("click",async()=>{
 if(!csvRows.length)return;
 if(!window.confirm("Import "+csvRows.length+" rows as drafts? Existing matching name + category items will be skipped. Nothing will be published."))return;
 importButton.disabled=true;previewButton.disabled=true;csvMessage.textContent="Importing drafts…";
 try{
  const products=csvRows.map(({_row,...item})=>item);
  const result=await request("/api/admin/legitimate-products/import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({products})});
  const duplicateCount=(result.duplicates||[]).length,errorCount=(result.errors||[]).length;
  csvMessage.textContent="Imported "+result.imported+" draft(s). Skipped "+duplicateCount+" duplicate(s); "+errorCount+" invalid row(s). Nothing was published.";
  const details=[...(result.duplicates||[]).map(x=>"Row "+x.row+": "+x.name+" — "+x.reason),...(result.errors||[]).map(x=>"Row "+x.row+": "+x.error)];
  if(details.length)csvPreview.innerHTML+='<h3>Skipped rows</h3><ul>'+details.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul>';
  csvRows=[];csvFile.value="";importButton.disabled=true;await load();
 }catch(error){csvMessage.textContent=error.message;importButton.disabled=false;}
 finally{previewButton.disabled=false;}
});

load();
})();