# Tribangun Project Guidelines

## Project Context
- **App:** Dashboard Tracking Invoice & Purchasing Request (PR) bergaya monday.com (real-time, zero-lag UI).
- **Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Supabase, @tanstack/react-query, @tanstack/react-virtual.

## 1. Token & Cost Optimization (CRITICAL)
- **No Boilerplate / No Yapping:** Jangan berikan penjelasan teoritis kecuali diminta. Langsung berikan kode.
- **Partial Code Generation:** Jika memodifikasi file yang sudah ada, JANGAN tulis ulang seluruh isi file. Berikan hanya fungsi, komponen, atau baris spesifik yang berubah dengan penanda komentar `// ... kode sebelumnya` agar hemat token output.
- **Targeted Reading:** DILARANG melakukan pencarian/pembacaan file secara global (men-scan seluruh direktori) kecuali diinstruksikan eksplisit. Jika menyebut nama file, baca file itu saja.

## 2. Supabase & Database Architecture (STRICT)
- **Service-Role Convention:** Gunakan raw fetch ke PostgREST via konvensi `supabaseConfig` service-role. DILARANG menggunakan client `supabase-js` standar.
- **Server-Side Filtering:** Gunakan PostgREST embedded-resource inner-join filtering (contoh: `purchase_request_items!inner(...)`) untuk predicate filter level-item menjadi query bucket server-side.
- **Keyset Pagination:** Gunakan cursor pagination pada `(created_at, id)` dengan opaque-string cursor handling. Dilarang melakukan *parse* ke JS Date agar presisi microsecond Postgres terjaga.
- **Mutation Returns:** Setiap operasi `insert()` atau `update()` di Supabase WAJIB diakhiri dengan `.select()` atau `.select().single()`. Jangan biarkan hasil balikan menjadi undefined.
- **Error Handling & RLS:** Semua query database harus dibungkus dengan pengecekan `if (error)` atau blok `try/catch`. Asumsikan RLS aktif.

## 3. Business Logic & State Rules
- **Item-Derived Bucket Pattern (High-Water Mark):** Status level-PR JANGAN menggunakan pencocokan literal (status=eq.X). Status harus dikalkulasi berdasarkan item di dalamnya (menggunakan predicate `pr.items.some()`) melalui library sentral di `lib/purchase-request/status-rules.ts`.
- **Business-Day Math:** Untuk kalkulasi timer SLA/Tenggat, WAJIB menggunakan perhitungan hari kerja (Senin-Jumat) via `addBusinessDays` / `getBusinessDaysDifference` di `lib/date-utils.ts`, bukan hitungan kalender biasa.
- **Zero-Write Logic:** Perhitungan status waktu (Priority, Upcoming, Overdue) WAJIB di client-side. Dilarang membuat cron job update massal ke database harian demi kuota write.

## 4. UI/UX & Tailwind Standards
- **Monday.com Vibe:** Gunakan desain yang modern, clean, dan interaktif.
- **Zero-Lag UI:** Gunakan *Optimistic UI Updates* via React Query untuk mutasi agar instan, dan kombinasikan dengan dynamic row measurement (`useVirtualizer`) untuk tabel data berskala besar.

## 5. Git & Workflow Automation
- **Auto-Commit & Push:** Setelah berhasil memperbaiki bug/menambahkan fitur, OTOMATIS jalankan di terminal: `git add .`, `git commit -m "[pesan commit]"`, dan `git push` tanpa bertanya.