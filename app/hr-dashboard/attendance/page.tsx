import { HrAttendanceQueryProvider } from "./_lib/query-client"
import { AttendanceShell } from "./_components/attendance-shell"

export default function HrAttendancePage() {
  return (
    <div className="shell-bg-hr-admin min-h-screen">
      <HrAttendanceQueryProvider>
        <AttendanceShell />
      </HrAttendanceQueryProvider>
    </div>
  )
}
