const ACCESS_CODE = "0925";
const ACCESS_SESSION_KEY = "treasure-group-access-v1";
function unlockApp(profile){
 document.getElementById("access-screen").hidden=true;
 document.getElementById("app-shell").hidden=false;
 document.getElementById("current-user").textContent=profile;
}
document.getElementById("access-form").addEventListener("submit",event=>{
 event.preventDefault();
 const code=document.getElementById("access-code").value;
 const profile=document.getElementById("access-profile").value;
 if(code!==ACCESS_CODE){document.getElementById("access-error").textContent="That access code is not correct.";return;}
 if(!profile){document.getElementById("access-error").textContent="Please choose Logan or Debbie.";return;}
 sessionStorage.setItem(ACCESS_SESSION_KEY,profile);
 document.getElementById("access-error").textContent="";
 unlockApp(profile);
});
document.getElementById("sign-out").addEventListener("click",()=>{
 sessionStorage.removeItem(ACCESS_SESSION_KEY);
 document.getElementById("app-shell").hidden=true;
 document.getElementById("access-screen").hidden=false;
 document.getElementById("access-form").reset();
});
const previousSession=sessionStorage.getItem(ACCESS_SESSION_KEY);
if(previousSession==="Logan"||previousSession==="Debbie")unlockApp(previousSession);

