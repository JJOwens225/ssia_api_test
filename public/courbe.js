// Configuration
const API_ENDPOINT = "http://localhost:3000/valeur-actuelle?token=ivoire";

// Connexion WebSocket
const socket = io("http://localhost:3000"); // ou ton URL en ligne

socket.on("newData", (data) => {
  if (data.token === "ivoire") {
    allData.push({
      time: new Date(data.heure).getTime() / 1000,
      value: data.valeur,
    });
    updateChart();
    updateCurrentPrice();
  }
});

// Éléments DOM
const chartContainer = document.getElementById("mainChart");
const loadingIndicator = document.getElementById("loadingIndicator");
const currentPriceElement = document.getElementById("currentPrice");

// Variables globales
let chart;
let areaSeries;
let allData = [];
let currentTimeframe = "1d";

// Fonction publique
window.loadLineChart = async function (token = "ivoire") {
  chartContainer.innerHTML = "";
  currentTimeframe = "1d"; // par défaut

  initChart();
  setupTimeframeButtons();
  await fetchData();
};

// Initialisation du graphique
function initChart() {
  chart = LightweightCharts.createChart(chartContainer, {
    layout: {
      backgroundColor: "#e4efff",
      textColor: "#3a3f5c",
    },
    grid: {
      vertLines: { color: "rgba(42, 46, 57, 0.1)" },
      horzLines: { color: "rgba(42, 46, 57, 0.1)" },
    },
    width: chartContainer.clientWidth,
    height: chartContainer.clientHeight,
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
    },
    timeScale: {
      borderVisible: false,
      ticksVisible: false,
      timeVisible: true,
      secondsVisible: false,
    },
    localization: {
      priceFormatter: (price) => price.toFixed(4),
    },
  });

  areaSeries = chart.addAreaSeries({
    topColor: "rgba(38, 166, 154, 0.4)",
    bottomColor: "rgba(38, 166, 154, 0.05)",
    lineColor: "rgba(38, 166, 154, 1)",
    lineWidth: 2,
    priceFormat: {
      type: "price",
      precision: 4,
      minMove: 0.0001,
    },
  });

  window.addEventListener("resize", () => {
    chart.applyOptions({
      width: chartContainer.clientWidth,
      height: chartContainer.clientHeight,
    });
  });
}

// Récupération des données
async function fetchData() {
  try {
    loadingIndicator.style.display = "block";

    const response = await fetch(API_ENDPOINT);
    if (!response.ok) throw new Error("Erreur réseau");

    const data = await response.json();

    // Transformation des données pour Lightweight Charts
    const formattedData = data.heures.map((heure, index) => ({
      time: new Date(heure).getTime() / 1000,
      value: data.historique[index],
    }));

    allData = formattedData;
    updateChart();
    updateCurrentPrice();
    loadingIndicator.style.display = "none";
    return true; // données récupérées avec succès
  } catch (error) {
    console.error("Erreur:", error);
    loadingIndicator.textContent = "Erreur de chargement - Réessayez";
  }
  return false;
}

if (typeof drawSegments === "function") drawSegments();

// Mise à jour du graphique selon le timeframe
function updateChart() {
  if (!allData.length) return;

  let filteredData = [...allData];
  const now = Date.now() / 1000;

  switch (currentTimeframe) {
    case "1h":
      filteredData = allData.filter((item) => item.time > now - 3600);
      break;
    case "4h":
      filteredData = allData.filter((item) => item.time > now - 14400);
      break;
    case "1d":
      filteredData = allData.filter((item) => item.time > now - 86400);
      break;
    // 'all' ne filtre pas
  }

  areaSeries.setData(filteredData);
  chart.timeScale().fitContent();
}

// Mise à jour du prix actuel
function updateCurrentPrice() {
  if (!allData.length) return;

  const latest = allData[allData.length - 1];
  const previous = allData.length >= 2 ? allData[allData.length - 2] : latest;
  const isFalling = latest.value < previous.value;

  const color = isFalling ? "#e53935" : "#26a69a";
  const topColor = isFalling
    ? "rgba(229, 57, 53, 0.4)"
    : "rgba(38, 166, 154, 0.4)";
  const bottomColor = isFalling
    ? "rgba(229, 57, 53, 0.05)"
    : "rgba(38, 166, 154, 0.05)";

  // Mettre à jour la série avec les bonnes couleurs
  areaSeries.applyOptions({
    lineColor: color,
    topColor: topColor,
    bottomColor: bottomColor,
    crossHairMarkerBorderColor: color,
    crossHairMarkerBackgroundColor: color,
  });

  // Mettre à jour la couleur du prix affiché en haut à droite
  currentPriceElement.textContent = latest.value.toFixed(4);
  currentPriceElement.style.color = color;

  // Animation du changement de prix
  currentPriceElement.style.transform = "scale(1.1)";
  setTimeout(() => {
    currentPriceElement.style.transform = "scale(1)";
  }, 300);
}

// Gestion des boutons de timeframe
function setupTimeframeButtons() {
  document.querySelectorAll(".toolbar button").forEach((btn) => {
    btn.addEventListener("click", function () {
      document.querySelector(".toolbar .active")?.classList.remove("active");
      this.classList.add("active");

      currentTimeframe = this.id.replace("btn", "");
      updateChart();
    });
  });
}
