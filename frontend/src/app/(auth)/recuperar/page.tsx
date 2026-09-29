"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthPage } from "@/components/auth/AuthPage";
import { Button } from "@/components/ui/Button";
import { FieldShell, Input } from "@/components/ui/Field";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RecoverPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  return (
    <AuthPage label="Recuperar" title="Recupera tu contraseña" subtitle="Te enviaremos un enlace para crear una contraseña nueva.">
      {sent ? (
        <div role="status" className="grid gap-4">
          <p className="rounded-2xl bg-menta px-4 py-3 text-[14.5px] text-tinta-oscura">
            Si existe una cuenta con <strong>{email}</strong>, en unos minutos recibirás el enlace. Revisa también la carpeta de spam.
          </p>
          <Link href="/login" className="text-[14px] text-tinta-oscura underline decoration-tinta/40 underline-offset-4 hover:decoration-tinta">
            Volver a entrar
          </Link>
        </div>
      ) : (
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!EMAIL_RE.test(email.trim())) {
              setError("Escribe un correo válido, por ejemplo tu@correo.com.");
              return;
            }
            setSent(true);
          }}
        >
          <FieldShell label="Correo" error={error ?? undefined}>
            {(id, describedBy) => (
              <Input
                id={id}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy}
              />
            )}
          </FieldShell>
          <Button variant="primario" size="lg" type="submit" className="w-full">
            Enviar enlace
          </Button>
          <Link href="/login" className="text-[14px] text-tinta-oscura underline decoration-tinta/40 underline-offset-4 hover:decoration-tinta">
            Volver a entrar
          </Link>
        </form>
      )}
    </AuthPage>
  );
}