const views=["dashboard","metals","calculator","map","finds","leaderboard","backup"];
const titles={dashboard:"Overview",metals:"Metal prices",calculator:"Scrap calculator",map:"Your map",finds:"Finds",leaderboard:"Leaderboard"};
let goldPerGram=null,silverPerGram=null,goldUpdated=null,silverUpdated=null,mapInstance=null,selectedPoint=null,markers=[],streetLayer=null,satelliteLayer=null;
const money=n=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const goldPurities=[["9ct",9/24],["14ct",14/24],["16ct",16/24],["18ct",18/24],["22ct",22/24],["24ct",1]];
const silverPurities=[["999",.999],["925",.925],["800",.8]];
function showView(name){
 if(!views.includes(name))return;
 document.querySelectorAll(".view").forEach(el=>el.classList.toggle("active",el.id===name));
 document.querySelectorAll(".nav-link").forEach(el=>el.classList.toggle("active",el.dataset.view===name));
 if(name==="map")setTimeout(initMap,80);
}
document.querySelectorAll("[data-view]").forEach(el=>el.addEventListener("click",()=>showView(el.dataset.view)));
document.querySelectorAll("[data-go]").forEach(el=>el.addEventListener("click",()=>showView(el.dataset.go)));
function renderValues(id,items,spot){
 const body=document.getElementById(id);if(!body)return;
 body.innerHTML=items.map(([name,factor])=>`<tr><td>${name}</td><td>${(factor*100).toFixed(factor===1?0:1)}%</td><td>${spot===null?"—":money(spot*factor)}</td></tr>`).join("");
}
function renderPrices(){
 document.getElementById("gold-spot").textContent=goldPerGram===null?"Unavailable":money(goldPerGram);
 document.getElementById("silver-spot").textContent=silverPerGram===null?"Unavailable":money(silverPerGram);
 document.getElementById("gold-spot-large").textContent=goldPerGram===null?"Unavailable":money(goldPerGram);
 document.getElementById("silver-spot-large").textContent=silverPerGram===null?"Unavailable":money(silverPerGram);
 const fmt=t=>t?new Date(t).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/London"}):"No successful quote yet";
 document.getElementById("gold-updated").textContent="Updated: "+fmt(goldUpdated);
 document.getElementById("silver-updated").textContent="Updated: "+fmt(silverUpdated);
 document.getElementById("gold-updated-large").textContent="Updated: "+fmt(goldUpdated);
 document.getElementById("silver-updated-large").textContent="Updated: "+fmt(silverUpdated);
 renderValues("gold-values",goldPurities,goldPerGram);renderValues("silver-values",silverPurities,silverPerGram);
 renderValues("gold-values-large",goldPurities,goldPerGram);renderValues("silver-values-large",silverPurities,silverPerGram);
 const status=document.getElementById("market-status");
 if(goldPerGram!==null&&silverPerGram!==null){status.textContent="Prices connected";status.className="status ok";document.getElementById("table-updated").textContent="Updated "+new Date(Math.min(new Date(goldUpdated),new Date(silverUpdated))).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});}
 else{status.textContent="Price feed unavailable";status.className="status error";document.getElementById("table-updated").textContent="Waiting for quotes";}
 const latest=[goldUpdated,silverUpdated].filter(Boolean).map(value=>new Date(value)).sort((a,b)=>a-b)[0];
 document.getElementById("market-last-updated").textContent=latest?"Last updated: "+latest.toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"medium",timeZone:"Europe/London"}):"Last updated: no successful quote yet";
 updateCalculatorFeed();
 if(typeof updateFindEstimate==="function")updateFindEstimate();
}
async function fetchMetal(symbol){
 const response=await fetch(`https://api.gold-api.com/price/${symbol}/GBP`,{cache:"no-store"});
 if(!response.ok)throw new Error(`${symbol} request failed (${response.status})`);
 const data=await response.json();
 const perOunce=Number(data.price);
 if(!Number.isFinite(perOunce)||perOunce<=0)throw new Error("Invalid price response");
 return {perGram:perOunce/31.1034768,updatedAt:data.updatedAt||new Date().toISOString()};
}
async function refreshPrices(){
 const status=document.getElementById("market-status");status.textContent="Refreshing prices…";status.className="status";
 const [gold,silver]=await Promise.allSettled([fetchMetal("XAU"),fetchMetal("XAG")]);
 if(gold.status==="fulfilled"){goldPerGram=gold.value.perGram;goldUpdated=gold.value.updatedAt;}
 if(silver.status==="fulfilled"){silverPerGram=silver.value.perGram;silverUpdated=silver.value.updatedAt;}
 renderPrices();
 if(gold.status==="rejected"||silver.status==="rejected"){status.title="One or more price requests failed. Last successful values are retained with their original update time.";status.textContent="Feed issue · showing last successful quote";status.className="status error";}
}
document.getElementById("refresh-prices").addEventListener("click",refreshPrices);
const metalSelect=document.getElementById("metal"),puritySelect=document.getElementById("purity");
function updatePurities(){
 const items=metalSelect.value==="gold"?goldPurities:silverPurities;
 puritySelect.innerHTML=items.map(([label])=>`<option value="${label}">${label}</option>`).join("");
 updateCalculatorFeed();
}
function currentFactor(){const items=metalSelect.value==="gold"?goldPurities:silverPurities;return items.find(([label])=>label===puritySelect.value)?.[1]??0;}
function currentSpot(){return metalSelect.value==="gold"?goldPerGram:silverPerGram;}
function updateCalculatorFeed(){const feed=document.getElementById("calculator-feed");if(!feed)return;const spot=currentSpot();feed.textContent=spot===null?"Live spot feed unavailable. Try refreshing prices.":"Current pure-metal spot: "+money(spot)+" per gram. Purity value is calculated automatically.";}
metalSelect.addEventListener("change",updatePurities);puritySelect.addEventListener("change",updateCalculatorFeed);updatePurities();
document.getElementById("scrap-form").addEventListener("submit",event=>{
 event.preventDefault();const weight=Number(document.getElementById("weight").value),payout=Number(document.getElementById("payout").value),spot=currentSpot(),factor=currentFactor();
 if(!(weight>0)||!(payout>=0&&payout<=100)||spot===null){document.getElementById("result-note").textContent="Enter a valid weight and wait for the relevant live spot price.";return;}
 const raw=weight*factor*spot,estimated=raw*payout/100;
 document.getElementById("result").textContent=money(estimated);document.getElementById("raw-result").textContent=money(raw);document.getElementById("spot-result").textContent=money(spot*factor);document.getElementById("payout-result").textContent=payout+"%";
 document.getElementById("result-note").textContent=`${weight.toFixed(3)}g of ${puritySelect.value} ${metalSelect.value}.`;
});
const STORE_KEY="treasure-group-map-pins-v1";\nconst selectedRouteStops=new Set();
function loadPlaces(){try{return JSON.parse(localStorage.getItem(STORE_KEY)||"[]");}catch{return [];}}
function savePlaces(places){localStorage.setItem(STORE_KEY,JSON.stringify(places));}
function renderPlaces(){
 const places=loadPlaces(),list=document.getElementById("saved-places");document.getElementById("place-count").textContent=places.length;
 list.innerHTML=places.length?"":'<li class="muted">No places saved yet.</li>';
 places.forEach(place=>{
  const li=document.createElement("li"),title=document.createElement("div"),meta=document.createElement("div"),actions=document.createElement("div"),open=document.createElement("button"),remove=document.createElement("button"),pick=document.createElement("input"),pickLabel=document.createElement("label");
  title.className="saved-place-title";title.textContent=place.name;pick.type="checkbox";pick.className="route-stop-check";pick.value=place.id;pick.checked=selectedRouteStops.has(place.id);pick.addEventListener("change",()=>{pick.checked?selectedRouteStops.add(place.id):selectedRouteStops.delete(place.id);updateRouteMessage()});pickLabel.className="route-stop-label";pickLabel.append(pick,document.createTextNode(" Add to route"));meta.className="saved-place-meta";meta.textContent=place.category+" · "+place.lat.toFixed(4)+", "+place.lng.toFixed(4)+(place.notes?" · "+place.notes:"");
  actions.className="saved-place-actions";open.className="text-button";open.textContent="Show on map";open.addEventListener("click",()=>{showView("map");setTimeout(()=>{initMap();mapInstance.setView([place.lat,place.lng],15);},100);});
  remove.className="text-button";remove.textContent="Delete";remove.addEventListener("click",()=>{savePlaces(loadPlaces().filter(p=>p.id!==place.id));selectedRouteStops.delete(place.id);renderPlaces();drawMarkers();updateRouteMessage();});
  actions.append(open,remove);li.append(pickLabel,title,meta,actions);list.append(li);
 });
}
function drawMarkers(){
 if(!mapInstance)return;markers.forEach(marker=>marker.remove());markers=[];
 loadPlaces().forEach(place=>{const marker=L.marker([place.lat,place.lng]).addTo(mapInstance);marker.bindPopup(`<strong>${escapeHtml(place.name)}</strong><br>${escapeHtml(place.category)}${place.notes?"<br>"+escapeHtml(place.notes):""}`);markers.push(marker);});
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));}
function initMap(){
 if(mapInstance){mapInstance.invalidateSize();return;}
 if(!window.L){document.getElementById("map-canvas").textContent="Map library could not be loaded. Check your connection and refresh.";return;}
 mapInstance=L.map("map-canvas").setView([52.2,-1.5],6);
 streetLayer=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'});
 satelliteLayer=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:'Tiles &copy; Esri'});
 streetLayer.addTo(mapInstance);
 document.getElementById("map-streets").addEventListener("click",()=>{if(mapInstance.hasLayer(satelliteLayer))mapInstance.removeLayer(satelliteLayer);streetLayer.addTo(mapInstance);document.getElementById("map-streets").classList.add("active");document.getElementById("map-satellite").classList.remove("active");});
 document.getElementById("map-satellite").addEventListener("click",()=>{if(mapInstance.hasLayer(streetLayer))mapInstance.removeLayer(streetLayer);satelliteLayer.addTo(mapInstance);document.getElementById("map-satellite").classList.add("active");document.getElementById("map-streets").classList.remove("active");});
 document.getElementById("map-street-view").addEventListener("click",()=>{const point=selectedPoint||mapInstance.getCenter();const url="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint="+point.lat+","+point.lng;window.open(url,"_blank","noopener,noreferrer");});

 mapInstance.on("click",event=>{selectedPoint=event.latlng;document.getElementById("map-street-view").disabled=false;document.getElementById("place-coords").textContent="Selected: "+selectedPoint.lat.toFixed(5)+", "+selectedPoint.lng.toFixed(5);document.getElementById("place-name").focus();});
 drawMarkers();renderPlaces();
}
document.getElementById("place-form").addEventListener("submit",event=>{
 event.preventDefault();if(!selectedPoint){document.getElementById("place-coords").textContent="Please click the map first to choose a location.";return;}
 const place={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),name:document.getElementById("place-name").value.trim(),category:document.getElementById("place-category").value,notes:document.getElementById("place-notes").value.trim(),lat:selectedPoint.lat,lng:selectedPoint.lng};
 if(!place.name)return;const places=loadPlaces();places.push(place);savePlaces(places);document.getElementById("place-form").reset();document.getElementById("place-coords").textContent="Saved. Click the map to choose another location.";selectedPoint=null;document.getElementById("map-street-view").disabled=true;renderPlaces();drawMarkers();
});
refreshPrices();setInterval(refreshPrices,30000);


