let drawingMode = false;
let pointA = null;
let pointB = null;
let segments = [];

const canvas = document.getElementById("overlayCanvas");
const chartDiv = document.getElementById("mainChart");
const ctx = canvas.getContext("2d");

// Ajuste la taille du canvas à celle du graphique
function resizeCanvas() {
  canvas.width = chartDiv.clientWidth;
  canvas.height = chartDiv.clientHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

document.getElementById("addSegmentBtn").addEventListener("click", () => {
  drawingMode = true;
  pointA = null;
  pointB = null;
  canvas.style.pointerEvents = "auto"; // Autorise clics
});

document.getElementById("removeSegmentsBtn").addEventListener("click", () => {
  segments = [];
  redrawSegments();
});

selectedSegment.push({
  timestamp: data[index].time, // ← à récupérer du backend
});

// Écoute les clics pour dessiner les segments
canvas.addEventListener("click", (event) => {
  if (!drawingMode) return;

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (!pointA) {
    pointA = { x, y };
  } else {
    pointB = { x, y };
    segments.push({ a: pointA, b: pointB });
    pointA = null;
    pointB = null;
    drawingMode = false;
    canvas.style.pointerEvents = "none"; // Désactive clics
    redrawSegments();
  }
});

// Fonction pour dessiner tous les segments
export function drawSegments() {
  redrawSegments();
}

function redrawSegments() {
  resizeCanvas(); // en cas de resize
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const segment of segments) {
    ctx.beginPath();
    ctx.moveTo(segment.a.x, segment.a.y);
    ctx.lineTo(segment.b.x, segment.b.y);
    ctx.strokeStyle = segment.a.y > segment.b.y ? "blue" : "red";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
