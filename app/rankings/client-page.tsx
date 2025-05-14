"use client"

import { useState } from "react"
import { TraderTable } from "./components/trader-table"
import type { TraderStats } from "@/lib/trader-data"

interface ClientPageProps {
  initialTraders: TraderStats[]
}

export default function ClientPage({ initialTraders }: ClientPageProps) {
  const [traders] = useState<TraderStats[]>(initialTraders)

  return (
    <>
      <TraderTable traders={traders} />
    </>
  )
}