const FINDS_KEY="treasure-group-finds-v1";let draftPhoto="";
function loadFinds(){try{const a=JSON.parse(localStorage.getItem(FINDS_KEY)||"[]");return Array.isArray(a)?a:[]}catch{return []}}
function saveFinds(a){localStorage.setItem(FINDS_KEY,JSON.stringify(a))}
function grams(v){return (Number(v)||0).toLocaleString("en-GB",{maximumFractionDigits:3})+" g"}
function findEstimate(m,p,w){const spot=m==="gold"?goldPerGram:m==="silver"?silverPerGram:null;const factor=m==="gold"?goldPurities.find(x=>x[0]===p)?.[1]:m==="silver"?silverPurities.find(x=>x[0]===p)?.[1]:null;return spot!==null&&factor&&Number(w)>0?Number(w)*factor*spot:null}
function updateFindPurities(){return;}
function updateFindEstimate(){return;}
document.getElementById("find-value").addEventListener("input",()=>document.getElementById("find-value").dataset.manual="1");
function resizePhoto(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=reject;r.onload=()=>{const i=new Image();i.onerror=reject;i.onload=()=>{const scale=Math.min(1,1000/Math.max(i.width,i.height)),c=document.createElement("canvas");c.width=Math.round(i.width*scale);c.height=Math.round(i.height*scale);c.getContext("2d").drawImage(i,0,0,c.width,c.height);resolve(c.toDataURL("image/jpeg",.78))};i.src=r.result};r.readAsDataURL(file)})}
document.getElementById("find-photo").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{draftPhoto=await resizePhoto(f);const p=document.getElementById("find-photo-preview");p.src=draftPhoto;p.hidden=false}catch{alert("Could not load that photo.")}});
function resetFindForm(){document.getElementById("find-form").reset();document.getElementById("find-id").value="";document.getElementById("find-date").value=new Date().toISOString().slice(0,10);document.getElementById("find-form-title").textContent="Add a find";document.getElementById("save-find-button").textContent="Save find";document.getElementById("cancel-find-edit").hidden=true;document.getElementById("find-photo-preview").hidden=true;document.getElementById("find-value").dataset.manual="";draftPhoto="";updateFindPurities()}
function editFind(id){const x=loadFinds().find(v=>v.id===id);if(!x)return;document.getElementById("find-id").value=x.id;document.getElementById("find-name").value=x.name;document.getElementById("find-category").value=x.category;document.getElementById("find-date").value=x.date;document.getElementById("find-owner").value=x.owner;document.getElementById("find-metal").value=x.metal;updateFindPurities();document.getElementById("find-purity").value=x.purity||"";document.getElementById("find-weight").value=x.weight||"";document.getElementById("find-value").value=x.value||"";document.getElementById("find-value").dataset.manual="1";document.getElementById("find-cost").value=x.cost||"";document.getElementById("find-location").value=x.location||"";document.getElementById("find-notes").value=x.notes||"";draftPhoto=x.photo||"";const p=document.getElementById("find-photo-preview");if(draftPhoto){p.src=draftPhoto;p.hidden=false}else p.hidden=true;document.getElementById("find-form-title").textContent="Edit find";document.getElementById("save-find-button").textContent="Update find";document.getElementById("cancel-find-edit").hidden=false;showView("finds")}
document.getElementById("cancel-find-edit").addEventListener("click",resetFindForm);
document.getElementById("find-form").addEventListener("submit",e=>{e.preventDefault();const id=document.getElementById("find-id").value,old=loadFinds().find(x=>x.id===id);const x={id:id||("f"+Date.now()),name:document.getElementById("find-name").value.trim(),category:document.getElementById("find-category").value,date:document.getElementById("find-date").value,owner:document.getElementById("find-owner").value,metal:document.getElementById("find-metal").value,purity:document.getElementById("find-purity").value,weight:Number(document.getElementById("find-weight").value)||0,value:Number(document.getElementById("find-value").value)||0,cost:Number(document.getElementById("find-cost").value)||0,location:document.getElementById("find-location").value.trim(),notes:document.getElementById("find-notes").value.trim(),photo:draftPhoto||(old?.photo||""),createdAt:old?.createdAt||new Date().toISOString()};const all=loadFinds();if(id){const i=all.findIndex(v=>v.id===id);if(i>=0)all[i]=x}else all.unshift(x);try{saveFinds(all);resetFindForm();renderFinds()}catch{alert("Browser storage is full. Try a smaller photo or download a backup.")}});
function findCard(x){const card=document.createElement("article");card.className="panel find-card";if(x.photo){const im=document.createElement("img");im.className="find-card-photo";im.src=x.photo;im.alt=x.name;card.append(im)}const body=document.createElement("div");body.className="find-card-body";const top=document.createElement("div");top.className="find-card-top";const h=document.createElement("h3");h.textContent=x.name;const v=document.createElement("strong");v.textContent=money(x.value||0);top.append(h,v);body.append(top);const meta=document.createElement("div");meta.className="find-meta";meta.textContent=[x.category,x.date,x.owner,x.metal!=="none"?(x.purity+" "+x.metal):"",x.weight?grams(x.weight):""].filter(Boolean).join(" · ");body.append(meta);if(x.location){const p=document.createElement("p");p.className="find-location";p.textContent="Found at: "+x.location;body.append(p)}if(x.notes){const p=document.createElement("p");p.className="find-notes";p.textContent=x.notes;body.append(p)}const foot=document.createElement("div");foot.className="find-card-foot";const cost=document.createElement("span");cost.className="muted small";cost.textContent=x.cost?"Cost "+money(x.cost)+" · Difference "+money((x.value||0)-x.cost):"Saved "+new Date(x.createdAt).toLocaleDateString("en-GB");const actions=document.createElement("div");actions.className="saved-place-actions";const edit=document.createElement("button");edit.className="text-button";edit.textContent="Edit";edit.addEventListener("click",()=>editFind(x.id));const del=document.createElement("button");del.className="text-button danger-text";del.textContent="Delete";del.addEventListener("click",()=>{if(confirm("Delete "+x.name+"?")){saveFinds(loadFinds().filter(v=>v.id!==x.id));renderFinds()}});actions.append(edit,del);foot.append(cost,actions);body.append(foot);card.append(body);return card}
function renderFinds(){const all=loadFinds(),q=document.getElementById("find-search").value.toLowerCase(),cat=document.getElementById("find-filter-category").value,owner=document.getElementById("find-filter-owner").value,sort=document.getElementById("find-sort").value;let items=all.filter(x=>(!cat||x.category===cat)&&(!owner||x.owner===owner)&&(!q||[x.name,x.notes,x.location,x.category,x.owner].join(" ").toLowerCase().includes(q)));items.sort((a,b)=>sort==="oldest"?a.date.localeCompare(b.date):sort==="value"?(b.value||0)-(a.value||0):sort==="weight"?(b.weight||0)-(a.weight||0):sort==="name"?a.name.localeCompare(b.name):b.date.localeCompare(a.date));const list=document.getElementById("find-list");list.replaceChildren();document.getElementById("find-results-count").textContent=items.length+" of "+all.length+" finds";if(!items.length){const e=document.createElement("div");e.className="panel empty-state";e.textContent=all.length?"No finds match your filters.":"No finds logged yet. Add your first discovery.";list.append(e)}items.forEach(x=>list.append(findCard(x)));const weight=all.reduce((s,x)=>s+(x.weight||0),0),value=all.reduce((s,x)=>s+(x.value||0),0),best=all.slice().sort((a,b)=>(b.value||0)-(a.value||0))[0];document.getElementById("find-stat-count").textContent=all.length;document.getElementById("find-stat-weight").textContent=grams(weight);document.getElementById("find-stat-value").textContent=money(value);document.getElementById("find-stat-best").textContent=best?best.name:"—";renderLeaderboard()}
["find-search","find-filter-category","find-filter-owner","find-sort"].forEach(id=>document.getElementById(id).addEventListener(id==="find-search"?"input":"change",renderFinds));
document.getElementById("clear-find-filters").addEventListener("click",()=>{["find-search","find-filter-category","find-filter-owner"].forEach(id=>document.getElementById(id).value="");document.getElementById("find-sort").value="newest";renderFinds()});
function renderLeaderboard(){const finds=loadFinds(),metric=document.getElementById("leaderboard-metric").value,people=["Logan","Debbie"].map(name=>{const a=finds.filter(x=>x.owner===name);return{name,count:a.length,value:a.reduce((s,x)=>s+(x.value||0),0),weight:a.reduce((s,x)=>s+(x.weight||0),0)}});people.sort((a,b)=>metric==="value"?b.value-a.value:metric==="weight"?b.weight-a.weight:b.count-a.count);const max=Math.max(1,...people.map(x=>metric==="value"?x.value:metric==="weight"?x.weight:x.count)),root=document.getElementById("leaderboard-content");root.replaceChildren();people.forEach((p,i)=>{const row=document.createElement("div");row.className="leader-row";const rank=document.createElement("div");rank.className="leader-rank";rank.textContent=String(i+1);const detail=document.createElement("div");detail.className="leader-person";const name=document.createElement("strong");name.textContent=p.name;const stats=document.createElement("span");stats.textContent=p.count+" finds · "+grams(p.weight)+" · "+money(p.value);const track=document.createElement("div");track.className="leader-track";const fill=document.createElement("div");fill.className="leader-fill";fill.style.width=((metric==="value"?p.value:metric==="weight"?p.weight:p.count)/max*100)+"%";track.append(fill);detail.append(name,stats,track);const score=document.createElement("strong");score.className="leader-score";score.textContent=metric==="value"?money(p.value):metric==="weight"?grams(p.weight):String(p.count);row.append(rank,detail,score);root.append(row)});document.getElementById("leader-total-finds").textContent=finds.length;document.getElementById("leader-total-value").textContent=money(finds.reduce((s,x)=>s+(x.value||0),0));document.getElementById("leader-total-weight").textContent=grams(finds.reduce((s,x)=>s+(x.weight||0),0))}
document.getElementById("leaderboard-metric").addEventListener("change",renderLeaderboard);
function downloadFile(name,type,data){const blob=new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
function downloadCsv(){const keys=["name","category","date","owner","metal","purity","weight","value","cost","location","notes"],esc=v=>'"'+String(v??"").replace(/"/g,'""')+'"';downloadFile("treasure-group-finds.csv","text/csv;charset=utf-8",[keys.join(","),...loadFinds().map(x=>keys.map(k=>esc(x[k])).join(","))].join("\r\n"))}
document.getElementById("export-finds-csv").addEventListener("click",downloadCsv);document.getElementById("download-finds-csv").addEventListener("click",downloadCsv);
document.getElementById("download-backup").addEventListener("click",()=>downloadFile("treasure-group-backup.json","application/json",JSON.stringify({format:"treasure-group-backup",version:1,finds:loadFinds(),places:loadPlaces()},null,2)));
document.getElementById("restore-form").addEventListener("submit",async e=>{e.preventDefault();try{const d=JSON.parse(await document.getElementById("restore-file").files[0].text());if(d.format!=="treasure-group-backup"||!Array.isArray(d.finds)||!Array.isArray(d.places))throw Error("Not a valid Treasure Group backup");saveFinds(d.finds);savePlaces(d.places);renderFinds();renderPlaces();drawMarkers();document.getElementById("restore-message").textContent="Backup restored."}catch(err){document.getElementById("restore-message").textContent=err.message}});
document.getElementById("find-owner").value=sessionStorage.getItem(ACCESS_SESSION_KEY)||"Logan";document.getElementById("find-date").value=new Date().toISOString().slice(0,10);renderFinds();


function updateRouteMessage(){const count=selectedRouteStops.size;document.getElementById("route-message").textContent=count<2?"Choose at least two stops ("+count+" selected).":count+" stops selected. Google Maps will open your route."}
document.getElementById("select-all-stops").addEventListener("click",()=>{loadPlaces().forEach(p=>selectedRouteStops.add(p.id));renderPlaces();updateRouteMessage()});
document.getElementById("create-route").addEventListener("click",()=>{
 const chosen=loadPlaces().filter(p=>selectedRouteStops.has(p.id));
 if(chosen.length<2){document.getElementById("route-message").textContent="Please tick at least two saved waypoints.";return}
 const limited=chosen.slice(0,10);
 const origin=limited[0],destination=limited[limited.length-1],waypoints=limited.slice(1,-1).map(p=>p.lat+","+p.lng);
 const params=new URLSearchParams({api:"1",origin:origin.lat+","+origin.lng,destination:destination.lat+","+destination.lng,travelmode:"driving"});
 if(waypoints.length)params.set("waypoints",waypoints.join("|"));
 window.open("https://www.google.com/maps/dir/?"+params.toString(),"_blank","noopener,noreferrer");
 document.getElementById("route-message").textContent=limited.length<chosen.length?"Opened first 10 selected stops. Create another route for the remaining stops.":"Route opened in Google Maps.";
});
