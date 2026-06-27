# Parametric Conic Curve Generator

Implementasi algoritma parametrik untuk generate 4 kurva conic: **lingkaran**, **elips**, **parabola**, dan **hiperbola**. Dibuat untuk tugas Computer Graphics, fokus ngebandingin efek delta/step value ke kehalusan kurva dan beban komputasi.

UI-nya interaktif — semua parameter bisa diatur lewat slider secara real-time, lengkap dengan tabel koordinat hasil iterasi dan metrik komputasi.

## Fitur

- **4 kurva conic** — lingkaran, elips, parabola, hiperbola, masing-masing dengan formula parametriknya sendiri
- **Kontrol real-time** — slider buat konstanta kurva (radius, a, b, dll) dan delta/step iterasi
- **Toggle satuan sudut** — radian, derajat, atau keduanya sekaligus
- **Tabel koordinat live** — nunjukin hasil literal dari perulangan, update tiap slider digeser
- **Metrik komputasi** — jumlah titik, jumlah evaluasi trigonometri, jumlah segmen garis, sampai estimasi beban relatif (rendah/sedang/tinggi)
- **Tracer dot** — titik yang looping di sepanjang kurva, visualisasi parameter `t` yang "bergerak" membentuk kurva

## Formula yang dipakai

| Kurva | Parametrik |
|---|---|
| Lingkaran | `x = xc + r·cos(t)`, `y = yc + r·sin(t)` |
| Elips | `x = a·cos(t)`, `y = b·sin(t)` |
| Parabola | `x = a·t²`, `y = 2a·t` |
| Hiperbola | `x = a/cos(t)`, `y = b·tan(t)` |

## Stack

Vanilla HTML/CSS/JS — tanpa framework, tanpa build step. Animasi pakai [GSAP](https://gsap.com/) buat transisi tab dan micro-interaction, render kurva pakai SVG murni.

## Cara jalanin

Cuma file statis, jadi:

```bash
git clone <repo-url>
cd <folder>
```

Lalu buka `index.html` langsung di browser. Atau kalau mau lewat local server:

```bash
python3 -m http.server 8000
```

terus akses `localhost:8000`.

> Catatan: pastikan `index.html`, `style.css`, dan `app.js` ada di folder yang sama — file-nya saling referensi satu sama lain.

## Struktur file
.

├── index.html   # struktur 4 halaman kurva + navbar

├── style.css    # styling, tema graph-paper instrument

└── app.js       # logic perhitungan parametrik, render SVG, interaksi

## Kenapa delta/step penting

Delta (`Δt`) nentuin jarak antar titik yang di-sample sepanjang parameter `t`. Delta kecil → titik makin banyak → kurva makin halus, tapi makin berat dihitung. Delta besar → titik dikit → kurva jadi keliatan seperti polygon/patah-patah, tapi komputasinya ringan. Trade-off ini yang jadi fokus eksplorasi di project ini.

---

Tugas mata kuliah Computer Graphics — Parametric Generation of Conic Curves.
