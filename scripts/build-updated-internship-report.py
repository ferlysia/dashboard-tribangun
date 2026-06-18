from __future__ import annotations

import html
import os
import re
import shutil
import subprocess
import textwrap
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = Path("/Users/ferlysia/Documents/kane/LAPORAN KEGIATAN MAGANG - Kane Chen (825230145).docx")
OUT = ROOT / "LAPORAN KEGIATAN MAGANG - Kane Chen (825230145) - REVISI DARI WORD ASLI.docx"
BUILD = ROOT / ".tmp_report_docx"


def esc(text: str) -> str:
    return html.escape(text, quote=False)


def para(text: str = "", style: str = "Normal", align: str | None = None, page_break_before: bool = False) -> str:
    jc = f'<w:jc w:val="{align}"/>' if align else ""
    pb = '<w:pageBreakBefore/>' if page_break_before else ""
    ppr = f"<w:pPr><w:pStyle w:val=\"{style}\"/>{pb}{jc}</w:pPr>"
    if not text:
        return f"<w:p>{ppr}</w:p>"
    runs = []
    for i, part in enumerate(text.split("\n")):
        if i:
            runs.append("<w:r><w:br/></w:r>")
        runs.append(f'<w:r><w:t xml:space="preserve">{esc(part)}</w:t></w:r>')
    return f"<w:p>{ppr}{''.join(runs)}</w:p>"


def heading(text: str, level: int = 1, page_break_before: bool = False) -> str:
    return para(text, f"Heading{level}", page_break_before=page_break_before)


def page_break() -> str:
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'


def bullet(text: str) -> str:
    return (
        '<w:p><w:pPr><w:pStyle w:val="ListParagraph"/>'
        '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>'
        f'<w:r><w:t xml:space="preserve">{esc(text)}</w:t></w:r></w:p>'
    )


def numbered(text: str) -> str:
    return (
        '<w:p><w:pPr><w:pStyle w:val="ListParagraph"/>'
        '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr>'
        f'<w:r><w:t xml:space="preserve">{esc(text)}</w:t></w:r></w:p>'
    )


def table(rows: list[list[str]], widths: list[int]) -> str:
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    out = [
        '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/>'
        '<w:tblW w:w="9360" w:type="dxa"/>'
        '<w:tblInd w:w="120" w:type="dxa"/>'
        '<w:tblLook w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>'
        '</w:tblPr><w:tblGrid>',
        grid,
        "</w:tblGrid>",
    ]
    for r_i, row in enumerate(rows):
        out.append("<w:tr>")
        for c_i, cell in enumerate(row):
            fill = '<w:shd w:fill="F2F4F7"/>' if r_i == 0 else ""
            bold = "<w:b/>" if r_i == 0 else ""
            out.append(
                f'<w:tc><w:tcPr><w:tcW w:w="{widths[c_i]}" w:type="dxa"/>{fill}'
                '<w:tcMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/>'
                '<w:start w:w="120" w:type="dxa"/><w:end w:w="120" w:type="dxa"/></w:tcMar></w:tcPr>'
                f'<w:p><w:pPr><w:spacing w:after="60" w:line="276" w:lineRule="auto"/></w:pPr>'
                f'<w:r><w:rPr>{bold}</w:rPr><w:t xml:space="preserve">{esc(cell)}</w:t></w:r></w:p></w:tc>'
            )
        out.append("</w:tr>")
    out.append("</w:tbl>")
    return "".join(out)


