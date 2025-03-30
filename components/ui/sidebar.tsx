"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const SidebarContext = React.createContext<{
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  side: "left" | "right"
  size: "sm" | "md" | "lg" | "xl" | "full"
  toggleSidebar: () => void
}>({
  open: false,
  setOpen: () => {},
  side: "right",
  size: "md",
  toggleSidebar: () => {},
})

interface SidebarProviderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function SidebarProvider({ children, className, ...props }: SidebarProviderProps) {
  const [open, setOpen] = React.useState(false)
  const [side, setSide] = React.useState<"left" | "right">("right")
  const [size, setSize] = React.useState<"sm" | "md" | "lg" | "xl" | "full">("md")

  const toggleSidebar = React.useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  return (
    <SidebarContext.Provider value={{ open, setOpen, side, size, toggleSidebar }}>
      <div className={cn("relative", className)} {...props}>
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

const sidebarVariants = cva("bg-background transition-all duration-300 ease-in-out border-l border-r shadow-lg", {
  variants: {
    side: {
      left: "border-r border-l-0",
      right: "border-l border-r-0",
    },
    size: {
      sm: "w-[300px]",
      md: "w-[380px]",
      lg: "w-[480px]",
      xl: "w-[580px]",
      full: "w-full",
    },
  },
  defaultVariants: {
    side: "right",
    size: "md",
  },
})

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof sidebarVariants> {
  children: React.ReactNode
  floating?: boolean
}

export function Sidebar({
  children,
  className,
  side = "right",
  size = "md",
  floating = false,
  ...props
}: SidebarProps) {
  const context = React.useContext(SidebarContext)

  // Update context values when props change
  React.useEffect(() => {
    if (context.side !== side || context.size !== size) {
      context.setOpen(context.open) //Added this line to trigger a rerender
      Object.assign(context, { side, size })
    }
  }, [side, size, context])

  return (
    <div
      className={cn(
        sidebarVariants({ side, size }),
        context.open ? "flex" : "hidden",
        floating && context.open ? "fixed top-[80px] z-50 max-h-[calc(100vh-80px)] overflow-auto" : "h-full",
        side === "right" && floating ? "right-0" : "",
        side === "left" && floating ? "left-0" : "",
        className,
      )}
      {...props}
    >
      <Button variant="ghost" size="icon" className="absolute right-4 top-4" onClick={() => context.setOpen(false)}>
        <ChevronRight className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </Button>
      {children}
    </div>
  )
}

interface SidebarHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function SidebarHeader({ children, className, ...props }: SidebarHeaderProps) {
  return (
    <div className={cn("px-6 py-4", className)} {...props}>
      {children}
    </div>
  )
}

interface SidebarContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function SidebarContent({ children, className, ...props }: SidebarContentProps) {
  return (
    <div className={cn("overflow-auto", className)} {...props}>
      {children}
    </div>
  )
}

interface SidebarTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

export function SidebarTrigger({ children, className, ...props }: SidebarTriggerProps) {
  const { toggleSidebar } = React.useContext(SidebarContext)

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className={cn("inline-flex items-center justify-center", className)}
      {...props}
    >
      {children}
    </button>
  )
}

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

