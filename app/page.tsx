import { redirect } from "next/navigation"

export default function Home() {
  // Langsung arahkan ke halaman dashboard yang sudah kita buat
  redirect("/login")
}