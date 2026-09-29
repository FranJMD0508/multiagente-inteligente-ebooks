"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthPage, Divider, GoogleButton } from "@/components/auth/AuthPage";
import { Button } from "@/components/ui/Button";
import { FieldShell, Input } from "@/components/ui/Field";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const { register, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <AuthPage label="Crear cuenta" title="Crea tu cuenta en Folio" subtitle="Tus ebooks quedan guardados en tu biblioteca.">
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
          const result = register(name, email, password);
          if (result.ok) router.replace("/");
          else setError(result.error);
        }}
      >
        <FieldShell label="Nombre">
          {(id) => <Input id={id} autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} />}
        </FieldShell>
        <FieldShell label="Correo">
          {(id) => (
            <Input id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
          )}
        </FieldShell>
        <FieldShell label="Contraseña" hint="Al menos 6 caracteres." error={error ?? undefined}>
          {(id, describedBy) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy}
            />
          )}
        </FieldShell>
        <Button variant="primario" size="lg" type="submit" className="mt-1 w-full">
          Crear cuenta
        </Button>
      </form>
      <p className="mt-5 text-[14px] text-grafito">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-tinta-oscura underline decoration-tinta/40 underline-offset-4 hover:decoration-tinta">
          Entra aquí
        </Link>
      </p>
    </AuthPage>
  );
}
