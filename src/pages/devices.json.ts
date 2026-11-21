// The tables' devices as drawings, for the seeker to set beside each result. Fetched once, on the first search.
import { DEVICES } from '../data/devices';
import { emblem } from '../diagrams/emblems';

export function GET() {
  const drawings = Object.fromEntries(
    Object.entries(DEVICES).map(([table, d]) => [table, emblem({ name: d.emblem, x: 0, y: 0, size: 100 }, `device-seek-${table}`)]),
  );
  return new Response(JSON.stringify(drawings), { headers: { 'content-type': 'application/json; charset=utf-8' } });
}
