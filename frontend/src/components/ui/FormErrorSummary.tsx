"use client"

import * as React from "react"
import { useFormContext } from "react-hook-form"
import { cn } from "@/lib/utils"
import { AlertCircle } from "lucide-react"

function FormErrorSummary() {
  const { formState } = useFormContext()
  const errors = formState.errors

  if (!errors || Object.keys(errors).length === 0) {
    return null
  }

  return (
    <div
      style={{
        padding: 12,
        background: "var(--bg-error, #fef2f2)",
        border: "1px solid var(--border-error, #fecaca)",
        borderRadius: 8,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <AlertCircle size={16} className="text-destructive" />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-error, #dc2626)" }}>
          Form Errors ({Object.keys(errors).length})
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {Object.entries(errors).map(([field, error]) => {
          const path = field.split(".")
          const label = path[path.length - 1].replace(/([A-Z])/g, " $1").trim()

          const getErrorMessage = (err: unknown): string => {
            if (typeof err === 'string') return err
            if (err && typeof err === 'object' && 'message' in err) return err.message as string
            return 'Invalid value'
          }

          const errorMessage = getErrorMessage(error)

          return (
            <div key={field} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ color: "var(--color-error, #dc2626)", fontSize: 11, fontWeight: 600 }}>
                •
              </span>
              <div style={{ fontSize: 12 }}>
                <span style={{ color: "var(--text-muted)" }}>{label}:</span> {errorMessage}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { FormErrorSummary }
