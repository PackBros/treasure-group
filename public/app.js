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

const views=["dashboard","metals","calculator","map","finds","leaderboard"];
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
const STORE_KEY="treasure-group-map-pins-v1";
function loadPlaces(){try{return JSON.parse(localStorage.getItem(STORE_KEY)||"[]");}catch{return [];}}
function savePlaces(places){localStorage.setItem(STORE_KEY,JSON.stringify(places));}
function renderPlaces(){
 const places=loadPlaces(),list=document.getElementById("saved-places");document.getElementById("place-count").textContent=places.length;
 list.innerHTML=places.length?"":'<li class="muted">No places saved yet.</li>';
 places.forEach(place=>{
  const li=document.createElement("li"),title=document.createElement("div"),meta=document.createElement("div"),actions=document.createElement("div"),open=document.createElement("button"),remove=document.createElement("button");
  title.className="saved-place-title";title.textContent=place.name;meta.className="saved-place-meta";meta.textContent=place.category+" · "+place.lat.toFixed(4)+", "+place.lng.toFixed(4)+(place.notes?" · "+place.notes:"");
  actions.className="saved-place-actions";open.className="text-button";open.textContent="Show on map";open.addEventListener("click",()=>{showView("map");setTimeout(()=>{initMap();mapInstance.setView([place.lat,place.lng],15);},100);});
  remove.className="text-button";remove.textContent="Delete";remove.addEventListener("click",()=>{savePlaces(loadPlaces().filter(p=>p.id!==place.id));renderPlaces();drawMarkers();});
  actions.append(open,remove);li.append(title,meta,actions);list.append(li);
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
