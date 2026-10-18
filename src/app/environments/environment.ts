/**
 * Claves de conexión con Supabase.
 *
 * DE DÓNDE SALEN
 *   Supabase → tu proyecto → engranaje (Settings) → API
 *     - `supabaseUrl`     → el valor de "Project URL"
 *     - `supabaseAnonKey` → el valor que dice "anon" / "public"
 *
 * ¿NO ES PELIGROSO TENER ESTA CLAVE ACÁ, A LA VISTA?
 * No, y conviene entender por qué, porque es contraintuitivo.
 * La `anon key` está DISEÑADA para viajar en el frontend. Cualquiera que abra
 * el sitio la puede leer, y eso no es una fuga: es su función. Lo que protege
 * los datos son las políticas RLS de la base (las que verificamos en
 * `supabase/verificar-rls.sql`). Sin RLS, esta clave sería la llave del reino;
 * con RLS, sólo abre la puerta de lo que el rol `anon` tiene permitido ver.
 *
 * LO QUE NUNCA VA ACÁ
 * La clave `service_role`. Esa salta RLS por completo y es la llave maestra del
 * proyecto: leer, escribir y borrar todo. Vive sólo en servidores. Jamás en un
 * frontend, jamás en un repositorio.
 */
export const environment = {
  supabaseUrl: "https://schapjuchyiguodlalzv.supabase.co",
  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjaGFwanVjaHlpZ3VvZGxhbHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMzYyMjgsImV4cCI6MjEwNzkxMjIyOH0.XtOmgCG6mbWFGNATLavZZ3lY3ecQjGbcFUHd1-MEO8o",
};
