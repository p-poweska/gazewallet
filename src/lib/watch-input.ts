/** Extract only the destination of supported payment QR URIs; never execute a request. */
export function parseWatchInput(input: string): { value: string; label?: string } {
  const text = input.trim()
  if (!text || text.length > 2048) throw new Error('Enter a public key or address')
  if (!text.includes(':')) return { value: text }
  let uri: URL
  try { uri = new URL(text) } catch { throw new Error('Invalid QR content') }
  if (uri.protocol !== 'bitcoin:' && uri.protocol !== 'ethereum:') throw new Error('QR must contain a BTC/ETH address or extended public key')
  if (uri.host) throw new Error('Unsupported payment URI')
  if (uri.protocol === 'bitcoin:') {
    for (const key of uri.searchParams.keys()) if (key.startsWith('req-')) throw new Error('Unsupported required Bitcoin URI parameter')
    return { value: decodeURIComponent(uri.pathname), label: uri.searchParams.get('label')?.trim().slice(0, 120) || undefined }
  }
  if (uri.protocol === 'ethereum:') {
    const destination = decodeURIComponent(uri.pathname).replace(/^pay-/, '')
    if (destination.includes('/')) throw new Error('Contract call QR codes are not supported. Use an account address.')
    const parts = destination.split('@')
    const [value, network] = parts
    if (parts.length > 2 || (network !== undefined && network !== '1')) throw new Error('Only Ethereum mainnet addresses are supported')
    return { value }
  }
  throw new Error('QR must contain a BTC/ETH address or extended public key')
}
