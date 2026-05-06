import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = join(process.cwd(), 'ios/App/App/NotificationSounds');
const SAMPLE_RATE = 44_100;

function makeWav(name, durationSec, tones) {
  const samples = Math.floor(SAMPLE_RATE * durationSec);
  const data = Buffer.alloc(samples * 2);

  for (let i = 0; i < samples; i += 1) {
    const t = i / SAMPLE_RATE;
    const envelope = Math.min(1, t / 0.08) * Math.min(1, (durationSec - t) / 0.25);
    const tone = tones.reduce((sum, item) => {
      const active = t >= item.start && t <= item.end;
      if (!active) return sum;
      return sum + Math.sin(2 * Math.PI * item.freq * (t - item.start)) * item.gain;
    }, 0);
    const sample = Math.max(-1, Math.min(1, tone * envelope));
    data.writeInt16LE(Math.round(sample * 0x7fff), i * 2);
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);

  writeFileSync(join(OUT_DIR, name), Buffer.concat([header, data]));
}

mkdirSync(OUT_DIR, { recursive: true });

makeWav('beep.wav', 0.65, [
  { start: 0.05, end: 0.22, freq: 880, gain: 0.38 },
  { start: 0.31, end: 0.48, freq: 1175, gain: 0.34 },
]);

makeWav('adhan_chime.wav', 6, [
  { start: 0.0, end: 2.2, freq: 392, gain: 0.2 },
  { start: 0.5, end: 3.2, freq: 523.25, gain: 0.16 },
  { start: 1.6, end: 4.5, freq: 659.25, gain: 0.12 },
  { start: 3.2, end: 5.8, freq: 784, gain: 0.1 },
]);

console.log(`Generated iOS notification sounds in ${OUT_DIR}`);
