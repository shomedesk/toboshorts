import FingerprintJS from '@fingerprintjs/fingerprintjs';

let fpPromise: Promise<any> | null = null;

export async function getDeviceId(): Promise<string> {
  try {
    if (!fpPromise) {
      fpPromise = FingerprintJS.load();
    }
    const fp = await fpPromise;
    const result = await fp.get();
    return result.visitorId;
  } catch (err) {
    console.warn('Fingerprinting blocked or failed, using fallback:', err);
    // Fallback to a simple session-based or random ID if blocked in iframe
    return 'device_' + Math.random().toString(36).substring(2, 11);
  }
}
