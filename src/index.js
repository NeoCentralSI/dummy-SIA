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
      kknCompleted,
      researchMethodCompleted
    }) => ({
      nim,
      name,
      sksCompleted,
      currentSemester,
      mandatoryCoursesCompleted,
      mkwuCompleted,
      internshipCompleted,
      kknCompleted,
      researchMethodCompleted
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

// Per-semester academic data (NeoCentral Paket P, plan 10.6). SIA is read only: NeoCentral never
// writes here; titles of theses that passed Metode Penelitian leave NeoCentral as an export file.
const ENROLLMENTS_PATH = path.join(__dirname, "..", "data", "enrollments.json");
const loadPeriods = () => JSON.parse(fs.readFileSync(ENROLLMENTS_PATH, "utf-8")).periods;

const findPeriod = (req, res) => {
  const academicYear = String(req.query.academicYear || "").trim();
  const semester = String(req.query.semester || "").trim().toLowerCase();
  if (!academicYear || !["ganjil", "genap"].includes(semester)) {
    res.status(400).json({ success: false, message: "Parameter academicYear (mis. 2026/2027) dan semester (ganjil/genap) wajib diisi" });
    return null;
  }
  const period = loadPeriods().find((p) => p.academicYear === academicYear && p.semester === semester);
  if (!period) {
    res.status(404).json({ success: false, message: "Data semester tidak ditemukan" });
    return null;
  }
  return period;
};

// GET /enrollments?academicYear=2026/2027&semester=ganjil
app.get("/enrollments", tokenGuard, (req, res) => {
  const period = findPeriod(req, res);
  if (!period) return;
  res.json({
    success: true,
    period: { academicYear: period.academicYear, semester: period.semester },
    count: period.students.length,
    data: period.students
  });
});

// GET /enrollments/:nim?academicYear=2026/2027&semester=ganjil
app.get("/enrollments/:nim", tokenGuard, (req, res) => {
  const period = findPeriod(req, res);
  if (!period) return;
  const row = period.students.find((s) => s.nim === req.params.nim);
  if (!row) {
    return res.status(404).json({ success: false, message: "Mahasiswa tidak ditemukan pada semester ini" });
  }
  res.json({ success: true, period: { academicYear: period.academicYear, semester: period.semester }, data: row });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`SIA dummy API running at http://localhost:${PORT}`);
});
