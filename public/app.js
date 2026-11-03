const views = ["dashboard","metals","calculator","map","finds","leaderboard"];
const titles = {dashboard:"Dashboard",metals:"Metal prices",calculator:"Scrap calculator",map:"My map",finds:"Finds",leaderboard:"Leaderboard"};

function showView(name) {
  if (!views.includes(name)) return;
  document.querySelectorAll(".view").forEach(el => el.classList.toggle("active", el.id === name));
  document.querySelectorAll(".nav-link").forEach(el => el.classList.toggle("active", el.dataset.view === name));
  document.getElementById("page-title").textContent = titles[name];
}
document.querySelectorAll("[data-view]").forEach(el => el.addEventListener("click", () => showView(el.dataset.view)));
document.querySelectorAll("[data-go]").forEach(el => el.addEventListener("click", () => showView(el.dataset.go)));

const metal = document.getElementById("metal");
const purity = document.getElementById("purity");
const purities = {gold:[["9ct",9/24],["14ct",14/24],["16ct",16/24],["18ct",18/24],["22ct",22/24],["24ct",1]],silver:[["999",.999],["925",.925],["800",.8]]};
function updatePurities() {
  purity.innerHTML = purities[metal.value].map(([name]) => `<option value="${name}">${name}</option>`).join("");
}
metal.addEventListener("change", updatePurities);
updatePurities();

document.getElementById("scrap-form").addEventListener("submit", event => {
  event.preventDefault();
  const weight = Number(document.getElementById("weight").value);
  const spot = Number(document.getElementById("spot").value);
  const payout = Number(document.getElementById("payout").value);
  const factor = purities[metal.value].find(([name]) => name === purity.value)?.[1] ?? 0;
  if (!(weight > 0) || !(spot > 0) || !(payout >= 0 && payout <= 100)) return;
  const estimate = weight * factor * spot * payout / 100;
  document.getElementById("result").textContent = estimate.toLocaleString("en-GB",{style:"currency",currency:"GBP"});
  document.getElementById("result-note").textContent = `${weight.toFixed(2)}g × ${purity.value} purity × £${spot.toFixed(2)}/g pure metal × ${payout}% payout.`;
});
