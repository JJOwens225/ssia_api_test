window.addEventListener("load", () => {
  // Vérification de la disponibilité de la bibliothèque
  if (typeof LightweightCharts === "undefined") {
    console.error("La bibliothèque Lightweight Charts n'est pas chargée !");
    return;
  }
  window.loadCandleChart = function (token = "ivoire", timeframe = "1h") {
    const chartContainer = document.getElementById("mainChart");
    if (!chartContainer) {
      console.error("Container introuvable");
      return;
    }
    chartContainer.innerHTML = "";

    let chart = null;
    let candleSeries = null;

    try {
      chart = LightweightCharts.createChart(chartContainer, {
        layout: {
          backgroundColor: "#e4efff",
          textColor: "#333",
        },
        grid: {
          vertLines: { color: "rgba(42, 46, 57, 0.1)" },
          horzLines: { color: "rgba(42, 46, 57, 0.1)" },
        },
        width: chartContainer.clientWidth,
        height: chartContainer.clientHeight,
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
      });

      candleSeries = chart.addCandlestickSeries({
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderUpColor: "#26a69a",
        borderDownColor: "#ef5350",
        wickUpColor: "#26a69a",
        wickDownColor: "#ef5350",
      });

      // Ajout d'un gestionnaire de redimensionnement
      window.addEventListener("resize", () => {
        chart.applyOptions({
          width: chartContainer.clientWidth,
          height: chartContainer.clientHeight,
        });
      });

      fetchCandles();
    } catch (err) {
      console.error("Erreur d'initialisation du graphique:", err);
      return;
    }

    function fetchCandles() {
      fetch(`/bougies?token=${token}&timeframe=${timeframe}`)
        .then((res) => res.json())
        .then((data) => {
          console.log("Premier élément brut:", data[0]);

          const filteredData = data
            .filter((b) => {
              const isValid =
                b &&
                typeof b === "object" &&
                b.time != null &&
                !isNaN(parseFloat(b.open)) &&
                !isNaN(parseFloat(b.high)) &&
                !isNaN(parseFloat(b.low)) &&
                !isNaN(parseFloat(b.close));

              if (!isValid) {
                console.warn("Donnée invalide:", b);
              }
              return isValid;
            })
            .map((b) => {
              // Conversion du timestamp en UTC
              const timestamp =
                typeof b.time === "string"
                  ? Math.floor(new Date(b.time).getTime() / 1000)
                  : Math.floor(Number(b.time));

              // Vérification du timestamp
              if (timestamp < 946684800) {
                // timestamp minimum (1er janvier 2000)
                console.warn("Timestamp invalide:", timestamp);
                return null;
              }

              const candle = {
                time: timestamp,
                open: parseFloat(b.open),
                high: parseFloat(b.high),
                low: parseFloat(b.low),
                close: parseFloat(b.close),
              };
              return candle;
            })
            .filter((candle) => candle !== null);

          if (filteredData.length === 0) {
            console.error("Aucune donnée valide après filtrage");
            return;
          }

          // Tri par timestamp
          const sortedData = filteredData.sort((a, b) => a.time - b.time);

          try {
            // Définir toutes les données dans la série
            candleSeries.setData(sortedData);

            // Calculer l'index de début pour les 100 dernières bougies
            const startIndex = Math.max(0, sortedData.length - 100);

            // Définir la plage visible
            chart.timeScale().setVisibleRange({
              from: sortedData[startIndex].time,
              to: sortedData[sortedData.length - 1].time,
            });

            console.log("Données chargées:", {
              total: sortedData.length,
              visibles: 100,
              première_visible: sortedData[startIndex],
              dernière_visible: sortedData[sortedData.length - 1],
            });
          } catch (error) {
            console.error("Erreur lors de l'affichage:", error);
            console.log(
              "Données problématiques:",
              JSON.stringify(sortedData, null, 2)
            );
          }
        })
        .catch((error) => {
          console.error("Erreur lors de la récupération des données:", error);
        });
    }

    // Premier chargement
    fetchCandles();

    // Rafraîchissement automatique
    const interval = setInterval(fetchCandles, 30000);

    // Nettoyage
    return () => {
      if (chart) {
        chart.remove();
      }
      if (interval) {
        clearInterval(interval);
      }
    };
  }; // Fin de loadCandleChart
});
