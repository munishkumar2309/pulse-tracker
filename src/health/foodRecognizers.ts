// Runs food photo recognition. Two engines, both loaded only when first used (dynamic import):
//  1. On the phone (default): ViT food classifier via Transformers.js + ONNX Runtime (WebAssembly).
//     The photo never leaves the phone. Model files: bundled copy in /models/ if present, else downloaded
//     once from Hugging Face and cached by the browser. The ONNX Runtime .wasm is bundled by Vite (no CDN).
//  2. Cloud (opt-in, Settings → Food photos): Claude vision with the user's own API key. The photo is sent
//     to Anthropic. Handles mixed plates and estimates portions.
// Pure mapping to Pulse foods lives in foodVision.ts. Docs: docs/HEALTH.md → Food photo recognition.
import { db } from '../db/schema'
// The package doesn't export its .wasm, so import it by path; Vite emits it as a hashed asset.
import ortWasmUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm?url'
import type { CloudItem, Guess } from './foodVision'

export const LOCAL_MODEL = 'dima806/indian_food_image_detection'
export const CLOUD_MODEL = 'claude-opus-5-5'
const KEY = 'secret:anthropicKey' // 'secret:' meta rows are left out of backups (Settings → exportData)

export interface VisionSettings { cloud: boolean; apiKey: string }

export async function getVisionSettings(): Promise<VisionSettings> {
  const cloud = !!((await db.meta.get('foodVision'))?.value as { cloud?: boolean } | undefined)?.cloud
  const apiKey = ((await db.meta.get(KEY))?.value as string | undefined) ?? ''
  return { cloud, apiKey }
}

export async function setVisionSettings(s: VisionSettings) {
  await db.meta.bulkPut([{ key: 'foodVision', value: { cloud: s.cloud } }, { key: KEY, value: s.apiKey.trim() }])
}

/** Shrink to at most `max` px on the long side as JPEG: faster to classify, smaller to upload. */
export async function prepareImage(file: Blob, max = 1024): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * k)
  canvas.height = Math.round(bmp.height * k)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('Could not read the photo.'))), 'image/jpeg', 0.85))
}

export type Progress = (pct: number | null) => void

type Classifier = (image: string, opts: { top_k: number }) => Promise<{ label: string; score: number }[]>
let classifier: Promise<Classifier> | null = null

async function loadClassifier(onProgress?: Progress): Promise<Classifier> {
  const { pipeline, env } = await import('@huggingface/transformers')
  // A bundled copy (scripts/export-food-model.py) makes it fully offline: then never ask Hugging Face,
  // or the optional-file checks (tokenizer) would fail without internet. Otherwise download once, then cached.
  const bundled = await fetch(`/models/${LOCAL_MODEL}/config.json`, { method: 'HEAD' }).then((r) => r.ok && !!r.headers.get('content-type')?.includes('json')).catch(() => false)
  env.allowLocalModels = bundled
  env.localModelPath = '/models/'
  env.allowRemoteModels = !bundled
  const wasm = env.backends.onnx.wasm
  if (wasm) wasm.wasmPaths = { wasm: ortWasmUrl } // bundled copy instead of the jsdelivr CDN; the loader is built into ORT's bundle
  const p = await pipeline('image-classification', LOCAL_MODEL, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (e: { status: string; progress?: number }) => { if (e.status === 'progress' && e.progress !== undefined) onProgress?.(Math.round(e.progress)) },
  })
  return p as unknown as Classifier
}

/** On-phone recognition: top 5 dish guesses with scores 0–1. */
export async function classifyOnPhone(photo: Blob, onProgress?: Progress): Promise<Guess[]> {
  classifier ??= loadClassifier(onProgress).catch((e) => { classifier = null; throw e })
  const run = await classifier
  onProgress?.(null)
  const url = URL.createObjectURL(photo)
  try {
    return (await run(url, { top_k: 5 })).map((r) => ({ label: r.label, score: r.score }))
  } finally {
    URL.revokeObjectURL(url)
  }
}

const SYSTEM = `You identify food in a photo for a calorie-tracking app used in India.
List each separate food item you can see (for a thali, each katori and bread separately).
Use common Indian English dish names (e.g. "Dal tadka", "Jeera rice", "Roti / chapati", "Masala dosa").
estimated_grams is the edible amount visible in the photo; estimated_kcal is for that amount, assuming a typical home recipe.
If the photo shows no food, return an empty items list.`

/** Cloud recognition with Claude vision. Throws a readable Error on failure. */
export async function recognizeInCloud(photo: Blob, apiKey: string): Promise<CloudItem[]> {
  const [{ default: Anthropic }, { betaZodOutputFormat }, { z }] = await Promise.all([
    import('@anthropic-ai/sdk'), import('@anthropic-ai/sdk/helpers/beta/zod'), import('zod'),
  ])
  const Items = z.object({
    items: z.array(z.object({
      name: z.string(),
      estimated_grams: z.number(),
      estimated_kcal: z.number(),
      confidence: z.enum(['high', 'medium', 'low']),
    })),
  })
  const data = await blobToBase64(photo)
  // The key is the user's own, stored only on this phone; the request goes straight to Anthropic.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  try {
    const res = await client.beta.messages.parse({
      model: CLOUD_MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // if the model declines, the API retries on a fallback model
      output_config: { effort: 'low', format: betaZodOutputFormat(Items) },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
          { type: 'text', text: 'What food is in this photo, and how much?' },
        ],
      }],
    })
    if (res.stop_reason === 'refusal') throw new Error("The cloud model couldn't read this photo. Try another, or search by name.")
    if (!res.parsed_output) throw new Error('The cloud model gave an unreadable answer. Try again.')
    return res.parsed_output.items
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('The API key was rejected. Check it in Settings → Food photos.')
    if (e instanceof Anthropic.RateLimitError) throw new Error('Too many requests right now. Wait a minute and try again.')
    if (e instanceof Anthropic.APIConnectionError) throw new Error('No internet connection. On-phone recognition still works.')
    if (e instanceof Anthropic.APIError) throw new Error(`Cloud recognition failed (${e.status ?? 'error'}). Try again later.`)
    throw e
  }
}

async function blobToBase64(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer())
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
