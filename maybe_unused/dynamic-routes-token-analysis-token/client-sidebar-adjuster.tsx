"use client"

import { useEffect } from "react"
import { useSidebar } from "@/components/ui/sidebar"

export function SidebarContentAdjuster() {
  const { open, size } = useSidebar()

  useEffect(() => {
    const mainContent = document.getElementById("main-content")
    if (!mainContent) return

    if (open) {
      // Get sidebar width based on size
      let sidebarWidth = 300 // Default for "sm"
      if (size === "md") sidebarWidth = 380
      if (size === "lg") sidebarWidth = 480
      if (size === "xl") sidebarWidth = 580
      if (size === "full") sidebarWidth = window.innerWidth

      // Add padding to main content to prevent overlap - reduced from 16px to 8px
      mainContent.style.paddingRight = `${sidebarWidth + 8}px`
    } else {
      // Reset padding when sidebar is closed
      mainContent.style.paddingRight = ""
    }

    // Cleanup function
    return () => {
      mainContent.style.paddingRight = ""
    }
  }, [open, size])

  return null
}

