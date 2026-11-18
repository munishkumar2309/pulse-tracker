// Android SMS → transactions. Uses our own native plugin (android/.../SmsReaderPlugin.java).
// In a browser this is a no-op; the Money screen's paste box is the fallback.
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { db } from '../db/schema'
import { ingestSms, type IngestResult } from '../money/ingest'

interface RawSms { address: string; body: string; date: number }
interface SmsReaderPlugin {
  readInbox(o: { since: number; limit?: number }): Promise<{ messages: RawSms[] }>
  startListening(): Promise<void>
  addListener(event: 'smsReceived', cb: (m: RawSms) => void): Promise<PluginListenerHandle>
}

const SmsReader = registerPlugin<SmsReaderPlugin>('SmsReader')
export const smsSupported = () => Capacitor.getPlatform() === 'android'

/**
 * Indian commercial sender IDs look like "AX-HDFCBK", "VM-ICICIT-S", "JD-SBIUPI-T".
 * Personal numbers (+91…) are never parsed.
 */
export const isBankSender = (address: string) => /^[A-Z]{2}-[A-Z0-9]{3,9}(-[A-Z])?$/i.test(address.trim())

const FIRST_SYNC_DAYS = 90

/** Read new SMS since the last sync (first time: last 90 days) and save bank transactions. */
export async function syncSmsInbox(): Promise<IngestResult | null> {
  if (!smsSupported()) return null
  const last = (await db.meta.get('smsLastSync'))?.value as number | undefined
  const since = last ?? Date.now() - FIRST_SYNC_DAYS * 864e5
  const { messages } = await SmsReader.readInbox({ since })
  const bank = messages.filter((m) => isBankSender(m.address))
  const res = await ingestSms(bank.map((m) => ({ body: m.body, at: new Date(m.date), sender: m.address })))
  const newest = messages.reduce((a, m) => Math.max(a, m.date), since)
  await db.meta.put({ key: 'smsLastSync', value: newest })
  await db.meta.put({ key: 'smsLastResult', value: { at: Date.now(), added: res.added.length, read: bank.length } })
  return res
}

let listening = false
/** While the app is open, record bank SMS the moment they arrive. */
export async function listenForSms() {
  if (!smsSupported() || listening) return
  await SmsReader.startListening()
  await SmsReader.addListener('smsReceived', async (m) => {
    if (!isBankSender(m.address)) return
    await ingestSms([{ body: m.body, at: new Date(m.date), sender: m.address }])
    await db.meta.put({ key: 'smsLastSync', value: m.date })
  })
  listening = true
}
