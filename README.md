# dummy-SIA

Tiruan Sistem Informasi Akademik (SIA) untuk pengembangan dan pengujian NeoCentral. Repositori ini juga **menetapkan kontrak** yang harus dipenuhi SIA asli: adaptor SIA kampus cukup mengembalikan bentuk yang sama dengan rute di bawah.

- **Hanya dibaca.** NeoCentral tidak pernah menulis ke SIA. dummy-SIA tidak punya rute tulis.
- **Satu rute data.** `GET /students` berisi rekam akademik semua mahasiswa **untuk semester berjalan**. Riwayat semester disimpan NeoCentral sendiri.
- **Satu berkas data.** `data/students.json` berbentuk `{ "period": {...}, "students": [...] }`. Berkas dibaca ulang pada tiap permintaan, jadi perubahan langsung terlihat pada sinkronisasi berikutnya tanpa memulai ulang server.

## Autentikasi

Setiap permintaan ke `/students` wajib membawa token, dengan salah satu header:

```
x-api-token: <API_TOKEN>
Authorization: Bearer <API_TOKEN>
```

Token diatur lewat `API_TOKEN` di `.env` dummy-SIA dan harus sama dengan `SIA_API_TOKEN` di `.env` backend NeoCentral. `GET /health` tidak memerlukan token.

## Kontrak

### `GET /health`

```json
{ "status": "ok", "time": "2026-10-26T02:00:00.000Z" }
```

### `GET /students`

Respons `200`:

```json
{
  "success": true,
  "period": { "academicYear": "2026/2027", "semester": "ganjil" },
  "count": 1,
  "data": [
    {
      "nim": "2211523030",
      "name": "Khalied Nauly Maturino",
      "enrollmentYear": 2022,
      "studentStatus": "aktif",
      "currentSemester": 7,
      "sksCompleted": 140,
      "gpa": 2.9,
      "mandatoryCoursesCompleted": true,
      "mkwuCompleted": true,
      "internshipCompleted": false,
      "kknCompleted": true,
      "researchMethodCompleted": true,
      "currentCourses": [
        { "code": "IF5001", "name": "Tugas Akhir", "credits": 6 },
        { "code": "IF4010", "name": "Sistem Terdistribusi", "credits": 3 }
      ],
      "cplScores": [
        {
          "cplCode": "CPL-02",
          "description": "Mengintegrasikan solusi berbasis teknologi informasi secara efektif pada organisasi",
          "score": 84,
          "inputAt": "2026-02-26T10:15:00.000Z"
        }
      ]
    }
  ]
}
```

`period` menyatakan semester yang digambarkan data: semua `currentCourses` adalah KRS semester itu.

| Kolom | Tipe | Aturan nilai |
|---|---|---|
| `period.academicYear` | string | `YYYY/YYYY`, contoh `2026/2027` |
| `period.semester` | string | `ganjil` atau `genap` |
| `nim` | string | wajib; kunci pencocokan dengan akun NeoCentral |
| `name` | string | nama lengkap; dipakai sebagai pengaman saat mencocokkan nilai CPL |
| `enrollmentYear` | integer | tahun angkatan, contoh `2022`; menentukan kurikulum CPL |
| `studentStatus` | string | `aktif`, `cuti`, `lulus`, `mengundurkan_diri`, `drop_out` |
| `currentSemester` | integer | semester ke-berapa mahasiswa saat ini |
| `sksCompleted` | integer | total SKS lulus |
| `gpa` | number | IPK 0–4, dua desimal |
| `mandatoryCoursesCompleted` | boolean | semua mata kuliah wajib lulus |
| `mkwuCompleted` | boolean | mata kuliah wajib universitas lulus |
| `internshipCompleted` | boolean | Kerja Praktik lulus |
| `kknCompleted` | boolean | KKN lulus |
| `researchMethodCompleted` | boolean | Metode Penelitian lulus |
| `currentCourses` | array | KRS semester `period`: `{ code, name, credits }` (credits = SKS, integer). Daftar kosong `[]` berarti tidak mengambil mata kuliah apa pun |
| `cplScores` | array | nilai CPL: `{ cplCode, score, inputAt, description? }`. `score` 0–100, `inputAt` waktu ISO 8601. `description` opsional; bila dikirim harus sama dengan deskripsi CPL di NeoCentral |

Kolom yang tidak dikirim (atau `null`) dibiarkan apa adanya di NeoCentral.

### Pagination (opsional)

Tanpa parameter, semua rekam dikembalikan. Dengan `?page=<n>&pageSize=<m>` (bilangan bulat positif, `pageSize` maksimal 1000, bawaan 100) dikembalikan satu halaman ditambah:

```json
"pagination": { "page": 2, "pageSize": 40, "total": 88, "totalPages": 3 }
```

NeoCentral selalu meminta `?page=1&pageSize=500` dan mengikuti `totalPages`. SIA yang tidak mendukung pagination cukup mengabaikan parameter itu dan mengembalikan semua rekam tanpa `pagination`.

### Kode galat

| Status | Kapan | Isi |
|---|---|---|
| `401` | token tidak dikirim atau salah | `{ "success": false, "message": "Token tidak valid atau tidak dikirim" }` |
| `400` | `page`/`pageSize` bukan bilangan bulat positif, atau `pageSize` > 1000 | `{ "success": false, "message": "..." }` |
| `404` | rute lain | `{ "success": false, "message": "Rute tidak ditemukan" }` |
| `5xx` | data tidak dapat dibaca atau galat server | `{ "success": false, "message": "..." }` |

