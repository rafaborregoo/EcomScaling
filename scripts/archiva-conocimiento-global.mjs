// Marca como `archived` los documentos de conocimiento GLOBAL que siguen
// activos. No borra nada: `knowledge_search` solo devuelve `status = 'active'`,
// asi que archivar los saca del retrieval y deja la traza.
//
// Se usa cuando cambia RAG_EMBEDDING_PROFILE (modelo, dimensiones o chunking):
// el corpus viejo se archiva y se vuelve a ingestar con el perfil nuevo, que
// es el coste que documenta ese perfil.
//
// Uso: npm run conocimiento:archiva
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data, error } = await supabase
  .from("knowledge_documents")
  .update({ status: "archived" })
  .eq("visibility", "global")
  .eq("status", "active")
  .select("id, title");

if (error) {
  console.error(`error: ${error.message}`);
  process.exit(1);
}

for (const doc of data ?? []) console.log(`archivado "${doc.title}" (${doc.id})`);
console.log(`${(data ?? []).length} documentos globales archivados`);
