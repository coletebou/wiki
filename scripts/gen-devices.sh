#!/usr/bin/env bash
# The ten tables' devices (src/assets/devices/): each drawn by an image model, then traced into vector ink with
# scripts/trace-leonardo.mjs, the way Leonardo's own sketches were. Not part of the build: the traced files are
# committed, and this is how they were made. Leonardo drew none of them; the About folio says so.
#
#   OPENAI_API_KEY=... bash scripts/gen-devices.sh <workdir>      (needs curl, jq, potrace; sharp comes with Astro)
#
# The model was gpt-image-2 at 1024 x 1024, quality high, an opaque background. Each prompt is the table's subject
# followed by the same manner, below. Image models do not give the same picture twice, so a second run makes new
# drawings, not these: look at them before committing (at 28 and 80 pixels, the sizes they are shown at).
set -euo pipefail
out="${1:?workdir}"
mkdir -p "$out"
here="$(cd "$(dirname "$0")" && pwd)"

MANNER="Drawn by Leonardo da Vinci in his notebook with a quill in brown iron-gall ink: bold, sure outlines of even weight, only a little hatching, simple enough to read when printed very small, like a printer's device. Plain pure white background, no paper texture, no stains, no writing, no frame, no colour, nothing else on the page. One object, centred, filling most of the square."

while IFS='|' read -r table subject; do
  jq -n --arg p "$subject $MANNER" '{model:"gpt-image-2",prompt:$p,size:"1024x1024",background:"opaque",quality:"high"}' |
    curl -sS https://api.openai.com/v1/images/generations -H "Authorization: Bearer $OPENAI_API_KEY" \
      -H 'Content-Type: application/json' --data-binary @- |
    jq -r '.data[0].b64_json' | base64 -d > "$out/dev-$table.png"
  node "$here/trace-leonardo.mjs" "$out/dev-$table.png" "$out/$table.svg" --crop=0,0,1024,1024 --size=360 \
    --thresh=40 --lo=18 --blur=10 --area=16 --long=8
done <<'TABLES'
desk|A Renaissance counting frame (abacus): a square wooden frame with five rods of round beads, seen straight on.
shell|A scallop shell, seen from above, its ribs fanning from the hinge.
automata|Two toothed gear wheels in mesh, one large and one small, each on its axle, as in a clockwork.
workshop|A pair of brass dividers (compasses) standing open, points down, with a small hinge at the top.
works|A short stretch of a Roman aqueduct: three round arches on piers carrying a channel.
observatory|An armillary sphere on a stand: crossing rings round a small globe.
atelier|A single bird's wing, outstretched, the long flight feathers spread.
mint|A Roman coin seen face on: a laurelled head in profile inside a ring of dots.
ledger|A merchant's balance scale: a beam on a post with a pan hanging at each end.
library|An open book lying flat, its pages curving up from the spine.
TABLES
