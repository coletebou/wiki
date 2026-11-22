#!/usr/bin/env bash
# Seven of the studies' emblems (src/assets/emblems/), and the lost scroll's sketch: each drawn by an image model in the manner of Leonardo's pen,
# then traced into vector ink with scripts/trace-leonardo.mjs. The other three (rotae, vortex, porta) are his own
# sketches, traced from his notebooks; trace-leonardo.mjs lists their sheets. Not part of the build: the traced files
# are committed, and this is how they were made.
#
#   OPENAI_API_KEY=... bash scripts/gen-emblems.sh <workdir>      (needs curl, jq, potrace; sharp comes with Astro)
#
# The model was gpt-image-2 at 1024 x 1024, quality high, an opaque background; each prompt is the subject followed
# by the same manner. A second run makes new drawings, not these: look at them before committing.
set -euo pipefail
out="${1:?workdir}"
mkdir -p "$out"
here="$(cd "$(dirname "$0")" && pwd)"

MANNER="A small sketch in the margin of a page of Leonardo da Vinci's notebook, drawn with a quill in brown iron-gall ink: sure outlines, light hatching for shade, the hand of a Renaissance engineer. Plain pure white background, no paper texture, no stains, no writing, no frame, no colour, nothing else on the page. One object, centred, filling most of the square."

while IFS='|' read -r name thresh lo subject; do
  jq -n --arg p "$subject $MANNER" '{model:"gpt-image-2",prompt:$p,size:"1024x1024",background:"opaque",quality:"high"}' |
    curl -sS https://api.openai.com/v1/images/generations -H "Authorization: Bearer $OPENAI_API_KEY" \
      -H 'Content-Type: application/json' --data-binary @- |
    jq -r '.data[0].b64_json' | base64 -d > "$out/em-$name.png"
  node "$here/trace-leonardo.mjs" "$out/em-$name.png" "$out/$name.svg" --crop=0,0,1024,1024 --size=360 \
    --thresh="$thresh" --lo="$lo" --blur=10 --area=16 --long=8 --bold=1
done <<'EMBLEMS'
clepsydra|40|18|An hourglass in a wooden frame with turned posts, the sand half run down.
epistola|40|18|A folded letter sealed with a round wax seal, and a quill pen lying across it.
fax|40|18|A burning torch held upright: a bound wooden staff, a basket of pitch at the top, the flame streaming back as if carried running.
luna|20|9|The crescent moon, with the dark part of its disc faintly visible and lightly hatched, as Leonardo drew the ashen light of the moon.
nodus|40|18|An interlaced knot of a single cord, looping over and under itself in a circular pattern, like the knots Leonardo designed.
scutum|40|18|A Roman shield, oval, with a raised central boss, banded with metal and riveted.
via|40|18|A Roman road running straight into the distance between two edges, paved with stones, a milestone standing beside it.
EMBLEMS

# The lost scroll's sketch (src/assets/lost/scroll.svg, the 404 page), the same way, larger and with fainter ink kept
# so the smoke survives. The model drew the flying machine on the scroll unasked; it stayed.
jq -n --arg p "A papyrus scroll half unrolled, its far end burnt away to a ragged charred edge, a thin curl of smoke rising from it. ${MANNER/One object/One subject}" \
  '{model:"gpt-image-2",prompt:$p,size:"1024x1024",background:"opaque",quality:"high"}' |
  curl -sS https://api.openai.com/v1/images/generations -H "Authorization: Bearer $OPENAI_API_KEY" \
    -H 'Content-Type: application/json' --data-binary @- |
  jq -r '.data[0].b64_json' | base64 -d > "$out/lost.png"
node "$here/trace-leonardo.mjs" "$out/lost.png" "$out/scroll.svg" --crop=0,0,1024,1024 --size=520 \
  --thresh=20 --lo=8 --blur=12 --area=20 --long=10