NeoCentral mengulang permintaan yang gagal hingga 3 kali dengan jeda, dan memberi batas waktu per permintaan (`SIA_FETCH_TIMEOUT`, bawaan 10 detik). Bila tetap gagal, sinkronisasi berhenti dan galatnya tampil di ringkasan.

## Cara NeoCentral memakainya

Penjelasan dari sisi backend ada di [`backend/src/docs/sia-sync.md`](https://github.com/NeoCentralSI/services/blob/main/src/docs/sia-sync.md).

- **Kapan**: Admin menekan **Sinkronkan SIA** di Data Mahasiswa, dan sinkronisasi terjadwal harian (bila cron backend aktif).
- **Pencocokan**: berdasarkan **NIM**. NIM yang tidak ada di NeoCentral dihitung "tidak ditemukan".
- **Data akademik**: SKS, semester, angkatan, IPK, dan penanda kelulusan mata kuliah ditulis ke data mahasiswa.
- **Status mahasiswa**: perubahan diterapkan dengan aturan yang sama seperti perubahan oleh Admin (Cuti menjeda TA, Drop Out menggagalkan TA).
- **Aturan periode**: penanda semester ("Mengambil Metode Penelitian", "Mengambil Tugas Akhir") **hanya** ditulis bila `period` sama dengan tahun ajaran aktif NeoCentral. Bila berbeda, penanda dilewati dan dilaporkan di ringkasan; data lain tetap masuk.
- **Pemetaan kode mata kuliah**: NeoCentral yang memutuskan dari `currentCourses`. Kode yang dipakai (`backend/src/constants/siaCourses.js`): Metode Penelitian **`IF4001`**, Tugas Akhir **`IF5001`**. Bila kode tidak dikenal, nama mata kuliah menjadi cadangan (`Metode Penelitian`/`Metodologi Penelitian`, `Tugas Akhir`/`Skripsi`).
- **Data manual tidak ditimpa**: penanda semester yang diisi Admin dipertahankan sampai Admin memilih **Ikuti Data SIA**; nilai CPL yang diisi manual dipertahankan. IPK dan status mahasiswa tidak punya penanda manual, jadi nilai SIA yang berlaku.
- **`SIA_BASE_URL` kosong**: tombol Sinkronkan menampilkan "Sinkronisasi SIA belum tersedia.", dan sinkronisasi terjadwal dilewati dengan satu baris log tanpa galat.

## Daftar periksa adaptor SIA asli

- [ ] Satu rute `GET /students` dengan header `x-api-token` atau `Authorization: Bearer`; `401` bila token salah.
- [ ] `period` diisi semester berjalan SIA (`academicYear` `YYYY/YYYY`, `semester` `ganjil`/`genap`).
- [ ] Semua kolom pada tabel di atas, dengan nama dan tipe yang sama; nilai `studentStatus` dipetakan ke lima nilai yang diizinkan.
- [ ] `gpa` sebagai angka (bukan string berkoma), dua desimal.
- [ ] `currentCourses` memuat KRS semester `period`, dengan kode mata kuliah Metode Penelitian dan Tugas Akhir yang sama dengan `siaCourses.js` (atau perbarui berkas itu).
- [ ] `cplScores[].cplCode` sama dengan kode CPL kurikulum di NeoCentral.
- [ ] Pagination `page`/`pageSize` dengan `pagination.totalPages`, atau semua rekam sekaligus.
- [ ] Respons dalam batas waktu `SIA_FETCH_TIMEOUT`.
- [ ] Uji dengan langkah "Menjalankan secara lokal" di bawah, mengganti `SIA_BASE_URL` ke adaptor.

## Menjalankan secara lokal

```bash
cp .env.example .env     # API_TOKEN dan PORT (bawaan 4000)
pnpm install
pnpm dev                 # http://localhost:4000, memuat ulang saat kode berubah
```

Di `.env` backend NeoCentral:

```
SIA_BASE_URL=http://localhost:4000
SIA_API_TOKEN=<sama dengan API_TOKEN dummy-SIA>
SIA_MOCK=false
```

Coba:

```bash
curl -H "x-api-token: dev-sia-token" http://localhost:4000/students
curl -H "Authorization: Bearer dev-sia-token" "http://localhost:4000/students?page=1&pageSize=20"
```

Untuk menguji berkas data lain tanpa mengubah `data/students.json`, jalankan dengan `SIA_DATA_PATH=/jalur/berkas.json`.

## Menjalankan dengan Docker

```bash
cp .env.example .env
docker compose up -d --build     # http://localhost:4000
```

- Backend di Docker pada mesin yang sama: `SIA_BASE_URL=http://host.docker.internal:4000`.
- Bawaannya port terbuka di `0.0.0.0` (`DUMMY_SIA_BIND`). Port Docker tidak ditutup oleh UFW. Agar tidak terbuka ke internet, isi `DUMMY_SIA_BIND` dengan alamat `docker0` (biasanya `172.17.0.1`). `127.0.0.1` tidak bisa dijangkau container backend.
- `data/students.json` ikut masuk ke image. Setelah diubah, jalankan ulang `docker compose up -d --build`.
