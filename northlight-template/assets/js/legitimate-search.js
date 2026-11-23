(() => {
"use strict";
const API="/api/legitimate-products";
const els={
 form:document.getElementById("catalogueFilters"),query:document.getElementById("productQuery"),
 market:document.getElementById("productMarket"),format:document.getElementById("productFormat"),
 sort:document.getElementById("productSort"),min:document.getElementById("minPrice"),
 max:document.getElementById("maxPrice"),size:document.getElementById("productPageSize"),
 rows:document.getElementById("productRows"),count:document.getElementById("resultCount"),
 status:document.getElementById("catalogueStatus"),pager:document.getElementById("productPager")
};
let products=[],page=1;
const clean=v=>String(v??"").trim();
const esc=v=>clean(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>{const n=Number(v);return Number.isFinite(n)?"$"+n.toFixed(2):"Price on request";};
function filteredProducts(){
 const q=clean(els.query.value).toLowerCase(),market=els.market.value,format=els.format.value;
 const min=els.min.value===""?0:Number(els.min.value),max=els.max.value===""?Infinity:Number(els.max.value);
 const list=products.filter(p=>{
  const searchable=[p.name,p.seller,p.market,p.state,p.product_code].map(clean).join(" ").toLowerCase(),price=Number(p.price);
  return (!q||searchable.includes(q))&&(!market||clean(p.market)===market)&&(!format||clean(p.format).toLowerCase()===format)&&Number.isFinite(price)&&price>=min&&price<=max;
 });
 const sort=els.sort.value;
 list.sort((a,b)=>sort==="price-low"?Number(a.price)-Number(b.price):sort==="price-high"?Number(b.price)-Number(a.price):sort==="name"?clean(a.name).localeCompare(clean(b.name)):new Date(b.created_at||0)-new Date(a.created_at||0));
 return list;
}
function render(){
 const list=filteredProducts(),size=Number(els.size.value)||10,pages=Math.max(1,Math.ceil(list.length/size));
 page=Math.min(page,pages);const start=(page-1)*size,shown=list.slice(start,start+size);
 els.count.textContent=list.length+(list.length===1?" product":" products");
 if(!shown.length){els.rows.innerHTML='<tr><td colspan="10" class="catalogue__empty">'+(products.length?"No products match those filters.":"No products have been published yet.")+'</td></tr>';}
 else{
  els.rows.innerHTML=shown.map(p=>'<tr><td class="product-name">'+esc(p.name)+'</td><td>'+esc(p.format||"—")+'</td><td>'+esc(p.seller)+'</td><td class="quality">'+esc(p.quality||"Very High")+'</td><td class="product-id">'+esc(p.product_code)+'</td><td>'+esc(p.expiry)+'</td><td>'+esc(p.address||[p.market,p.state].filter(Boolean).join(", "))+'</td><td>'+Number(p.refund_period||0)+' days</td><td class="price">'+money(p.price)+'</td><td class="product-actions"><button class="btn" type="button" data-legit-add="'+esc(p.id||p.product_code)+'">Add to cart</button><button class="btn btn--primary" type="button" data-legit-buy="'+esc(p.id||p.product_code)+'">Buy now</button></td></tr>').join("");
 }
 els.pager.innerHTML="";
 if(pages>1){for(let n=1;n<=pages;n++){const b=document.createElement("button");b.type="button";b.textContent=String(n);if(n===page)b.setAttribute("aria-current","page");b.addEventListener("click",()=>{page=n;render();});els.pager.appendChild(b);}}
}
document.addEventListener("click",e=>{const add=e.target.closest("[data-legit-add]");const buy=e.target.closest("[data-legit-buy]");const btn=add||buy;if(!btn)return;const key=btn.getAttribute("data-legit-add")||btn.getAttribute("data-legit-buy");const product=products.find(p=>String(p.id||p.product_code)===String(key));if(!product||!window.NLLegitCart)return;window.NLLegitCart.add({key:String(product.id||product.product_code),title:product.name,price:product.price});if(buy)window.location.href="legitimate-cart.html";else{const old=btn.textContent;btn.textContent="Added";btn.disabled=true;setTimeout(()=>{btn.textContent=old;btn.disabled=false;},900);}});
function updateMarkets(){
 const current=els.market.value,markets=[...new Set(products.map(p=>clean(p.market)).filter(Boolean))].sort();
 els.market.innerHTML='<option value="">All countries</option>'+markets.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join("");
 if(markets.includes(current))els.market.value=current;
}
async function loadProducts(){
 try{const response=await fetch(API,{headers:{"Accept":"application/json"}});if(!response.ok)throw new Error("Catalogue API returned "+response.status);const payload=await response.json();products=Array.isArray(payload)?payload:Array.isArray(payload.products)?payload.products:[];products=products.filter(p=>p&&p.status!=="draft");updateMarkets();els.status.textContent="";render();}
 catch(error){products=[];els.status.textContent="The legitimate product feed is unavailable.";render();}
}
els.form.addEventListener("submit",e=>{e.preventDefault();page=1;render();});
els.form.addEventListener("reset",()=>setTimeout(()=>{page=1;render();},0));
[els.query,els.market,els.format,els.sort,els.min,els.max,els.size].forEach(c=>{c.addEventListener("input",()=>{page=1;render();});c.addEventListener("change",()=>{page=1;render();});});
loadProducts();
})();