#!/usr/bin/env bash
# Build the Machina "wow reel" (website + LinkedIn 1080p) from Playwright
# recordings (seg01..seg03) + title/caption cards (render-cards.mjs).
#
# NOTE: the mark() timestamps each seg script prints are measured from
# process start (before chromium.launch()), not from when recordVideo
# actually starts. Browser launch overhead varies per run, so translate
# marks to video-relative time via: offset = last_mark - actual_video_duration,
# then subtract that offset from every mark in that segment. Never assume
# marks line up directly with the raw webm timeline.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

W=1920
H=1080
FPS=30
CRF=18
PRESET=slow
FADE=0.35

mkdir -p seg out

src_of() { ls raw/"$1"/*.webm | head -1; }

make_title() {
  local out="$1" dur="$2" png="$3"
  local fout
  fout=$(python3 -c "print(${dur} - ${FADE})")
  ffmpeg -y -loop 1 -t "${dur}" -i "png/${png}.png" \
    -vf "fade=t=in:st=0:d=${FADE},fade=t=out:st=${fout}:d=${FADE}" \
    -r "${FPS}" -c:v libx264 -preset "${PRESET}" -crf "${CRF}" -pix_fmt yuv420p -movflags +faststart "seg/${out}" -loglevel error
  echo "  title: ${out} (${dur}s)"
}

extract_clip() {
  local segdir="$1" start="$2" dur="$3" out="$4" cap="$5"
  local src="$(src_of "${segdir}")"
  local tmp="seg/_raw_${out}"
  local fout
  fout=$(python3 -c "print(${dur} - ${FADE})")
  ffmpeg -y -ss "${start}" -t "${dur}" -i "${src}" \
    -vf "scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,fps=${FPS},format=yuv420p,fade=t=in:st=0:d=${FADE},fade=t=out:st=${fout}:d=${FADE}" \
    -an -c:v libx264 -preset "${PRESET}" -crf "${CRF}" -pix_fmt yuv420p -movflags +faststart "${tmp}" -loglevel error
  ffmpeg -y -i "${tmp}" -loop 1 -i "png/${cap}.png" \
    -filter_complex "[0:v][1:v] overlay=(W-w)/2:H-h-60:shortest=1" \
    -c:v libx264 -preset "${PRESET}" -crf "${CRF}" -pix_fmt yuv420p -movflags +faststart "seg/${out}" -loglevel error
  rm -f "${tmp}"
  echo "  extract: ${out} src=${src} [${start}, +${dur}]"
}

concat_to() {
  local outfile="$1"; shift
  local listfile="seg/_list.txt"
  : > "${listfile}"
  for f in "$@"; do echo "file '${f}.mp4'" >> "${listfile}"; done
  ffmpeg -y -f concat -safe 0 -i "${listfile}" -c copy "out/${outfile}" -loglevel error
  echo "== built out/${outfile} =="
  ffprobe -v error -show_entries format=duration -of csv=p=0 "out/${outfile}"
}

echo "== Title cards =="
make_title "k00.mp4" 4.0 "w00-title"
make_title "k01t.mp4" 1.6 "w01-login"
make_title "k03t.mp4" 1.6 "w02-command"
make_title "k07t.mp4" 1.6 "w03-cinema"
make_title "k10.mp4" 4.0 "w05-outro"

echo "== Clips (offsets are video-relative, see header note) =="
extract_clip "seg01-login"               8.5  1.9 "k02.mp4" "cap-login"
extract_clip "seg02-dashboard-console"  10.4  2.1 "k04.mp4" "cap-command"
extract_clip "seg02-dashboard-console"  12.9  1.6 "k05.mp4" "cap-command"
extract_clip "seg02-dashboard-console"  14.9  1.1 "k06.mp4" "cap-vm-card"
extract_clip "seg02-dashboard-console"  20.2  2.0 "k08.mp4" "cap-serial"
extract_clip "seg03-cinema-wall"        19.3  4.0 "k09.mp4" "cap-console"

concat_to "machina-wow-reel.mp4" \
  k00 k01t k02 k03t k04 k05 k06 k07t k08 k09 k10

cp out/machina-wow-reel.mp4 out/machina-wow-reel-linkedin-1080p.mp4
echo "== Done =="
