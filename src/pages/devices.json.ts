// Where each table's device is drawn, for the seeker to set beside each result. Fetched once, on the first search.
import { DEVICES } from '../data/devices';

export function GET() {
  const drawings = Object.fromEntries(Object.entries(DEVICES).map(([table, d]) => [table, d.small]));
  return new Response(JSON.stringify(drawings), { headers: { 'content-type': 'application/json; charset=utf-8' } });
}
