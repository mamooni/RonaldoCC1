(() => {
"use strict";
const API="/api/legitimate-products";
const els={
 form:document.getElementById("catalogueFilters"),query:document.getElementById("productQuery"),
 format:document.getElementById("productFormat"),
 rows:document.getElementById("productRows"),count:document.getElementById("resultCount"),
 status:document.getElementById("catalogueStatus"),pager:document.getElementById("productPager")
};
let products=[],page=1;
const clean=v=>String(v??"").trim();
const esc=v=>clean(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const countryFlag=v=>{
 const code=clean(v).toUpperCase();
 if(!/^[A-Z]{2}$/.test(code))return "";
 return String.fromCodePoint(...Array.from(code,char=>127397+char.charCodeAt(0)));
};
const money=v=>{const n=Number(v);return Number.isFinite(n)?"$"+n.toFixed(2):"Price on request";};
const refundDisplay=v=>{const days=Number(v??0);if(Number.isFinite(days)&&days>1)return '<span class="status status--ok" title="'+days+' day refund period">✓</span>';if(Number.isFinite(days)&&days===0)return '<span class="status status--failed" title="No refund period">✕</span>';return esc(days)+ (days===1?" day":" days");};
function filteredProducts(){
 const q=clean(els.query.value).toLowerCase(),format=els.format.value;
 const list=products.filter(p=>{
  const searchable=clean(p.name).toLowerCase();
  return (!q||searchable.includes(q))&&(!format||clean(p.format).toLowerCase()===format);
 });
 list.sort((a,b)=>Number(a.id||0)-Number(b.id||0));
 return list;
}
function render(){
 const list=filteredProducts(),size=25,pages=Math.max(1,Math.ceil(list.length/size));
 page=Math.min(page,pages);const start=(page-1)*size,shown=list.slice(start,start+size);
 els.count.textContent=list.length+(list.length===1?" product":" products");
 if(!shown.length){els.rows.innerHTML='<tr><td colspan="10" class="catalogue__empty">'+(products.length?"No products match those filters.":"No products have been published yet.")+'</td></tr>';}
 else{
  els.rows.innerHTML=shown.map(p=>'<tr><td class="product-name">'+esc(p.name)+'</td><td>'+esc(p.seller)+'</td><td class="quality">'+esc(p.quality||"Very High")+'</td><td class="product-id">'+esc(p.product_code)+'</td><td>'+esc(p.format||"—")+'</td><td>'+esc(p.expiry)+'</td><td>'+(countryFlag(p.intended_country)?'<span class="country-flag" aria-hidden="true">'+countryFlag(p.intended_country)+'</span> ':'')+esc(p.address||[p.market,p.state].filter(Boolean).join(", "))+'</td><td>'+refundDisplay(p.refund_period)+'</td><td class="price">'+money(p.price)+'</td><td class="product-actions"><button class="btn" type="button" data-legit-add="'+esc(p.id||p.product_code)+'">Add to cart</button><button class="btn btn--primary" type="button" data-legit-buy="'+esc(p.id||p.product_code)+'">Buy now</button></td></tr>').join("");
 }
 els.pager.innerHTML="";
 if(pages>1){for(let n=1;n<=pages;n++){const b=document.createElement("button");b.type="button";b.textContent=String(n);if(n===page)b.setAttribute("aria-current","page");b.addEventListener("click",()=>{page=n;render();});els.pager.appendChild(b);}}
}
document.addEventListener("click",e=>{
 const add=e.target.closest("[data-legit-add]");
 const buy=e.target.closest("[data-legit-buy]");
 if(!add&&!buy)return;
 const btn=add||buy,key=btn.getAttribute(add?"data-legit-add":"data-legit-buy");
 const product=products.find(p=>String(p.id||p.product_code)===String(key));
 if(!product)return;
 if(buy){
  if(!product.id){els.status.textContent="This product cannot be checked out right now.";return;}
  window.location.href="legitimate-checkout.html?product="+encodeURIComponent(product.id);
  return;
 }
 if(!window.NLLegitCart)return;
 window.NLLegitCart.add({key:String(product.id||product.product_code),title:product.name,price:product.price});
 const old=btn.textContent;btn.textContent="Added";btn.disabled=true;
 setTimeout(()=>{btn.textContent=old;btn.disabled=false;},900);
});
async function loadProducts(){
 try{const response=await fetch(API,{headers:{"Accept":"application/json"}});if(!response.ok)throw new Error("Catalogue API returned "+response.status);const payload=await response.json();products=Array.isArray(payload)?payload:Array.isArray(payload.products)?payload.products:[];products=products.filter(p=>p&&p.status!=="draft");els.status.textContent="";render();}
 catch(error){products=[];els.status.textContent="The legitimate product feed is unavailable.";render();}
}
els.form.addEventListener("submit",e=>{e.preventDefault();page=1;render();});
[els.query,els.format].forEach(c=>{c.addEventListener("input",()=>{page=1;render();});c.addEventListener("change",()=>{page=1;render();});});
loadProducts();
})();