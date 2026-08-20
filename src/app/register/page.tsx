"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api, setToken } from "@/lib/client";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const data = await api<{ token: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          role: form.get("role"),
        }),
      });
      setToken(data.token);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  }

  return (
    <div className="card mx-auto max-w-md space-y-5 p-6">
      <h1 className="text-xl font-semibold">Register</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input name="name" required placeholder="Name" className="input w-full" />
        <input name="email" type="email" required placeholder="Email" className="input w-full" />
        <input name="password" type="password" required placeholder="Password" className="input w-full" />
        <select name="role" className="input w-full">
          <option value="CUSTOMER">Customer</option>
          <option value="ORGANISER">Organiser</option>
        </select>
        {error && <p className="text-sm text-white/80">{error}</p>}
        <button type="submit" className="btn btn-primary w-full">Create account</button>
      </form>
      <p className="text-sm muted">
        Have an account? <Link href="/login" className="text-white underline">Login</Link>
      </p>
    </div>
  );
}
