import wave
import numpy as np

SAMPLE_RATE = 44100
PEAK = 0.2
END_GAIN = 0.01
DURATION = 0.2
GAP = 0.1
FREQUENCIES = [523.25, 659.25, 783.99]


def render_note(freq, sr=SAMPLE_RATE, duration=DURATION, peak=PEAK, end_gain=END_GAIN):
    n = int(round(duration * sr))
    t = np.linspace(0.0, duration, n, endpoint=False)
    tone = np.sin(2.0 * np.pi * freq * t)
    # replicate WebAudio: setValueAtTime(peak) then exponentialRampToValueAtTime(end_gain, +duration)
    env = peak * np.power(end_gain / peak, t / duration)
    note = tone * env
    return note


total = int(round((len(FREQUENCIES) * (GAP + DURATION) - GAP) * SAMPLE_RATE))
buf = np.zeros(total, dtype=np.float64)
for i, freq in enumerate(FREQUENCIES):
    start = int(round(i * GAP * SAMPLE_RATE))
    note = render_note(freq)
    buf[start:start + len(note)] += note

buf = np.clip(buf, -1.0, 1.0)
buf_int16 = np.int16(buf * 32767)

with wave.open("success.wav", "w") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SAMPLE_RATE)
    w.writeframes(buf_int16.tobytes())

print("success.wav written, frames:", len(buf_int16), "duration:", total / SAMPLE_RATE)
