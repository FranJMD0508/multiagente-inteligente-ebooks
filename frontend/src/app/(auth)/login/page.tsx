"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthPage, Divider, GoogleButton } from "@/components/auth/AuthPage";
import { Button } from "@/components/ui/Button";
import { FieldShell, Input } from "@/components/ui/Field";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <AuthPage label="Entrar" title="Tu próximo ebook empieza aquí" subtitle="Entra para retomar tus libros.">
      <GoogleButton
        onClick={() => {
          loginWithGoogle();
          router.replace("/");
        }}
      />
      <Divider>o con tu correo</Divider>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const result = login(email, password);
          if (result.ok) router.replace("/");
          else setError(result.error);
        }}
      >
        <FieldShell label="Correo">
          {(id, describedBy) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              aria-describedby={describedBy}
            />
          )}
        </FieldShell>
        <FieldShell label="Contraseña" error={error ?? undefined}>
          {(id, describedBy) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy}
            />
          )}
        </FieldShell>
        <Button variant="primario" size="lg" type="submit" className="mt-1 w-full">
          Entrar
        </Button>
      </form>
      <div className="mt-5 flex flex-wrap justify-between gap-2 text-[14px]">
        <Link href="/recuperar" className="text-tinta-oscura underline decoration-tinta/40 underline-offset-4 hover:decoration-tinta">
          ¿Olvidaste tu contraseña?
        </Link>
        <Link href="/registro" className="text-tinta-oscura underline decoration-tinta/40 underline-offset-4 hover:decoration-tinta">
          Crear cuenta
        </Link>
      </div>
    </AuthPage>
  );
}
