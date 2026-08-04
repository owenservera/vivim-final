"use client"

import * as React from "react"

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { CheckCircle, XCircle, AlertCircle } from "lucide-react"

interface ValidatedFieldProps extends React.ComponentProps<typeof Input> {
  name: string
  label: string
  helpText?: string
  form: any
}

function ValidatedField({
  name,
  label,
  helpText,
  className,
  form,
  ...props
}: ValidatedFieldProps) {
  const { error, id } = useFormField()

  return (
    <FormField
      control={form.control}
      name={name as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {name.toLowerCase().includes("password") ? " *" : ""}
          </FormLabel>
          <div style={{ position: "relative" }}>
            <FormControl>
              <Input
                {...field}
                className={cn(
                  "pr-10",
                  error && "border-destructive",
                  !error && field.value && "border-green-500",
                  className
                )}
                {...props}
              />
            </FormControl>
            <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }}>
              {field.value && !error && <CheckCircle size={16} className="text-green-500" />}
              {error && <XCircle size={16} className="text-destructive" />}
              {!field.value && !error && <AlertCircle size={16} className="text-muted-foreground" />}
            </div>
          </div>
          <FormDescription>{helpText}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export { ValidatedField }
