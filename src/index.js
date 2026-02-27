import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4000;
const API_TOKEN = process.env.API_TOKEN || "dev-sia-token";
const DATA_PATH = path.join(__dirname, "..", "data", "students.json");

// Load data once at startup; can be replaced with DB later.
const loadStudents = () => JSON.parse(fs.readFileSync(DATA_PATH, "utf-8")).students;

const app = express();
app.use(express.json());

const tokenGuard = (req, res, next) => {
  const headerToken = req.headers["x-api-token"];
  const bearer = req.headers.authorization || "";
  const bearerToken = bearer.startsWith("Bearer ") ? bearer.slice(7) : null;
  const token = headerToken || bearerToken;

  if (!token || token !== API_TOKEN) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: invalid or missing token"
    });
  }
  next();
};

app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/students", tokenGuard, (req, res) => {
  const students = loadStudents();
  const full = String(req.query.full || "").toLowerCase() === "true";

  if (full) {
    return res.json({ success: true, count: students.length, data: students });
  }

  const summaries = students.map(
    ({
      nim,
      name,
      sksCompleted,
      currentSemester,
      mandatoryCoursesCompleted,
      mkwuCompleted,
      internshipCompleted,
      kknCompleted
    }) => ({
      nim,
      name,
      sksCompleted,
      currentSemester,
      mandatoryCoursesCompleted,
      mkwuCompleted,
      internshipCompleted,
      kknCompleted
    })
  );

  res.json({ success: true, count: summaries.length, data: summaries });
});

app.get("/students/:nim", tokenGuard, (req, res) => {
  const students = loadStudents();
  const student = students.find((s) => s.nim === req.params.nim);
  if (!student) {
    return res.status(404).json({ success: false, message: "Mahasiswa tidak ditemukan" });
  }
  res.json({ success: true, data: student });
});

app.get("/students/:nim/current-courses", tokenGuard, (req, res) => {
  const students = loadStudents();
  const student = students.find((s) => s.nim === req.params.nim);
  if (!student) {
    return res.status(404).json({ success: false, message: "Mahasiswa tidak ditemukan" });
  }
  res.json({
    success: true,
    data: {
      nim: student.nim,
      name: student.name,
      currentSemester: student.currentSemester,
      courses: student.currentSemesterCourses
    }
  });
});

app.post("/sync-ta", tokenGuard, (req, res) => {
  try {
    const syncData = req.body.data;
    if (!syncData || !Array.isArray(syncData)) {
      return res.status(400).json({ success: false, message: "Format data tidak valid" });
    }

    const snapshotDir = path.join(__dirname, "..", "data", "TA snapshot");
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = path.join(snapshotDir, `snapshot_${timestamp}.json`);

    fs.writeFileSync(filePath, JSON.stringify(syncData, null, 2), "utf-8");

    res.json({
      success: true,
      message: "Data Tugas Akhir berhasil disinkronisasi dan disimpan sebagai snapshot",
      filename: `snapshot_${timestamp}.json`,
      totalRecords: syncData.length
    });
  } catch (error) {
    console.error("Gagal menyimpan snapshot TA:", error);
    res.status(500).json({ success: false, message: "Terjadi kesalahan pada server SIA" });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`SIA dummy API running at http://localhost:${PORT}`);
});
