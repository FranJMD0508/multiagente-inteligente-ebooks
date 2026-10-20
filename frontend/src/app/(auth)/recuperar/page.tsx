"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthPage } from "@/components/auth/AuthPage";
import { Button } from "@/components/ui/Button";
import { FieldShell, Input } from "@/components/ui/Field";
import { API_MODE } from "@/lib/api/mode";
import { useAuth } from "@/lib/auth";

const backLink = "text-[14px] text-tinta-oscura underline decoration-tinta/40 underline-offset-4 hover:decoration-tinta";

/** Paso 2 (con backend): el enlace trae un token y aquí se crea la contraseña nueva. */
function ResetForm({ token }: { token: string }) {
  const { resetPassword } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  return (
    <AuthPage label="Recuperar" title="Crea una contraseña nueva" subtitle="Elige una que no uses en otros sitios.">
      <form
        noValidate
        className="grid gap-4"
        aria-busy={sending}
        onSubmit={async (e) => {
          e.preventDefault();
          setSending(true);
          const result = await resetPassword(token, password);
          setSending(false);
          if (result.ok) router.replace("/");
          else setError(result.error);
        }}
      >
        <FieldShell label="Contraseña nueva" hint="Al menos 6 caracteres." error={error ?? undefined}>
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
        <Button variant="primario" size="lg" type="submit" className="w-full" disabled={sending}>
          Guardar y entrar
        </Button>
        <Link href="/login" className={backLink}>
          Volver a entrar
        </Link>
      </form>
    </AuthPage>
  );
}

function RequestForm() {
  const { recover } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  return (
    <AuthPage label="Recuperar" title="Recupera tu contraseña" subtitle="Te enviaremos un enlace para crear una contraseña nueva.">
      {sent ? (
        <div role="status" className="grid gap-4">
          <p className="rounded-2xl bg-menta px-4 py-3 text-[14.5px] text-tinta-oscura">
            {API_MODE === "http" ? (
              <>
                Si existe una cuenta con <strong>{email}</strong>, ya generamos el enlace. En una instalación local, Folio no envía
                correos: el enlace aparece en la consola del servidor.
              </>
            ) : (
              <>
                Si existe una cuenta con <strong>{email}</strong>, en unos minutos recibirás el enlace. Revisa también la carpeta de
                spam.
              </>
            )}
          </p>
          <Link href="/login" className={backLink}>
            Volver a entrar
          </Link>
        </div>
      ) : (
        <form
          noValidate
          className="grid gap-4"
          aria-busy={sending}
          onSubmit={async (e) => {
            e.preventDefault();
            setSending(true);
            const result = await recover(email);
            setSending(false);
            if (result.ok) setSent(true);
            else setError(result.error);
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
          <Button variant="primario" size="lg" type="submit" className="w-full" disabled={sending}>
            Enviar enlace
          </Button>
          <Link href="/login" className={backLink}>
            Volver a entrar
          </Link>
        </form>
      )}
    </AuthPage>
  );
}

function Recover() {
  const token = useSearchParams().get("token");
  return token && API_MODE === "http" ? <ResetForm token={token} /> : <RequestForm />;
}

export default function RecoverPage() {
  return (
    <Suspense fallback={null}>
      <Recover />
    </Suspense>
  );
}
