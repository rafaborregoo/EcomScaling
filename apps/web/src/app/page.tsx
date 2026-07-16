import Link from "next/link";

const modules = [
  { name: "Dashboard", status: "Pendiente de Shopify", phase: "F5" },
  { name: "Tareas", status: "Nucleo operativo", phase: "F7" },
  { name: "Mi Camino", status: "Plan estrategico", phase: "F9" },
  { name: "Mis Llamadas", status: "Revision consultor", phase: "F8" },
  { name: "Planificacion", status: "Stock y campanas", phase: "F12" },
  { name: "Consultor IA", status: "RAG y SQL Gateway", phase: "F13" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6">
        <header className="flex items-center justify-between border-b border-[#d8d8d8] pb-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#dc1f26]">
              EcomScaling IA
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Centro operativo</h1>
          </div>
          <div className="rounded-md border border-black bg-black px-3 py-2 font-mono text-xs text-white">
            Fase 1
          </div>
        </header>

        <section className="grid flex-1 gap-6 py-8 lg:grid-cols-[280px_1fr]">
          <aside className="border-r border-[#d8d8d8] pr-6">
            <nav className="space-y-2">
              {modules.map((module) => (
                <div
                  key={module.name}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-[#f1f1f1]"
                >
                  <span>{module.name}</span>
                  <span className="font-mono text-xs text-[#dc1f26]">{module.phase}</span>
                </div>
              ))}
            </nav>
          </aside>

          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Shell inicial del producto</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5f5f5f]">
                Esta pantalla marca el punto de partida tecnico: Next.js esta listo y
                los modulos quedan visibles como estados reales pendientes de datos,
                no como metricas ficticias.
              </p>
              <div className="mt-4 flex gap-3">
                <Link
                  className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-[#dc1f26]"
                  href="/login"
                >
                  Entrar
                </Link>
                <Link
                  className="rounded-md border border-black bg-white px-4 py-2 text-sm font-medium hover:border-[#dc1f26] hover:text-[#dc1f26]"
                  href="/dashboard"
                >
                  Ver bootstrap
                </Link>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {modules.map((module) => (
                <article
                  key={module.name}
                  className="rounded-md border border-[#d8d8d8] bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-medium">{module.name}</h3>
                    <span className="rounded-sm bg-[#f8e7e8] px-2 py-1 font-mono text-xs text-[#dc1f26]">
                      {module.phase}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-[#5f5f5f]">{module.status}</p>
                </article>
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
