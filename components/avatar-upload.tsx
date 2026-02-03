"use client"

import { useRef, useState } from "react"
import { Camera, Loader2, User } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface AvatarUploadProps {
  currentUrl?: string
  onUpload: (url: string) => void
  size?: number
}

export function AvatarUpload({ currentUrl, onUpload, size = 80 }: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Client-side validation
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Only JPG, PNG, GIF, and WebP are allowed.")
      return
    }

    const maxSize = 2 * 1024 * 1024 // 2MB
    if (file.size > maxSize) {
      toast.error("File too large. Maximum size is 2MB.")
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload/avatar", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Upload failed")
      }

      onUpload(data.url)
      toast.success("Avatar updated successfully!")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload avatar"
      toast.error(message)
    } finally {
      setIsUploading(false)
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  return (
    <div
      className="relative group cursor-pointer"
      style={{ width: size, height: size }}
      onClick={handleClick}
    >
      <Avatar className="h-full w-full">
        <AvatarImage src={currentUrl} alt="User avatar" />
        <AvatarFallback>
          <User className="h-1/2 w-1/2 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>

      {/* Hover overlay */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center rounded-full transition-opacity",
          "bg-black/50",
          isUploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
      >
        {isUploading ? (
          <Loader2 className="h-1/3 w-1/3 animate-spin text-white" />
        ) : (
          <Camera className="h-1/3 w-1/3 text-white" />
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
