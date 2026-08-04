# Tribangun Project Guidelines

## Project Context
- **App:** Dashboard Tracking Invoice bergaya monday.com (real-time, zero-lag UI).
- **Stack:** Next.js (App Router), Supabase, Tailwind CSS.

## 1. Token & Cost Optimization (CRITICAL)
- **No Boilerplate / No Yapping:** Jangan berikan penjelasan teoritis kecuali diminta. Langsung berikan kode.
- **Partial Code Generation:** Jika memodifikasi file yang sudah ada, JANGAN tulis ulang seluruh isi file. Berikan hanya fungsi, komponen, atau baris spesifik yang berubah dengan penanda komentar `// ... kode sebelumnya` agar hemat token *output*.
- **Targeted Reading:** DILARANG melakukan pencarian/pembacaan file secara global (men-scan seluruh direktori) kecuali saya secara eksplisit menyuruh "cari di mana fungsi ini berada". Jika saya menyebut nama file (misal `@PRForm.tsx`), baca file itu saja.
- **Zero-Write Logic:** Perhitungan status waktu (Priority, Upcoming, Overdue) WAJIB dilakukan di *client-side*. Dilarang membuat arsitektur *cron job* atau *query* yang melakukan *update* massal ke database setiap hari demi menghemat *write quota* Supabase.

## 2. Supabase Strict Rules
- **Mutation Returns:** Setiap operasi `insert()` atau `update()` di Supabase WAJIB diakhiri dengan `.select()` atau `.select().single()` jika data barunya dibutuhkan oleh *frontend*. Jangan biarkan hasil balikan menjadi *undefined* (seperti kasus `pr_no`).
- **Error Handling:** Semua *query* database harus dibungkus dengan pengecekan `if (error)` atau blok `try/catch`. Jangan pernah mengasumsikan *query* selalu berhasil.
- **RLS & Auth:** Asumsikan Row Level Security (RLS) aktif. Pastikan operasi database memperhitungkan *session user* yang sedang *login*.

## 3. UI/UX & Tailwind Standards
- **Monday.com Vibe:** Gunakan desain yang modern, *clean*, dan interaktif. 
- **Zero-Lag UI:** Sebisa mungkin gunakan *Optimistic UI Updates* untuk aksi seperti merubah status atau menghapus baris agar terasa instan bagi pengguna.

## 4. Git & Workflow Automation
- **Auto-Commit & Push:** Setelah kamu berhasil memperbaiki bug atau menambahkan fitur yang saya minta, OTOMATIS jalankan perintah Git di terminal secara berurutan: `git add .`, `git commit -m "[pesan commit]"`, dan `git push`. Jangan tanya saya lagi, langsung eksekusi.