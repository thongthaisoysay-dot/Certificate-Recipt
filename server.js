const express = require("express");
const path = require("path");

const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || "./medical-certificates.db";
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
    return;
  }

  console.log("Connected to SQLite database");
});

db.run(`
  CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_name TEXT,
    birthdate TEXT,
    gender TEXT,
    nationality TEXT,
    id_passport_no TEXT,
    exam_date TEXT,
    exam_place TEXT,
    chief_complaint TEXT,
    clinical_findings TEXT,
    diagnosis TEXT,
    medication TEXT,
    procedure TEXT,
    medical_advice TEXT,
    doctor_name TEXT,
    license_no TEXT,
    consultation_fee REAL,
    medication_fee REAL,
    procedure_fee REAL,
    certificate_fee REAL,
    total_fee REAL,
    payment_method TEXT,
    created_at TEXT
  )
`);

app.use(express.json());
app.use(express.static(__dirname));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/certificates", (req, res) => {
  db.all("SELECT * FROM certificates ORDER BY id DESC", (err, rows) => {
    if (err) {
      return res.status(500).json({
        message: "Failed to fetch certificates",
        error: err.message,
      });
    }

    res.json(rows);
  });
});

app.post("/certificates", (req, res) => {
  const { patient, examination, medicalAdvice, doctor, billing } = req.body;

  const sql = `
    INSERT INTO certificates (
      patient_name,
      birthdate,
      gender,
      nationality,
      id_passport_no,
      exam_date,
      exam_place,
      chief_complaint,
      clinical_findings,
      diagnosis,
      medication,
      procedure,
      medical_advice,
      doctor_name,
      license_no,
      consultation_fee,
      medication_fee,
      procedure_fee,
      certificate_fee,
      total_fee,
      payment_method,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const adviceText = JSON.stringify(medicalAdvice);

  const values = [
    patient.name,
    patient.birthdate,
    patient.gender,
    patient.nationality,
    patient.idPassportNo,
    examination.date,
    examination.place,
    examination.chiefComplaint,
    examination.clinicalFindings,
    examination.diagnosis,
    examination.medication,
    examination.procedure,
    adviceText,
    doctor.name,
    doctor.licenseNo,
    billing.consultationFee,
    billing.medicationFee,
    billing.procedureFee,
    billing.medicalCertificateFee,
    billing.totalFee,
    billing.paymentMethod,
    new Date().toISOString(),
  ];

  db.run(sql, values, function (err) {
    if (err) {
      console.error("Insert error:", err.message);

      return res.status(500).json({
        message: "Failed to save certificate",
        error: err.message,
      });
    }

    res.json({
      message: "Certificate saved successfully",
      certificateId: this.lastID,
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
