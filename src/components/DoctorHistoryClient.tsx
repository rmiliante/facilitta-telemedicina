"use client";

import AttendanceHistoryTab from "./AttendanceHistoryTab";

export default function DoctorHistoryClient({ doctorName }: { doctorName: string }) {
  return (
    <div className="mx-auto max-w-6xl">
      <AttendanceHistoryTab
        endpoint="/api/doctor/historico"
        lockedDoctorName={doctorName}
        rowHref={(item) => `/medico/consulta/${item.id}`}
      />
    </div>
  );
}
