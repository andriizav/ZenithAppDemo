import wave
import numpy as np

SAMPLE_RATE = 44100
DURATION = 0.2
GAP = 0.1


def render_note(freq, sr=SAMPLE_RATE, duration=DURATION, peak=0.2, end_gain=0.01):
    n = int(round(duration * sr))
    t = np.linspace(0.0, duration, n, endpoint=False)
    tone = np.sin(2.0 * np.pi * freq * t)
    env = peak * np.power(end_gain / peak, t / duration)
    return tone * env


def make_file(path, frequencies, peak):
    total = int(round((len(frequencies) * (GAP + DURATION) - GAP) * SAMPLE_RATE))
    buf = np.zeros(total, dtype=np.float64)
    for i, freq in enumerate(frequencies):
        start = int(round(i * GAP * SAMPLE_RATE))
        note = render_note(freq, peak=peak)
        buf[start:start + len(note)] += note
    buf = np.clip(buf, -1.0, 1.0)
    buf_int16 = np.int16(buf * 32767)
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(buf_int16.tobytes())
    print(path, "written, duration:", total / SAMPLE_RATE)


make_file("uncheck.wav", [783.99, 659.25, 523.25], 0.2)
make_file("skip.wav", [392.00, 349.23, 329.63], 0.15)