def body_parts() -> list[str]:
    parts: list[str] = []

    parts += [
        para("LAPORAN AKHIR MAGANG INDUSTRI", "Title", "center"),
        para("PENGEMBANGAN SISTEM DASHBOARD TERINTEGRASI UNTUK DOCUMENT CONTROL, COST CONTROL, FINANCE, DAN BOS VIEW PADA PT TRI BANGUN USAHA PERSADA", "Subtitle", "center"),
        para("", "Normal"),
        para("Disusun Oleh:", "Normal", "center"),
        para("Kane Chen", "Heading2", "center"),
        para("825230145", "Normal", "center"),
        para("", "Normal"),
        para("PROGRAM STUDI SISTEM INFORMASI", "Normal", "center"),
        para("FAKULTAS TEKNOLOGI INFORMASI", "Normal", "center"),
        para("UNIVERSITAS TARUMANAGARA", "Normal", "center"),
        para("2026", "Normal", "center"),
        page_break(),
        heading("KATA PENGANTAR", 1),
        para("Puji dan syukur penulis panjatkan kepada Tuhan Yang Maha Esa atas berkat dan rahmat-Nya sehingga penulis dapat menyelesaikan kegiatan magang serta menyusun Laporan Kegiatan Magang ini. Laporan ini disusun sebagai bentuk pertanggungjawaban atas kegiatan magang yang dilaksanakan di PT Tri Bangun Usaha Persada, sekaligus sebagai dokumentasi teknis atas sistem dashboard operasional yang dikembangkan selama masa magang."),
        para("Pada draft sebelumnya, sistem yang dijelaskan masih berfokus pada dashboard monitoring invoice. Setelah implementasi berkembang, sistem tidak lagi hanya berfungsi sebagai pemantauan invoice pasif, melainkan menjadi dashboard terintegrasi yang menghubungkan Document Control, Cost Control, Finance, dan Bos View. Perubahan tersebut membuat laporan perlu diperbarui agar alur kerja, hubungan data, arsitektur modul, serta manfaat sistem sesuai dengan implementasi aktual."),
        para("Penulis mengucapkan terima kasih kepada dosen pembimbing, koordinator magang, mentor industri, keluarga, serta seluruh pihak yang telah memberikan arahan dan dukungan selama pelaksanaan magang. Penulis menyadari bahwa laporan ini masih dapat disempurnakan. Oleh karena itu, kritik dan saran yang membangun sangat diharapkan agar dokumentasi dan pengembangan sistem dapat semakin baik."),
        para("Jakarta, 2026"),
        para("Penulis,\nKane Chen\n825230145"),
        page_break(),
        heading("RINGKASAN", 1),
        para("Kegiatan magang ini dilaksanakan di PT Tri Bangun Usaha Persada dengan fokus pada pengembangan sistem dashboard operasional berbasis web. Sistem yang dikembangkan berevolusi dari dashboard monitoring invoice menjadi sistem terintegrasi yang menghubungkan siklus pekerjaan proyek, pengendalian biaya, kesiapan penagihan, dan ringkasan eksekutif. Empat komponen utama yang menjadi pusat pengembangan adalah Document Control Page, Finance Page, Cost Control Page, dan Bos View Module."),
        para("Document Control Page berperan sebagai pusat data proyek dan progres lapangan. Modul ini menyimpan identitas proyek, data klien, nomor PO, nilai PO, variation order, PIC, target selesai, jadwal fase pekerjaan, dokumentasi log mingguan, foto lapangan, dan jadwal termin pembayaran. Progress fisik dihitung dari bobot fase yang selesai sehingga data progress tidak hanya diisi sebagai angka manual, tetapi terkait dengan struktur pekerjaan yang dapat dilacak."),
        para("Finance Page menggunakan data progress dan termin schedule dari Document Control untuk membuka status penagihan secara otomatis melalui mekanisme SOW Bridge. Termin yang belum memenuhi target progress berada pada status TERKUNCI; ketika progress proyek memenuhi target termin, status menjadi SIAP_TAGIH; setelah invoice dikirim status berubah menjadi PROSES_COLLECT; dan setelah pembayaran selesai status menjadi LUNAS. Cost Control Page mengelola budget, biaya aktual, stream biaya PO utama dan VO, serta escalation gate ketika biaya VO mencapai 80% atau melebihi budget. Bos View menyatukan data progress, margin, biaya, status tagihan, dan pembaruan terakhir agar pimpinan dapat melihat kondisi proyek secara ringkas."),
        para("Sistem dikembangkan menggunakan Next.js, React, TypeScript, Tailwind CSS, komponen UI berbasis Radix, Recharts, serta Supabase/PostgreSQL sebagai backend. Hasil kegiatan magang adalah sistem dashboard terintegrasi yang membantu perusahaan mengurangi ketergantungan pada spreadsheet terpisah, memperjelas hubungan antara progres lapangan dan penagihan, meningkatkan kontrol biaya proyek, serta menyediakan ringkasan eksekutif yang berbasis data operasional aktual."),
        para("Kata Kunci: Document Control, Cost Control, Finance, Bos View, Dashboard Terintegrasi, Next.js, Supabase, Project Lifecycle."),
        page_break(),
        heading("DAFTAR ISI", 1),
    ]

    toc = [
        "BAB I PENDAHULUAN",
        "1.1 Latar Belakang",
        "1.2 Tujuan Magang Industri",
        "1.3 Tempat dan Waktu Pelaksanaan",
        "1.4 Proses Seleksi",
        "1.5 Ruang Lingkup Pembaruan Sistem",
        "BAB II PROFIL PERUSAHAAN",
        "2.1 Sejarah dan Bidang Kegiatan Perusahaan",
        "2.2 Struktur Organisasi dan Lingkungan Kerja",
        "2.3 Permasalahan Operasional",
        "BAB III KEGIATAN MAGANG",
        "3.1 Gambaran Umum Kegiatan Magang",
        "3.2 Analisis Kebutuhan Sistem",
        "3.3 Arsitektur Sistem Terintegrasi",
        "3.4 Implementasi Document Control Page",
        "3.5 Implementasi Cost Control Page",
        "3.6 Implementasi Finance Page",
        "3.7 Implementasi Bos View Module",
        "3.8 Integrasi Database dan API",
        "3.9 Pengujian Sistem",
        "3.10 Hambatan dan Solusi",
        "BAB IV PENILAIAN MAGANG",
        "4.1 Keterampilan dan Kualifikasi yang Didapatkan",
        "4.2 Teknologi yang Digunakan",
        "4.3 Pengaruh Magang untuk Karier Masa Depan",
        "4.4 Hubungan Kegiatan Magang dengan Mata Kuliah",
        "BAB V PENUTUP",
        "5.1 Kesimpulan",
        "5.2 Saran",
        "DAFTAR PUSTAKA",
    ]
    parts += [para(item) for item in toc]

    parts += [
        heading("BAB I PENDAHULUAN", 1, True),
        heading("1.1 Latar Belakang", 2),
        para("Perusahaan yang menjalankan pekerjaan proyek membutuhkan koordinasi antara beberapa bagian operasional. Data proyek tidak hanya terdiri dari invoice, tetapi juga identitas proyek, dokumen PO, jadwal pekerjaan, progress fisik, dokumentasi lapangan, biaya aktual, variation order, dan status penagihan. Apabila setiap bagian mengelola data secara terpisah, perusahaan berisiko mengalami keterlambatan informasi, perbedaan angka antarbagian, serta kesulitan dalam menentukan prioritas tindak lanjut."),
        para("Pada tahap awal, sistem yang dikembangkan dalam kegiatan magang masih digambarkan sebagai Web Monitoring Dashboard untuk invoice. Narasi tersebut cukup untuk menjelaskan kebutuhan pemantauan piutang, namun belum mewakili perkembangan implementasi saat ini. Dalam implementasi terbaru, sistem telah berubah menjadi dashboard operasional terintegrasi yang mendukung alur proyek dari perencanaan, pelaksanaan, pengendalian biaya, penagihan termin, hingga ringkasan eksekutif."),
        para("Perubahan paling penting terletak pada hubungan antara progres pekerjaan dan proses penagihan. Pada proses manual, bagian finance perlu menunggu informasi dari lapangan atau dokumen pendukung untuk mengetahui apakah suatu termin sudah dapat ditagihkan. Dalam sistem baru, Document Control menyimpan jadwal pekerjaan dan progress fisik; Finance membaca termin schedule dan progress tersebut; Cost Control membaca nilai kontrak dan biaya aktual; sedangkan Bos View menyajikan kondisi proyek secara ringkas. Dengan demikian, dashboard tidak lagi hanya menampilkan data invoice yang sudah ada, tetapi menjadi alat koordinasi lintas fungsi."),
        para("Pengembangan sistem ini penting karena PT Tri Bangun Usaha Persada membutuhkan informasi yang cepat, konsisten, dan mudah diverifikasi. Data proyek yang tersimpan dalam satu alur terintegrasi dapat membantu perusahaan melihat apakah suatu proyek berjalan sesuai jadwal, apakah biaya masih berada dalam batas aman, apakah termin sudah siap ditagihkan, dan proyek mana yang perlu perhatian manajemen."),
        heading("1.2 Tujuan Magang Industri", 2),
        para("Tujuan kegiatan magang adalah menerapkan ilmu Sistem Informasi dalam pengembangan aplikasi web yang menjawab kebutuhan operasional nyata perusahaan. Secara khusus, kegiatan ini bertujuan untuk menganalisis proses bisnis proyek, merancang modul dashboard yang terintegrasi, mengimplementasikan fitur pengelolaan proyek, biaya, termin, dan ringkasan eksekutif, serta mendokumentasikan hubungan data antarbagian secara sistematis."),
        para("Tujuan teknis dari pengembangan sistem adalah menyediakan master data proyek pada Document Control, menyediakan pencatatan biaya aktual dan budget pada Cost Control, menyediakan mekanisme invoice lifecycle berbasis termin pada Finance, dan menyediakan Bos View sebagai ringkasan lintas modul untuk pimpinan. Dengan tujuan tersebut, sistem diharapkan dapat membantu perusahaan meningkatkan transparansi operasional dan mengurangi ketergantungan pada rekap manual."),
        heading("1.3 Tempat dan Waktu Pelaksanaan", 2),
        para("Magang dilaksanakan di PT Tri Bangun Usaha Persada. Kegiatan dilakukan dalam lingkungan kerja yang berkaitan dengan pengembangan sistem internal perusahaan, khususnya sistem dashboard berbasis web untuk mendukung pekerjaan administrasi proyek, kontrol biaya, finance, dan monitoring eksekutif. Periode pelaksanaan mengikuti jadwal magang industri tahun akademik 2026."),
        heading("1.4 Proses Seleksi", 2),
        para("Proses seleksi dan penempatan dilakukan melalui koordinasi antara mahasiswa, pihak kampus, dan perusahaan. Setelah diterima, penulis memperoleh arahan mengenai kebutuhan sistem, struktur data awal, serta kendala operasional yang dihadapi perusahaan. Kegiatan magang kemudian diarahkan pada pengembangan fitur yang dapat digunakan secara langsung untuk membantu pekerjaan internal."),
        heading("1.5 Ruang Lingkup Pembaruan Sistem", 2),
        para("Ruang lingkup laporan revisi ini adalah menjelaskan sistem sebagaimana implementasi aktual di workspace, bukan lagi narasi lama mengenai dashboard invoice pasif. Empat komponen yang dianalisis adalah Document Control Page pada route /dashboard/doc-con, Cost Control Page pada route /dashboard/cost-control, Finance Page pada route /dashboard/finance, dan Bos View Module pada route /projects/executive-view. Keempat modul tersebut terhubung melalui API internal dan tabel Supabase seperti project_details, project_schedule_items, project_weekly_logs, project_costs, project_escalations, dan termin_invoices."),

        heading("BAB II PROFIL PERUSAHAAN", 1, True),
        heading("2.1 Sejarah dan Bidang Kegiatan Perusahaan", 2),
        para("PT Tri Bangun Usaha Persada merupakan perusahaan yang bergerak pada bidang distribusi dan layanan terkait produk PAC, sistem otomasi, serta dukungan teknis untuk kebutuhan industri. Dalam pelaksanaan proyek, perusahaan perlu mengelola dokumen, jadwal, biaya, dan proses penagihan secara konsisten agar pekerjaan dapat berjalan sesuai kontrak dan target operasional."),
        para("Karakteristik pekerjaan perusahaan membuat data proyek menjadi sangat penting. Satu proyek dapat memiliki PO utama, kerja tambah atau variation order, jadwal pekerjaan bertahap, bukti dokumentasi lapangan, serta termin pembayaran yang bergantung pada progress fisik. Oleh sebab itu, sistem informasi internal perlu mampu menampung data yang berhubungan, bukan hanya data invoice akhir."),
        heading("2.2 Struktur Organisasi dan Lingkungan Kerja", 2),
        para("Lingkungan kerja yang terkait dengan pengembangan sistem melibatkan beberapa peran. Bagian Document Control bertanggung jawab terhadap data proyek, dokumen, jadwal, progress, dan catatan lapangan. Bagian Cost Control bertanggung jawab memantau budget, biaya aktual, dan risiko over budget. Bagian Finance bertanggung jawab menindaklanjuti termin yang sudah dapat ditagihkan. Pimpinan membutuhkan ringkasan yang mudah dipahami untuk menilai kesehatan proyek."),
        para("Pengembangan dashboard dilakukan dengan memahami kebutuhan setiap peran tersebut. Sistem dirancang agar setiap bagian dapat bekerja pada modul masing-masing, namun tetap berbagi data melalui project_key sebagai identitas utama proyek. Dengan pendekatan tersebut, setiap perubahan pada satu modul dapat memberi pengaruh langsung terhadap modul lain yang membutuhkan data tersebut."),
        heading("2.3 Permasalahan Operasional", 2),
        para("Permasalahan utama yang ditemukan adalah fragmentasi data. Informasi proyek, progress, biaya, VO, dan invoice dapat tersebar di spreadsheet, dokumen, atau komunikasi informal. Fragmentasi tersebut membuat proses validasi menjadi lambat, terutama ketika finance perlu memastikan apakah termin sudah memenuhi syarat untuk ditagihkan atau ketika pimpinan perlu melihat proyek yang margin-nya menurun."),
        para("Permasalahan kedua adalah kurangnya keterhubungan antara progress fisik dan status penagihan. Tanpa mekanisme yang menghubungkan kedua data tersebut, status SIAP_TAGIH sering bergantung pada pengecekan manual. Permasalahan ketiga adalah kurangnya peringatan dini terhadap biaya kerja tambah. Biaya VO yang tidak dipantau secara real-time dapat menyebabkan budget terlampaui sebelum diketahui oleh pihak terkait."),

        heading("BAB III KEGIATAN MAGANG", 1, True),
        heading("3.1 Gambaran Umum Kegiatan Magang", 2),
        para("Kegiatan magang berfokus pada analisis, perancangan, dan implementasi sistem dashboard berbasis web. Penulis terlibat dalam memahami kebutuhan pengguna, membaca struktur data, membangun antarmuka, membuat API internal, menghubungkan frontend dengan Supabase, serta menyusun logika bisnis agar alur antarbagian saling terintegrasi."),
        para("Sistem dikembangkan menggunakan pola aplikasi Next.js App Router. Halaman utama modul berada pada folder app/dashboard dan app/projects. Komunikasi data dilakukan melalui API route di folder app/api yang meneruskan request ke Supabase REST API menggunakan service role key. Data proyek disimpan pada tabel project_details sebagai master, sedangkan data operasional disimpan pada tabel child sesuai kebutuhan modul."),
        heading("3.2 Analisis Kebutuhan Sistem", 2),
        para("Kebutuhan sistem dianalisis dari empat alur utama. Pertama, perusahaan membutuhkan tempat untuk membuat dan memperbarui proyek beserta PO, klien, lokasi, PIC, nilai kontrak, target selesai, VO, termin schedule, dan progress. Kedua, perusahaan membutuhkan pencatatan biaya aktual yang dipisahkan antara PO utama dan VO. Ketiga, perusahaan membutuhkan workflow invoice termin yang otomatis mengikuti progress fisik. Keempat, pimpinan membutuhkan tampilan ringkas untuk melihat proyek aktif, margin, progress, dan status tagihan."),
        para("Dari kebutuhan tersebut, sistem dirancang sebagai project lifecycle dashboard. Project lifecycle dimulai dari pembuatan proyek di Document Control, dilanjutkan dengan pengisian jadwal dan log, pengendalian biaya di Cost Control, pembukaan termin di Finance, dan pemantauan keseluruhan pada Bos View. Alur tersebut menggantikan pendekatan lama yang hanya menampilkan daftar invoice."),
        heading("3.3 Arsitektur Sistem Terintegrasi", 2),
        para("Arsitektur sistem menggunakan Next.js sebagai frontend dan backend route handler, React untuk komponen interaktif, TypeScript untuk menjaga konsistensi tipe data, Tailwind CSS untuk styling, Recharts untuk visualisasi, serta Supabase/PostgreSQL untuk penyimpanan data. Pada sisi data, project_key menjadi penghubung utama antar tabel dan antar modul."),
        table([
            ["Komponen", "Peran dalam Sistem", "Data Utama"],
            ["Document Control", "Master proyek, jadwal, progress, dokumentasi lapangan, TOP", "project_details, project_schedule_items, project_weekly_logs, termin_schedule"],
            ["Cost Control", "Budget, realisasi biaya, margin, escalation gate", "project_costs, project_escalations, op_* budget"],
            ["Finance", "Lifecycle invoice termin berbasis progress", "termin_invoices, termin_schedule, physical_progress"],
            ["Bos View", "Ringkasan eksekutif lintas modul", "executive-summary hasil agregasi project_details dan project_costs"],
        ], [1900, 3600, 3860]),
        para("Integrasi utama terjadi melalui tabel project_details. Tabel ini menyimpan identitas proyek, data kontrak, progress fisik, PO, VO, termin schedule, PIC, dan target selesai. Tabel project_costs menyimpan biaya aktual per proyek. Tabel termin_invoices menyimpan status lifecycle invoice per termin. Tabel project_schedule_items dan project_weekly_logs menyimpan pelaksanaan pekerjaan dan dokumentasi progress."),
        heading("3.4 Implementasi Document Control Page", 2),
        para("Document Control Page merupakan pusat kendali proyek. Halaman ini diimplementasikan pada app/dashboard/doc-con/page.tsx. Pengguna dapat membuat proyek baru dengan data display name, customer name, site location, PIC, nomor PO, nilai PO manual, folder OneDrive, status proyek, target selesai, termin pembayaran, VO, fase pekerjaan, dan catatan. Data master proyek dikirim ke API /api/project-details/[key] untuk disimpan atau diperbarui di Supabase."),
        para("Fitur Create Project Canvas memungkinkan pengguna menambahkan fase pekerjaan sebelum proyek disimpan. Setiap fase memiliki minggu mulai, minggu selesai, deskripsi pekerjaan, dan bobot progress. Setelah proyek dibuat, fase disimpan ke endpoint /api/project-schedule/[key]. Dengan cara ini, progress proyek dapat dihitung dari bobot fase yang telah selesai, bukan hanya dari angka manual tanpa konteks."),
        para("Document Control juga menyediakan log mingguan per fase. Log berisi minggu, deskripsi, foto lapangan, pembuat log, snapshot progress, dan phase_id yang menghubungkan log ke fase tertentu. Foto diunggah melalui /api/upload-photo ke bucket Supabase Storage project-photos. Struktur ini membuat dokumentasi lapangan dapat ditelusuri berdasarkan fase pekerjaan."),
        para("Fitur termin schedule atau TOP menyimpan daftar termin dalam format JSON pada project_details. Setiap termin memiliki id, nama termin, target_progres, dan persen_tagihan. Jadwal termin ini menjadi kontrak operasional antara Document Control dan Finance. Ketika progress fisik memenuhi target termin, termin dapat dibuka sebagai SIAP_TAGIH."),
        para("Document Control juga memiliki pengamanan PO lock. Jika sudah terdapat termin invoice aktif untuk suatu proyek, nomor PO tidak dapat diubah sembarangan. Hal ini mencegah perubahan anchor kontrak setelah proses finance berjalan. Selain itu, perubahan pada jadwal, log, atau biaya akan memicu pembaruan updated_at proyek melalui trigger database sehingga Bos View dapat menampilkan aktivitas terbaru."),
        heading("3.5 Implementasi Cost Control Page", 2),
        para("Cost Control Page diimplementasikan pada app/dashboard/cost-control/page.tsx. Modul ini berfokus pada pengendalian budget, realisasi biaya, dan margin proyek. Data ringkasan proyek diperoleh dari /api/executive-summary, sedangkan detail biaya per proyek diperoleh dari /api/project-costs?key=. Modul ini menggunakan mode focus agar pengguna dapat memilih satu proyek dan melihat rincian biaya secara lebih dalam."),
        para("Budget proyek dibagi ke dalam kategori gaji dan tunjangan, material atau bahan, transport dan logistik, biaya operasional, sewa dan utilitas, serta biaya lainnya. Sistem juga membedakan stream biaya main dan vo. Stream main digunakan untuk biaya PO utama, sedangkan stream vo digunakan untuk biaya kerja tambah atau variation order. Dengan pemisahan ini, perusahaan dapat melihat apakah biaya tambahan masih berada di dalam budget VO yang disetujui."),
        para("Cost Control menyediakan Budget Plafon Section untuk memasukkan plafon biaya per kategori, baik untuk PO utama maupun VO. Realisasi biaya dicatat melalui form tambah biaya yang menyimpan category, description, amount, cost_date, input_by, dan cost_stream ke tabel project_costs. Pengguna juga dapat mengedit dan menghapus biaya melalui API /api/project-costs/[id]."),
        para("Modul ini menghitung contractVal dari nilai PO utama ditambah total VO. Actual costs dihitung dari total project_costs. Net profit diperoleh dari contractVal dikurangi actual costs, sedangkan net margin dihitung sebagai persentase net profit terhadap contractVal. Status margin dibagi menjadi AMAN, WASPADA, KRITIS, dan RUGI. Pembagian ini membantu pengguna melihat risiko proyek secara cepat."),
        para("Salah satu fitur penting adalah VO Escalation Gate. Ketika biaya VO baru ditambahkan, API /api/project-costs menghitung total biaya VO dan membandingkannya dengan op_budget_vo. Jika total VO mencapai 80% budget, sistem membuat escalation dengan tipe vo_budget_80pct. Jika total VO mencapai atau melewati 100%, sistem membuat escalation dengan tipe vo_budget_exceeded. Escalation dapat diakui melalui /api/project-escalations/[key]."),
        heading("3.6 Implementasi Finance Page", 2),
        para("Finance Page diimplementasikan pada app/dashboard/finance/page.tsx. Modul ini mengelola milestone pembayaran kontrak berdasarkan termin schedule dan progress fisik. Finance tidak membuat termin dari nol, melainkan membaca termin schedule yang disiapkan di Document Control. Dengan demikian, finance bekerja berdasarkan struktur TOP yang sudah disetujui pada level proyek."),
        para("Status termin invoice terdiri dari TERKUNCI, SIAP_TAGIH, PROSES_COLLECT, dan LUNAS. TERKUNCI berarti progress fisik belum mencapai target termin. SIAP_TAGIH berarti progress sudah memenuhi syarat dan invoice dapat disiapkan. PROSES_COLLECT berarti invoice termin sudah dikirim atau sedang ditagih. LUNAS berarti pembayaran termin sudah selesai."),
        para("Mekanisme SOW Bridge menjadi jembatan antara progress pekerjaan dan penagihan. Pada Finance Page terdapat proses auto-unlock yang memeriksa apakah physical_progress lebih besar atau sama dengan target_progres pada termin. Jika iya dan termin belum memiliki record aktif, sistem melakukan upsert ke /api/termin-invoices dengan status SIAP_TAGIH. Upsert menggunakan constraint unik project_key dan termin_id sehingga proses bersifat idempotent."),
        para("Ketika termin berada pada status SIAP_TAGIH, pengguna finance dapat mengisi jumlah tagihan, tanggal invoice, dan catatan. Nilai tagihan dapat dihitung dari persen_tagihan dikalikan nilai kontrak. Setelah invoice dikirim, status berubah menjadi PROSES_COLLECT. Setelah pembayaran selesai, finance dapat menandai termin sebagai LUNAS melalui endpoint /api/termin-invoices/[id]."),
        para("Finance Page juga menyediakan billing queue untuk menampilkan termin yang menunggu proses. Queue ini membantu finance memprioritaskan tindakan karena hanya menampilkan termin yang eligible dan belum berada pada status PROSES_COLLECT atau LUNAS. Dengan demikian, modul finance tidak lagi menunggu rekap manual dari lapangan."),
        heading("3.7 Implementasi Bos View Module", 2),
        para("Bos View Module diimplementasikan pada app/projects/executive-view/page.tsx. Modul ini dirancang untuk pimpinan yang membutuhkan ringkasan cepat tanpa harus membuka setiap halaman operasional. Data diambil dari /api/executive-summary, yaitu endpoint agregasi yang membaca project_details, project_costs, project_weekly_logs, dan project_schedule_items."),
        para("Endpoint executive-summary menghitung contractVal dari po_value_manual ditambah total VO. TotalCosts dihitung dari project_costs. NetProfit dan netMargin dihitung untuk menilai kesehatan finansial proyek. FinanceStatus ditentukan dari termin schedule dan progress; jika ada termin yang sudah terbuka, status menjadi READY, sedangkan jika belum memenuhi syarat maka LOCKED. Jika proyek tidak memiliki termin schedule, progress 100% digunakan sebagai fallback kesiapan finance."),
        para("Bos View menyajikan tiga pilar utama: progress fisik dari Document Control, profitability dari Cost Control, dan status tagihan dari Finance. Kartu proyek menampilkan status proyek, due date, nomor PO, nama proyek, klien, progress, net margin, net profit, status tagihan, termin yang terbuka, serta last updated. Tampilan ini membuat pimpinan dapat melihat proyek mana yang aman, perlu perhatian, atau mengalami risiko margin."),
        para("Modul ini juga memiliki filter status proyek, filter margin, pencarian, KPI agregat, dan auto-refresh setiap 30 detik. Refresh berkala penting karena data yang tampil merupakan hasil agregasi dari beberapa modul yang dapat berubah kapan saja. Dengan Bos View, dashboard menjadi alat monitoring eksekutif, bukan sekadar laporan invoice."),
        heading("3.8 Integrasi Database dan API", 2),
        para("Integrasi database menggunakan Supabase REST API. Route handler Next.js berperan sebagai layer backend yang menerima request dari frontend, melakukan validasi sederhana, menyusun payload, lalu mengirim request ke Supabase. File app/api/project-details/[key]/route.ts mengelola master proyek. File app/api/project-costs/route.ts dan app/api/project-costs/[id]/route.ts mengelola biaya aktual. File app/api/termin-invoices/route.ts dan app/api/termin-invoices/[id]/route.ts mengelola lifecycle invoice termin."),
        para("Migrasi database pada sql/migrations.sql menambahkan kolom onedrive_folder_url, created_manually, customer_name, project_status, po_number, op_budget_vo, budget VO per kategori, vo_entries, termin_schedule, progress_pct, end_week, phase_id, pic_name, dan due_date. Migrasi juga membuat tabel project_weekly_logs, project_schedule_items, project_escalations, dan termin_invoices."),
        para("Database memiliki fungsi delete_project_cascade untuk menghapus proyek beserta child table secara atomik. Fungsi ini penting karena data proyek tersebar pada beberapa tabel yang saling berhubungan secara logis. Selain itu, fungsi bump_project_updated_at dan trigger pada project_costs, project_weekly_logs, serta project_schedule_items menjaga updated_at di project_details agar mencerminkan aktivitas terbaru lintas modul."),
        table([
            ["Tabel / Data", "Fungsi", "Modul yang Menggunakan"],
            ["project_details", "Master proyek, kontrak, progress, VO, TOP", "Doc Con, Cost Control, Finance, Bos View"],
            ["project_schedule_items", "Fase pekerjaan dan bobot progress", "Doc Con, Bos View"],
            ["project_weekly_logs", "Log dan foto progress lapangan", "Doc Con, Bos View"],
            ["project_costs", "Biaya aktual PO utama dan VO", "Cost Control, Bos View"],
            ["project_escalations", "Peringatan risiko budget VO", "Cost Control"],
            ["termin_invoices", "Status invoice per termin", "Doc Con, Finance"],
        ], [2100, 3600, 3660]),
        heading("3.9 Pengujian Sistem", 2),
        para("Pengujian dilakukan dengan pendekatan fungsional terhadap alur utama sistem. Pengujian Document Control mencakup pembuatan proyek, pengisian data PO, penambahan VO, penambahan termin schedule, penambahan fase, perubahan status fase menjadi selesai, penambahan log, dan upload foto. Hasil yang diharapkan adalah data tersimpan pada tabel yang sesuai dan progress dapat dihitung dari bobot fase."),
        para("Pengujian Cost Control mencakup penyimpanan budget, penambahan biaya PO utama, penambahan biaya VO, pengeditan biaya, penghapusan biaya, perhitungan actual cost, perhitungan net profit, perhitungan net margin, dan pembuatan escalation ketika biaya VO mencapai threshold. Hasil yang diharapkan adalah angka ringkasan berubah secara reaktif dan escalation muncul tanpa input manual tambahan."),
        para("Pengujian Finance mencakup pembacaan termin schedule dari proyek, status TERKUNCI sebelum target progress tercapai, auto-unlock menjadi SIAP_TAGIH setelah progress memenuhi target, perubahan status menjadi PROSES_COLLECT setelah invoice dikirim, dan perubahan status menjadi LUNAS setelah pembayaran selesai. Pengujian Bos View mencakup agregasi data progress, biaya, margin, status tagihan, filter, search, dan auto-refresh."),
        heading("3.10 Hambatan dan Solusi", 2),
        para("Hambatan pertama adalah perubahan ruang lingkup dari dashboard invoice menjadi sistem project lifecycle. Solusinya adalah memisahkan modul berdasarkan peran bisnis, tetapi menyatukan data melalui project_key. Hambatan kedua adalah menjaga konsistensi antara progress lapangan dan status finance. Solusinya adalah membuat SOW Bridge yang membaca progress dan termin target secara otomatis."),
        para("Hambatan ketiga adalah mengelola VO yang dapat memiliki beberapa PO tambahan. Solusinya adalah menyimpan vo_entries sebagai JSONB dan tetap mempertahankan op_budget_vo sebagai agregat untuk kompatibilitas. Hambatan keempat adalah menjaga ringkasan eksekutif tetap aktual walaupun data berubah di child table. Solusinya adalah menambahkan trigger bump_project_updated_at agar perubahan biaya, log, dan schedule memperbarui timestamp proyek."),

        heading("BAB IV PENILAIAN MAGANG", 1, True),
        heading("4.1 Keterampilan dan Kualifikasi yang Didapatkan", 2),
        para("Selama magang, penulis memperoleh pengalaman dalam menerjemahkan kebutuhan operasional menjadi desain sistem informasi. Penulis belajar bahwa aplikasi internal tidak cukup hanya menampilkan data; aplikasi harus mencerminkan alur kerja nyata dan membantu pengambilan keputusan. Keterampilan yang berkembang mencakup analisis proses bisnis, desain data, pemrograman frontend, pembuatan API, integrasi database, dan dokumentasi teknis."),
        para("Penulis juga memperoleh pemahaman mengenai pentingnya integrasi lintas fungsi. Data progress yang dibuat oleh Document Control memiliki dampak langsung pada Finance. Data biaya dari Cost Control memengaruhi pembacaan margin di Bos View. Hubungan seperti ini menuntut desain data yang konsisten, validasi payload yang jelas, dan UI yang mudah digunakan oleh masing-masing peran."),
        heading("4.2 Teknologi yang Digunakan", 2),
        para("Teknologi utama yang digunakan adalah Next.js untuk struktur aplikasi dan route handler, React untuk komponen interaktif, TypeScript untuk pengetikan statis, Tailwind CSS untuk styling, Radix UI dan komponen shadcn-style untuk elemen antarmuka, lucide-react untuk ikon, Recharts untuk visualisasi, serta Supabase/PostgreSQL untuk database dan storage."),
        para("Pada sisi backend, route handler Next.js berfungsi sebagai API internal. Pada sisi database, Supabase menyediakan tabel, indexing, REST endpoint, storage bucket, dan fungsi SQL. Sistem juga menggunakan JSONB untuk data yang bersifat fleksibel seperti termin_schedule dan vo_entries, sedangkan data transaksional seperti project_costs dan termin_invoices disimpan pada tabel terpisah agar dapat dihitung dan diaudit."),
        heading("4.3 Pengaruh Magang untuk Karier Masa Depan", 2),
        para("Pengalaman magang ini memberikan gambaran nyata mengenai pekerjaan sebagai pengembang sistem informasi. Penulis tidak hanya membuat tampilan, tetapi juga memikirkan workflow, integrasi data, konsekuensi perubahan status, dan kebutuhan stakeholder. Pengalaman ini relevan untuk karier di bidang software engineering, business analyst, systems analyst, product engineering, dan data-driven operations."),
        heading("4.4 Hubungan Kegiatan Magang dengan Mata Kuliah", 2),
        para("Kegiatan magang berhubungan erat dengan mata kuliah Analisis dan Perancangan Sistem Informasi, Basis Data, Pemrograman Web, Manajemen Proyek Sistem Informasi, Interaksi Manusia dan Komputer, serta Rekayasa Perangkat Lunak. Konsep entity relationship, API, UI/UX, validasi proses bisnis, dan pengujian sistem digunakan secara langsung dalam pengembangan dashboard."),

        heading("BAB V PENUTUP", 1, True),
        heading("5.1 Kesimpulan", 2),
        para("Sistem yang dikembangkan selama magang telah berkembang dari dashboard monitoring invoice menjadi dashboard project lifecycle terintegrasi. Document Control menjadi sumber data proyek dan progress, Cost Control mengendalikan biaya dan margin, Finance mengelola penagihan termin berbasis progress, dan Bos View menyajikan ringkasan eksekutif lintas modul."),
        para("Integrasi antar modul membuat sistem mampu menjawab kebutuhan operasional yang lebih luas daripada draft awal. Progress fisik tidak lagi berdiri sendiri, karena dapat membuka termin tagihan. Biaya aktual tidak hanya dicatat, tetapi dihitung terhadap nilai kontrak dan budget. Ringkasan eksekutif tidak hanya menampilkan data invoice, tetapi juga kesehatan proyek secara menyeluruh."),
        para("Dengan menggunakan Next.js, React, TypeScript, Tailwind CSS, Recharts, dan Supabase, sistem mampu menyediakan antarmuka interaktif dan backend terstruktur. Pengembangan ini menunjukkan bahwa sistem informasi internal dapat meningkatkan koordinasi antarbagian apabila data, workflow, dan tampilan dirancang sebagai satu kesatuan."),
        heading("5.2 Saran", 2),
        para("Pengembangan berikutnya dapat difokuskan pada autentikasi berbasis role yang lebih detail, approval workflow untuk perubahan PO dan VO, integrasi dokumen invoice final, notifikasi otomatis untuk termin SIAP_TAGIH, laporan PDF per proyek, serta audit trail yang lebih lengkap untuk setiap perubahan data operasional. Selain itu, sistem dapat dikembangkan dengan dashboard mobile agar pengguna lapangan lebih mudah mengisi log dan mengunggah foto."),
        para("Saran lain adalah menambahkan validasi bisnis yang lebih ketat pada termin schedule, misalnya memastikan total persen tagihan sama dengan 100% dan mencegah perubahan termin yang sudah diproses finance. Pengujian otomatis juga dapat ditambahkan untuk route API penting agar perubahan fitur tidak merusak alur integrasi antar modul."),

        heading("DAFTAR PUSTAKA", 1, True),
        para("Next.js. (2026). Next.js Documentation. Diakses dari https://nextjs.org/docs"),
        para("React. (2026). React Documentation. Diakses dari https://react.dev"),
        para("TypeScript. (2026). TypeScript Documentation. Diakses dari https://www.typescriptlang.org/docs/"),
        para("Supabase. (2026). Supabase Documentation. Diakses dari https://supabase.com/docs"),
        para("PostgreSQL Global Development Group. (2026). PostgreSQL Documentation. Diakses dari https://www.postgresql.org/docs/"),
        para("Tailwind CSS. (2026). Tailwind CSS Documentation. Diakses dari https://tailwindcss.com/docs"),
        para("Radix UI. (2026). Radix UI Documentation. Diakses dari https://www.radix-ui.com/primitives/docs/overview/introduction"),
        para("Recharts. (2026). Recharts Documentation. Diakses dari https://recharts.org/en-US/"),
        para("Lucide. (2026). Lucide Icons Documentation. Diakses dari https://lucide.dev"),
        para("PT Tri Bangun Usaha Persada. (2026). Dokumen dan kebutuhan internal perusahaan selama kegiatan magang."),
    ]
    return parts


