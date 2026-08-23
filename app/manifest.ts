import type { MetadataRoute } from "next"

// Next.js auto-serves this at /manifest.webmanifest and links it from
// every page's <head> — no manual <link rel="manifest"> needed.
// start_url points at /clock-in since this identity is for field techs
// installing the attendance PWA to their home screen, not the internal
// HR dashboard.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             "ABSEN Tribangun",
    short_name:       "ABSEN Tribangun",
    description:      "Aplikasi absensi karyawan lapangan PT Tri Bangun Usaha Persada",
    start_url:        "/clock-in",
    scope:            "/",
    display:          "standalone",
    background_color: "#ffffff",
    theme_color:      "#ffffff",
    icons: [
      { src: "/icon.png", sizes: "1024x1024", type: "image/png" },
    ],
  }
}
