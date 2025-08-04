import express from "express";
import cors from "cors";
import { google } from "googleapis";
import credentials from "./credentials.json" assert { type: "json" };
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { createServer } from "http"; // ✅
import { Server } from "socket.io";

const app = express();
const port = process.env.PORT || 3000;

// Création serveur HTTP + WebSocket
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.static("public"));

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });
const spreadsheetId = "1z_WrDvVdBD6Krz1KOpW0xcHhxP5GG4DlAWPtzJCxXxg";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ chemin absolu vers db/historique.db
const dbPath = path.join(__dirname, "db", "historique.db");

let db;
(async () => {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
  console.log("📦 Base SQLite initialisée");

  httpServer.listen(port, () => {
    // ✅
    console.log(`🚀 Serveur démarré sur http://localhost:${port}`);
  });
})();

const tokenRowMap = {
  ivoire: 2,
  armoirie: 3,
  ssv: 4,
  ssc: 5,
  crn: 6,
  lyx: 7,
  qrn: 8,
};

app.get("/bougies", async (req, res) => {
  const token = req.query.token?.toLowerCase() || "ivoire";
  const row = tokenRowMap[token];

  if (!row) return res.status(400).json({ error: "Token invalide" });

  try {
    const table = `bougies_${token}`;
    const rows = await db.all(`
      SELECT * FROM ${table} ORDER BY id
    `);

    const formatted = rows
      .map((r) => {
        const time = Math.floor(new Date(r.time).getTime() / 1000);
        const open = parseFloat(r.open);
        const high = parseFloat(r.high);
        const low = parseFloat(r.low);
        const close = parseFloat(r.close);

        if (
          isNaN(time) ||
          isNaN(open) ||
          isNaN(high) ||
          isNaN(low) ||
          isNaN(close)
        ) {
          return null; // on filtre ensuite
        }

        return { time, open, high, low, close };
      })
      .filter(Boolean);

    res.json(formatted);
  } catch (error) {
    console.error("❌ Erreur récupération bougies :", error.message);
    res.status(500).json({ error: "Erreur récupération bougies" });
  }
});

// 🧪 Route pour récupération des données en chandeliers (une seule bougie)
app.get("/chandeliers", async (req, res) => {
  const token = req.query.token?.toLowerCase() || "ivoire";
  const row = tokenRowMap[token];

  if (!row) return res.status(400).json({ error: "Token invalide" });

  try {
    const range = `Indice Token!C${row}:F${row}`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const [c, d, e, f] = response.data.values?.[0] || [];

    const open = parseFloat(c.replace(",", "."));
    const close = parseFloat(d.replace(",", "."));
    const variation = parseFloat(e.replace(",", "."));

    const high = Math.max(open, close) + Math.abs(variation) / 2;
    const low = Math.min(open, close) - Math.abs(variation) / 2;

    const candle = {
      time: Math.floor(Date.now() / 1000),
      open,
      high,
      low,
      close,
    };

    res.json({ candles: [candle] });
  } catch (err) {
    console.error("❌ Erreur chandeliers :", err.message);
    res.status(500).json({ error: "Erreur récupération chandeliers" });
  }
});

