import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 4000;
const API_TOKEN = process.env.API_TOKEN || "dev-sia-token";
const DATA_PATH = process.env.SIA_DATA_PATH || path.join(__dirname, "..", "data", "students.json");

// Read on every request, so an edit of the file shows at the next sync without a restart.
const loadData = () => JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));

const app = express();

const tokenGuard = (req, res, next) => {
  const headerToken = req.headers["x-api-token"];
  const bearer = req.headers.authorization || "";
  const bearerToken = bearer.startsWith("Bearer ") ? bearer.slice(7) : null;
  const token = headerToken || bearerToken;
  if (!token || token !== API_TOKEN) {
    return res.status(401).json({ success: false, message: "Token tidak valid atau tidak dikirim" });
  }
  next();
};

const positiveInt = (value) => {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

/**
 * GET /students: the academic records of the running semester.
 * Without `page`/`pageSize` every record is returned; with them, one page and `pagination`.
 */
app.get("/students", tokenGuard, (req, res) => {
  const page = positiveInt(req.query.page);
  const pageSize = positiveInt(req.query.pageSize);
  if (page === null || pageSize === null || (pageSize !== undefined && pageSize > 1000)) {
    return res.status(400).json({ success: false, message: "Parameter page dan pageSize harus bilangan bulat positif (pageSize maksimal 1000)" });
  }

  let data;
  try {
    data = loadData();
  } catch (err) {
    return res.status(500).json({ success: false, message: `Data SIA tidak dapat dibaca: ${err.message}` });
  }
  const students = data.students ?? [];

  if (page === undefined && pageSize === undefined) {
    return res.json({ success: true, period: data.period, count: students.length, data: students });
  }

  const size = pageSize ?? 100;
  const current = page ?? 1;
  const slice = students.slice((current - 1) * size, current * size);
  res.json({
    success: true,
    period: data.period,
    count: slice.length,
    data: slice,
    pagination: { page: current, pageSize: size, total: students.length, totalPages: Math.max(1, Math.ceil(students.length / size)) },
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Rute tidak ditemukan" });
});

app.listen(PORT, () => {
  console.log(`SIA dummy API running at http://localhost:${PORT}`);
});
