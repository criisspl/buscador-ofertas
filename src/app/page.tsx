import Link from "next/link";

export default function Home() {
  return (
    <div className="card space-y-3">
      <h1 className="text-2xl font-bold">Ofertas a tu medida</h1>
      <p className="text-muted">
        Sube tu CV, cuéntanos qué buscas y la IA ordena las ofertas por encaje. Todo se guarda solo
        en tu navegador: sin cuentas.
      </p>
      <div className="flex gap-3">
        <Link href="/ajustes" className="boton-sec">
          1. Elige tu IA
        </Link>
        <Link href="/perfil" className="boton">
          2. Sube tu CV
        </Link>
      </div>
    </div>
  );
}
