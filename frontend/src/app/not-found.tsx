import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="hoja max-w-md px-8 py-10 text-center">
        <p className="font-display text-[14px] text-tenue">404</p>
        <h1 className="mt-2 font-display text-[26px] font-medium tracking-[-0.03em]">Esta página no existe</h1>
        <p className="mt-2 text-[15px] text-grafito">Revisa el enlace o vuelve al inicio para escribir tu próximo ebook.</p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center rounded-full bg-tinta px-5 text-[14.5px] font-medium text-sobre-tinta hover:bg-tinta-hover"
        >
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
