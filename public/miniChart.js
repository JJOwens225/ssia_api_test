const miniCanvas = document.getElementById("miniChart");
const miniCtx = miniCanvas.getContext("2d");

function drawMiniChart() {
  if (!data || data.length === 0) return;

  const width = miniCanvas.width;
  const height = miniCanvas.height;
  miniCtx.clearRect(0, 0, width, height);

  const visibleData = data;
  const minVal = Math.min(...visibleData);
  const maxVal = Math.max(...visibleData);
  const range = maxVal - minVal || 1;

  const stepX = width / (visibleData.length - 1);

  miniCtx.beginPath();
  visibleData.forEach((value, i) => {
    const x = i * stepX;
    const y = height - ((value - minVal) / range) * height;
    if (i === 0) miniCtx.moveTo(x, y);
    else miniCtx.lineTo(x, y);
  });

  // Couleur selon tendance
  const last = visibleData[visibleData.length - 1];
  const prev = visibleData[visibleData.length - 2] || last;
  const color = "#fff";

  miniCtx.strokeStyle = color;
  miniCtx.lineWidth = 1;
  miniCtx.stroke();
}

// Met à jour la mini-courbe à chaque animation ou nouveau point
setInterval(drawMiniChart, 500); // ou appelle `drawMiniChart()` manuellement dans drawChart()
