"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { api, setToken } from "@/lib/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const data = await api<{ token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      setToken(data.token);
      router.push(searchParams.get("next") || "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="card mx-auto max-w-md space-y-5 p-6">
      <h1 className="text-xl font-semibold">Login</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input name="email" type="email" required placeholder="Email" className="input w-full" />
        <input name="password" type="password" required placeholder="Password" className="input w-full" />
        {error && <p className="text-sm text-white/80">{error}</p>}
        <button type="submit" className="btn btn-primary w-full">Login</button>
      </form>
      <p className="text-sm muted">
        No account? <Link href="/register" className="text-white underline">Register</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="muted text-sm">Loading...</p>}>
      <LoginForm />
    </Suspense>
  );
}