def write_docx() -> None:
    if BUILD.exists():
        shutil.rmtree(BUILD)
    (BUILD / "_rels").mkdir(parents=True)
    (BUILD / "word" / "_rels").mkdir(parents=True)

    if TEMPLATE.exists():
        with zipfile.ZipFile(TEMPLATE) as zin:
            zin.extractall(BUILD)

        doc_path = BUILD / "word" / "document.xml"
        original_xml = doc_path.read_text(encoding="utf-8")
        body_match = re.search(r"(<w:document[^>]*>\s*<w:body>)([\s\S]*)(</w:body>\s*</w:document>)", original_xml)
        if not body_match:
            raise RuntimeError("Template document.xml tidak memiliki struktur w:body yang dapat diganti.")

        original_body = body_match.group(2)
        sect_matches = re.findall(r"(<w:sectPr\b[\s\S]*?</w:sectPr>)", original_body)
        sect = sect_matches[-1] if sect_matches else '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>'
        doc_path.write_text(body_match.group(1) + "".join(body_parts()) + sect + body_match.group(3), encoding="utf-8")

        if OUT.exists():
            OUT.unlink()
        old_cwd = os.getcwd()
        os.chdir(BUILD)
        try:
            subprocess.run(["zip", "-qr", str(OUT), "."], check=True)
        finally:
            os.chdir(old_cwd)
        shutil.rmtree(BUILD)
        return

    (BUILD / "[Content_Types].xml").write_text(
        """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>""",
        encoding="utf-8",
    )
    (BUILD / "_rels" / ".rels").write_text(
        """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>""",
        encoding="utf-8",
    )
    (BUILD / "word" / "_rels" / "document.xml.rels").write_text(
        """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>""",
        encoding="utf-8",
    )

    styles = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="160"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="220"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="320" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="2E74B5"/><w:sz w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="2E74B5"/><w:sz w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="80" w:line="280" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="DADCE0"/><w:left w:val="single" w:sz="4" w:color="DADCE0"/><w:bottom w:val="single" w:sz="4" w:color="DADCE0"/><w:right w:val="single" w:sz="4" w:color="DADCE0"/><w:insideH w:val="single" w:sz="4" w:color="DADCE0"/><w:insideV w:val="single" w:sz="4" w:color="DADCE0"/></w:tblBorders></w:tblPr></w:style>
</w:styles>"""
    (BUILD / "word" / "styles.xml").write_text(styles, encoding="utf-8")

    numbering = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
<w:abstractNum w:abstractNumId="2"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
<w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>
</w:numbering>"""
    (BUILD / "word" / "numbering.xml").write_text(numbering, encoding="utf-8")

    sect = '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>'
    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:body>"
        + "".join(body_parts())
        + sect
        + "</w:body></w:document>"
    )
    (BUILD / "word" / "document.xml").write_text(document, encoding="utf-8")

    if OUT.exists():
        OUT.unlink()
    old_cwd = os.getcwd()
    os.chdir(BUILD)
    try:
        subprocess.run(["zip", "-qr", str(OUT), "."], check=True)
    finally:
        os.chdir(old_cwd)
    shutil.rmtree(BUILD)


if __name__ == "__main__":
    write_docx()
    print(OUT)
