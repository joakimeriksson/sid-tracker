// Assemble the tracker into a static tree for GitHub Pages.
//
//   node tools/build-pages.mjs [--out _site]
//
// Two things ship, from one source tree:
//   /                 the tracker, opening on sids/default-song.sng
//   /happy-birthday/  the same tracker, opening on the birthday arrangement
//
// The variant is NOT a fork. It is a copy of the built site with one file
// swapped and two strings patched, which is why there is only ever one
// tracker to maintain. Adding another variant is one entry in VARIANTS.
//
// The tracker uses relative URLs throughout, so it needs no base-path
// rewriting and works served from any sub-path.

import { cp, mkdir, rm, readFile, writeFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  const eq = process.argv.find(a => a.startsWith(`${name}=`))
  return eq ? eq.split('=').slice(1).join('=') : fallback
}

const OUT = resolve(ROOT, arg('--out', '_site'))

// Everything the browser never asks for. gt2-src is the GoatTracker2 C
// reference, tests are the golden register dumps and tools are the Node-side
// verification harness - all three matter to `make verify` and none of them
// to a visitor, so they stay out of the deploy rather than padding it by ~18MB.
const EXCLUDE = /(^|\/)(\.git|\.github|\.claude|node_modules|gt2-src|tests|tools)(\/|$)/

/**
 * Each variant: the folder it gets, the song it opens on, and the handful of
 * strings that carry its name. `overlay` copies files over the site after it
 * lands; `replace` does literal substitutions. Every `find` must match or the
 * build fails - a silently-skipped rename would deploy a mislabelled page.
 */
const VARIANTS = [
  {
    slug: 'happy-birthday',
    overlay: { 'sids/default-song.sng': 'sids/happy-birthday.sng' },
    replace: {
      'index.html': [
        ['<title>SID Tracker</title>', '<title>SID Tracker — Happy Birthday</title>'],
        ['<h1>SID Tracker</h1>', '<h1>SID Tracker <small>Happy Birthday</small></h1>'],
      ],
    },
  },
]

if (!existsSync(resolve(ROOT, 'jsSID/js/jssid.core.js'))) {
  throw new Error(
    'jsSID/ is empty - the SID engine is a submodule and index.html loads nine ' +
    'scripts from it. Run: git submodule update --init'
  )
}

await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })

// Copy the tracker source tree somewhere, minus everything the browser never
// asks for. Entry by entry rather than `cp(ROOT, dest)`: the output lives
// inside ROOT, and copying a directory into its own descendant is what `cp`
// refuses with EINVAL - before it ever consults the filter.
const copyTracker = async (dest) => {
  await mkdir(dest, { recursive: true })
  for (const name of await readdir(ROOT)) {
    if (name === '_site' || EXCLUDE.test(`/${name}`)) continue
    await cp(resolve(ROOT, name), resolve(dest, name), {
      recursive: true,
      filter: (p) => !EXCLUDE.test(p.slice(ROOT.length)),
    })
  }
}

// The tracker itself, at the root of the site.
await copyTracker(OUT)
console.log('[pages] tracker -> /')

for (const v of VARIANTS) {
  const dest = resolve(OUT, v.slug)
  await copyTracker(dest)

  for (const [to, from] of Object.entries(v.overlay ?? {})) {
    await cp(resolve(ROOT, from), resolve(dest, to))
    console.log(`[pages]   overlay ${to} <- ${from}`)
  }

  for (const [file, edits] of Object.entries(v.replace ?? {})) {
    const target = resolve(dest, file)
    let text = await readFile(target, 'utf8')
    for (const [find, replaceWith] of edits) {
      if (!text.includes(find)) {
        throw new Error(`[pages] ${v.slug}: ${file} has no "${find}" to replace`)
      }
      text = text.split(find).join(replaceWith)
    }
    await writeFile(target, text)
    console.log(`[pages]   patched ${file} (${edits.length} replacement${edits.length === 1 ? '' : 's'})`)
  }
  console.log(`[pages] ${v.slug} -> /${v.slug}/`)
}

// Jekyll would otherwise swallow any path starting with an underscore.
await writeFile(resolve(OUT, '.nojekyll'), '')

console.log(`[pages] done -> ${OUT}`)
