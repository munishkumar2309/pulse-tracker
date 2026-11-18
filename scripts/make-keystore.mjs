// One-time: create the PKCS#12 keystore that signs every Pulse APK (so updates install over the old app).
// Usage: node scripts/make-keystore.mjs   → android/app/pulse-release.p12  (refuses to overwrite)
// Changing this key means the phone will refuse updates until the app is uninstalled (losing data).
import { existsSync, writeFileSync } from 'node:fs'
import forge from 'node-forge'

const out = new URL('../android/app/pulse-release.p12', import.meta.url)
if (existsSync(out)) { console.error('Keystore already exists; not overwriting.'); process.exit(1) }
const password = process.env.PULSE_KEYSTORE_PASSWORD || 'pulse-personal-app'

const keys = forge.pki.rsa.generateKeyPair(2048)
const cert = forge.pki.createCertificate()
cert.publicKey = keys.publicKey
cert.serialNumber = '01' + forge.util.bytesToHex(forge.random.getBytesSync(8))
cert.validity.notBefore = new Date()
cert.validity.notAfter = new Date(Date.now() + 30 * 365 * 864e5) // 30 years
const attrs = [{ name: 'commonName', value: 'Pulse personal app' }]
cert.setSubject(attrs)
cert.setIssuer(attrs)
cert.sign(keys.privateKey, forge.md.sha256.create())

const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { algorithm: '3des', friendlyName: 'pulse' })
writeFileSync(out, Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'))
console.log('wrote', out.pathname)