// 🎯 Route pour récupérer uniquement les valeurs actuelles (série de courbes)
app.get("/valeur-actuelle", async (req, res) => {
  const token = req.query.token?.toLowerCase() || "ivoire";
  const row = tokenRowMap[token];

  if (!row) return res.status(400).json({ error: "Token invalide" });

  try {
    const range = `Indice Token!D${row}`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const valeur = response.data.values?.[0]?.[0];
    if (!valeur) throw new Error("Valeur non trouvée");

    const valeurNum = parseFloat(valeur.replace(",", "."));
    const now = new Date().toISOString();
    const table = `historique_${token}`;

    await db.exec(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        valeur REAL NOT NULL,
        heure TEXT NOT NULL
      )
    `);

    const lastRow = await db.get(
      `SELECT valeur FROM ${table} ORDER BY id DESC LIMIT 1`
    );

    if (!lastRow || lastRow.valeur !== valeurNum) {
      await db.run(
        `INSERT INTO ${table} (valeur, heure) VALUES (?, ?)`,
        valeurNum,
        now
      );

      await db.run(`
        DELETE FROM ${table}
        WHERE id NOT IN (
          SELECT id FROM ${table} ORDER BY id DESC LIMIT 1000
        )
      `);
    }

    const rows = await db.all(`SELECT valeur, heure FROM ${table} ORDER BY id`);
    const historique = rows.map((r) => r.valeur);
    const heures = rows.map((r) => r.heure);

    res.json({ historique, heures });
  } catch (error) {
    console.error("❌ Erreur valeur actuelle :", error.message);
    res.status(500).json({ error: "Erreur récupération" });
  }
});

// 📊 Route du prix d’action
app.get("/prix-action", async (req, res) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Indice Token!H2",
    });

    const prixAction = response.data.values?.[0]?.[0];
    if (!prixAction) throw new Error("Prix d'action non trouvé");

    res.json({
      prixAction: parseFloat(prixAction.replace(",", ".")),
    });
  } catch (error) {
    console.error("❌ Erreur prix action:", error.message);
    res.status(500).json({ error: "Erreur récupération prix action" });
  }
});

// ⏱️ Tâche planifiée : toutes les secondes, mais exécution entre 59s et 04s
setInterval(async () => {
  const now = new Date();
  const seconds = now.getSeconds();

  if (seconds >= 59 || seconds <= 4) {
    for (const [token, row] of Object.entries(tokenRowMap)) {
      const range = `Indice Token!C${row}:F${row}`;
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });

        const [c, d, e, f] = response.data.values?.[0] || [];

        const open = parseFloat(c.replace(",", "."));
        const close = parseFloat(d.replace(",", "."));
        const variation = parseFloat(e.replace(",", "."));
        const high = Math.max(open, close) + Math.abs(variation) / 2;
        const low = Math.min(open, close) - Math.abs(variation) / 2;
        const nowStr = new Date().toISOString();

        const valeurNum = parseFloat(d.replace(",", ".")); // ✅ définition ajoutée

        // Table bougies
        const table = `bougies_${token}`;
        await db.exec(`
  CREATE TABLE IF NOT EXISTS ${table} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    open REAL,
    high REAL,
    low REAL,
    close REAL,
    time TEXT
  )
`);

        // Vérifier dernière bougie
        const lastCandle = await db.get(
          `SELECT close FROM ${table} ORDER BY id DESC LIMIT 1`
        );

        if (!lastCandle || lastCandle.close !== close) {
          await db.run(
            `INSERT INTO ${table} (open, high, low, close, time) VALUES (?, ?, ?, ?, ?)`,
            open,
            high,
            low,
            close,
            nowStr
          );

          await db.run(`
    DELETE FROM ${table}
    WHERE id NOT IN (
      SELECT id FROM ${table} ORDER BY id DESC LIMIT 550
    )
  `);
        }

        // Table historique
        const historyTable = `historique_${token}`;
        await db.exec(`
          CREATE TABLE IF NOT EXISTS ${historyTable} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            valeur REAL NOT NULL,
            heure TEXT NOT NULL
          )
        `);
        const lastHistoryRow = await db.get(
          `SELECT valeur FROM ${historyTable} ORDER BY id DESC LIMIT 1`
        );

        if (!lastHistoryRow || lastHistoryRow.valeur !== valeurNum) {
          await db.run(
            `INSERT INTO ${historyTable} (valeur, heure) VALUES (?, ?)`,
            valeurNum,
            nowStr
          );

          await db.run(`
    DELETE FROM ${historyTable}
    WHERE id NOT IN (
      SELECT id FROM ${historyTable} ORDER BY id DESC LIMIT 1000
    )
  `);
          // 🔔 Envoi WebSocket
          io.emit("newData", { token, valeur: valeurNum, heure: nowStr });
          console.log(
            `✅ Tâche ${token} exécutée avec succès et données recu ${valeurNum}`
          );
        }
      } catch (err) {
        console.error(`❌ Erreur tâche ${token}:`, err.message);
      }
    }
  }
}, 1000);
