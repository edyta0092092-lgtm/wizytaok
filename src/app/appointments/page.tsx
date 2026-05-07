"use client"

import { Suspense } from "react"

import { AppointmentsPageInner } from "@/components/appointments/appointments-page-inner"

export default function AppointmentsPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh]" aria-hidden />}>
      <AppointmentsPageInner />
    </Suspense>
  )
}