"use client";

import { Switch } from "radix-ui";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { usePrefs } from "@/lib/prefs";
import type { ExercisePref } from "@/lib/types";

function Row({ title, hint, children, htmlFor }: { title: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-linea py-4 first:border-t-0">
      <div className="min-w-0">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-[15px] font-medium">
            {title}
          </label>
        ) : (
          <p className="text-[15px] font-medium">{title}</p>
        )}
        {hint && <p className="text-[13px] text-grafito">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Switch.Root
      id={id}
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      className="relative h-6 w-11 flex-none rounded-full bg-borde-control transition-colors data-[state=checked]:bg-tinta"
    >
      <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
    </Switch.Root>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="font-display text-[17px] font-medium tracking-[-0.02em]">{title}</h2>
      <div className="rounded-2xl bg-pagina px-5 shadow-[0_1px_3px_rgb(var(--sombra)/0.06)]">{children}</div>
    </section>
  );
}

const noop = () => () => {};

export default function SettingsPage() {
  const { user, rename, logout } = useAuth();
  const { prefs, setPrefs } = usePrefs();
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const router = useRouter();
  const [name, setName] = useState(user?.name ?? "");
  const [confirm, setConfirm] = useState<null | "vaciar" | "ejemplos" | "cuenta">(null);

  return (
    <div className="mx-auto grid w-full max-w-[680px] gap-8 px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="font-display text-[30px] font-medium leading-none tracking-[-0.035em] sm:text-[34px]">Ajustes</h1>

      <Section title="Perfil">
        <Row title="Nombre" hint="Así te saluda Folio." htmlFor="nombre">
          <Input id="nombre" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => rename(name)} className="w-full sm:w-60" />
        </Row>
        <Row title="Nombre de autor" hint="Aparece en tus portadas nuevas." htmlFor="autor">
          <Input
            id="autor"
            value={prefs.authorName}
            placeholder={user?.name}
            onChange={(e) => setPrefs({ authorName: e.target.value })}
            className="w-full sm:w-60"
          />
        </Row>
        <Row title="Correo">
          <span className="text-[14.5px] text-grafito">{user?.email}</span>
        </Row>
      </Section>

      <Section title="Preferencias">
        <Row title="Tema">
          {mounted && (
            <Segmented
              label="Tema"
              value={(theme as "light" | "dark" | "system") ?? "system"}
              onChange={setTheme}
              size="sm"
              options={[
                { value: "light", label: "Claro" },
                { value: "dark", label: "Oscuro" },
                { value: "system", label: "Sistema" },
              ]}
            />
          )}
        </Row>
        <Row title="Ejercicio preferido" hint="Se puede cambiar en cada libro.">
          <Segmented<ExercisePref>
            label="Ejercicio preferido"
            value={prefs.exercisePref}
            onChange={(v) => setPrefs({ exercisePref: v })}
            size="sm"
            options={[
              { value: "auto", label: "Que decida Folio" },
              { value: "checklist", label: "Checklist" },
              { value: "reto", label: "Reto 24-48 h" },
            ]}
          />
        </Row>
        <Row title="Reducir movimiento" hint="Quita desplazamientos y giros; solo quedan cambios suaves." htmlFor="movimiento">
          <Toggle id="movimiento" label="Reducir movimiento" checked={prefs.reduceMotion} onChange={(v) => setPrefs({ reduceMotion: v })} />
        </Row>
      </Section>

      <Section title="Demostración">
        <Row title="Velocidad de los agentes" hint="Mientras no hay backend, los agentes se simulan en tu navegador.">
          <Segmented
            label="Velocidad de los agentes"
            value={prefs.simSpeed}
            onChange={(v) => setPrefs({ simSpeed: v })}
            size="sm"
            options={[
              { value: "normal", label: "Normal" },
              { value: "rapida", label: "Rápida" },
            ]}
          />
        </Row>
        <Row title="Simular un error" hint="El capítulo 4 fallará una vez, para probar el reintento." htmlFor="error-demo">
          <Toggle id="error-demo" label="Simular un error" checked={prefs.simulateError} onChange={(v) => setPrefs({ simulateError: v })} />
        </Row>
        <Row title="Datos de ejemplo" hint="Vuelve a cargar la biblioteca de demostración o déjala vacía.">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setConfirm("ejemplos")}>
              Restaurar ejemplos
            </Button>
            <Button size="sm" onClick={() => setConfirm("vaciar")}>
              Vaciar biblioteca
            </Button>
          </div>
        </Row>
      </Section>

      <Section title="Cuenta">
        <Row title="Cerrar sesión">
          <Button
            size="sm"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
          >
            Cerrar sesión
          </Button>
        </Row>
        <Row title="Eliminar cuenta" hint="Borra tu cuenta y todos tus ebooks de este navegador.">
          <Button size="sm" variant="peligro" onClick={() => setConfirm("cuenta")}>
            Eliminar cuenta
          </Button>
        </Row>
      </Section>

      <ConfirmDialog
        open={confirm === "vaciar"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="¿Vaciar la biblioteca?"
        description="Se eliminarán todos tus ebooks de este navegador."
        confirmLabel="Vaciar"
        danger
        onConfirm={() => api.clearLibrary()}
      />
      <ConfirmDialog
        open={confirm === "ejemplos"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="¿Restaurar los ejemplos?"
        description="Tu biblioteca se reemplazará por los ebooks de demostración."
        confirmLabel="Restaurar"
        onConfirm={() => api.restoreExamples(prefs.authorName || user?.name || "")}
      />
      <ConfirmDialog
        open={confirm === "cuenta"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="¿Eliminar tu cuenta?"
        description="Se borrarán tu cuenta y todos tus ebooks de este navegador. Esta acción no se puede deshacer."
        confirmLabel="Eliminar cuenta"
        danger
        onConfirm={() => {
          api.clearLibrary();
          try {
            if (user) localStorage.removeItem(`folio:datos:${user.email}`);
          } catch {
            // Sin almacenamiento.
          }
          logout();
          router.replace("/registro");
        }}
      />
    </div>
  );
}
