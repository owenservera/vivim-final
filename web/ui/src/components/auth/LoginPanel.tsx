/**
 * LoginPanel.tsx — Authentication / account management UI.
 * Shows login form when unauthenticated, account info when authenticated.
 */
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { login, logout, getSession, setSessionToken } from "@/sdk/backend-client"
import { LogOut, User, Shield } from "lucide-react"

export function LoginPanel() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [session, setSession] = useState<{ authenticated: boolean; userId: string | null; email: string | null } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSession().then((res) => {
      if (res.ok && res.data) setSession(res.data)
    })
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await login(email, password)
    setLoading(false)

    if (res.ok && res.data) {
      setSessionToken(res.data.token)
      setSession({ authenticated: true, userId: res.data.userId, email: res.data.email })
      setPassword("")
    } else {
      setError(res.error || "Login failed")
    }
  }

  const handleLogout = async () => {
    await logout()
    setSessionToken(null)
    setSession(null)
    setEmail("")
  }

  if (session?.authenticated) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{session.email}</p>
              <p className="text-xs text-muted-foreground">{session.userId}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Shield className="h-3 w-3" />
                Authenticated
              </Badge>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-sm">Sign In</CardTitle>
        <CardDescription>Connect to vivim-final backend</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
