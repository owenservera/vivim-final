"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface PasswordStrengthProps {
  value: string
  className?: string
}

function PasswordStrength({ value, className }: PasswordStrengthProps) {
  const getStrength = (password: string): { level: number; label: string; color: string } => {
    let score = 0

    if (password.length >= 8) score += 1
    if (password.length >= 12) score += 1
    if (/[A-Z]/.test(password)) score += 1
    if (/[a-z]/.test(password)) score += 1
    if (/[0-9]/.test(password)) score += 1
    if (/[^A-Za-z0-9]/.test(password)) score += 1

    if (score <= 2) return { level: 1, label: "Weak", color: "var(--color-warning, #fbbf24)" }
    if (score <= 4) return { level: 2, label: "Fair", color: "var(--color-warning, #fbbf24)" }
    if (score <= 5) return { level: 3, label: "Strong", color: "var(--color-success, #10b981)" }
    return { level: 4, label: "Very Strong", color: "var(--color-success, #10b981)" }
  }

  const strength = getStrength(value)
  const width = value ? (strength.level * 25) : 0

  return (
    <div className={cn("space-y-2", className)}>
      <div
        style={{
          height: 4,
          background: "var(--bg-muted)",
          borderRadius: 2,
          overflow: "hidden",
          transition: "all 0.3s ease",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${width}%`,
            background: strength.color,
            transition: "all 0.3s ease",
            borderRadius: 2,
          }}
        />
      </div>
      {value && (
        <div style={{ fontSize: 11, color: strength.color, fontWeight: 500 }}>
          Password strength: {strength.label}
        </div>
      )}
      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
        At least 8 chars, mix of letters, numbers, and symbols
      </div>
    </div>
  )
}

export { PasswordStrength }
