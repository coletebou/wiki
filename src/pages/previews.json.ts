// The hover previews' data: title, summary, folio, table and section headings of every page.
import { previews } from '../lib/wiki';

export async function GET() {
  return new Response(JSON.stringify(await previews()), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
