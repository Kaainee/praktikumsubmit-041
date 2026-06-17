require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const multer = require("multer");
const { BlobServiceClient } = require("@azure/storage-blob");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

const upload = multer({ storage: multer.memoryStorage() });

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: "db_praktikumsubmit",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false,
  },
});

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.STORAGE_CONN_STRING,
);
const containerClient = blobServiceClient.getContainerClient("tugas-praktikum");

app.post("/submit-task", upload.single("file_tugas"), async (req, res) => {
  try {
    const { nim, name, class: kelas, course } = req.body;
    const file = req.file;

    if (!file) return res.status(400).send("File tugas wajib diunggah.");

    const blobName = `${nim}_${name}_${file.originalname}`.replace(/\s+/g, "_");
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(file.buffer);

    const fileUrl = blockBlobClient.url;

    const query = `INSERT INTO submissions (nim, name, class, course, file_url, status) VALUES (?, ?, ?, ?, ?, 'Submitted')`;
    await db.execute(query, [nim, name, kelas, course, fileUrl]);

    res.send(
      "Tugas berhasil dikumpulkan! Data dan file telah tersimpan aman di Azure.",
    );
  } catch (error) {
    console.error(error);
    res.status(500).send("Terjadi kesalahan pada server saat memproses tugas.");
  }
});

app.get("/task-list", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM submissions");
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).send("Gagal mengambil daftar tugas dari database.");
  }
});

app.get("/task-detail", async (req, res) => {
  const id = req.query.id;
  try {
    const [rows] = await db.query("SELECT * FROM submissions WHERE id = ?", [
      id,
    ]);
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(404).send("Data tugas tidak ditemukan.");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Gagal mengambil detail tugas.");
  }
});

app.get("/admin-login", (req, res) => {
  res.send(
    "<h1>Halaman Login Admin</h1><p>Masih dalam tahap pengembangan UI.</p>",
  );
});

app.listen(port, () => {
  console.log(`Server PraktikumSubmit berjalan di port ${port}`);
});
