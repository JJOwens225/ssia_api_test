class TradingView {
  constructor() {
    this.chart = null;
    this.mainSeries = null;
    this.indicators = new Map();
    this.tools = new Map();
    this.data = [];
    this.timeframe = "1d";
    this.chartType = "candles";
    this.containerDiv = document.getElementById("mainChart");

    if (!this.validateContainer()) {
      console.error("Conteneur du graphique invalide");
      return;
    }

    this.init();
    this.setupEventListeners();
  }

  validateContainer() {
    if (!this.containerDiv) {
      console.error("Élément #mainChart non trouvé");
      return false;
    }

    if (
      this.containerDiv.clientWidth === 0 ||
      this.containerDiv.clientHeight === 0
    ) {
      console.error("Dimensions du conteneur invalides");
      this.containerDiv.style.width = "100%";
      this.containerDiv.style.height = "400px";
    }

    return true;
  }

  init() {
    const chartOptions = {
      layout: {
        background: { color: "#e4efff" },
        textColor: "#333",
      },
      grid: {
        vertLines: { color: "rgba(42, 46, 57, 0.1)" },
        horzLines: { color: "rgba(42, 46, 57, 0.1)" },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "rgba(42, 46, 57, 0.5)",
      },
      timeScale: {
        borderColor: "rgba(42, 46, 57, 0.5)",
        timeVisible: true,
        secondsVisible: false,
      },
      width: this.containerDiv.clientWidth,
      height: this.containerDiv.clientHeight || 400, // Hauteur par défaut
    };

    this.chart = LightweightCharts.createChart(this.containerDiv, chartOptions);
  }

  setChartType(type) {
    if (this.mainSeries) {
      this.chart.removeSeries(this.mainSeries);
    }

    switch (type) {
      case "candles":
        this.mainSeries = this.chart.addCandlestickSeries({
          upColor: "#26a69a",
          downColor: "#ef5350",
          borderUpColor: "#26a69a",
          borderDownColor: "#ef5350",
          wickUpColor: "#26a69a",
          wickDownColor: "#ef5350",
        });
        break;
      case "area":
        this.mainSeries = this.chart.addAreaSeries({
          lineColor: "#2962FF",
          topColor: "rgba(41, 98, 255, 0.3)",
          bottomColor: "rgba(41, 98, 255, 0)",
        });
        break;
      case "line":
        this.mainSeries = this.chart.addLineSeries({
          color: "#2962FF",
          lineWidth: 2,
        });
        break;
    }

    this.chartType = type;
    if (this.data.length > 0) {
      this.mainSeries.setData(this.data);
    }
  }

  async fetchData(token = "ivoire", timeframe = "1d") {
    try {
      const response = await fetch(
        `/bougies?token=${token}&timeframe=${timeframe}`
      );
      const data = await response.json();

      console.log("Données reçues:", data); // Debug

      this.data = data
        .filter((item) => {
          // Vérification des données valides
          return (
            item &&
            typeof item.time === "number" &&
            !isNaN(item.open) &&
            !isNaN(item.high) &&
            !isNaN(item.low) &&
            !isNaN(item.close)
          );
        })
        .map((item) => ({
          time: Math.floor(Number(item.time)),
          open: Number(item.open),
          high: Number(item.high),
          low: Number(item.low),
          close: Number(item.close),
        }));

      console.log("Données formatées:", this.data); // Debug

      if (this.data.length === 0) {
        throw new Error("Aucune donnée valide à afficher");
      }

      this.mainSeries.setData(this.data);
      this.chart.timeScale().fitContent();

      document.getElementById("loadingIndicator").style.display = "none";
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
      document.getElementById(
        "loadingIndicator"
      ).textContent = `Erreur: ${error.message}`;
    }
  }

  addIndicator(type) {
    switch (type) {
      case "ma":
        this.addMA(20);
        break;
      case "bb":
        this.addBollingerBands();
        break;
      case "rsi":
        this.addRSI();
        break;
    }
  }

  addMA(period = 20) {
    const maData = this.calculateMA(period);
    const maSeries = this.chart.addLineSeries({
      color: "#FF6B6B",
      lineWidth: 1,
      title: `MA(${period})`,
    });
    maSeries.setData(maData);
    this.indicators.set(`ma${period}`, maSeries);
  }

  calculateMA(period) {
    // Implémentation du calcul de la moyenne mobile
    return this.data
      .map((item, index, array) => {
        if (index < period - 1) return null;
        const sum = array
          .slice(index - period + 1, index + 1)
          .reduce((acc, val) => acc + val.close, 0);
        return {
          time: item.time,
          value: sum / period,
        };
      })
      .filter((item) => item !== null);
  }

  setupEventListeners() {
    // Gestion des boutons de type de graphique
    document.querySelectorAll("[data-chart-type]").forEach((button) => {
      button.addEventListener("click", (e) => {
        document
          .querySelectorAll("[data-chart-type]")
          .forEach((b) => b.classList.remove("active"));
        e.target.classList.add("active");
        this.setChartType(e.target.dataset.chartType);
      });
    });

    // Gestion des indicateurs
    document.querySelectorAll("[data-indicator]").forEach((button) => {
      button.addEventListener("click", (e) => {
        this.addIndicator(e.target.dataset.indicator);
      });
    });

    // Toggle du panel des indicateurs
    document.getElementById("indicatorsBtn").addEventListener("click", () => {
      const panel = document.getElementById("indicatorsPanel");
      panel.classList.toggle("visible");
    });
  }
}

// Initialisation
document.addEventListener("DOMContentLoaded", () => {
  window.tradingView = new TradingView();
  window.tradingView.fetchData();
});
