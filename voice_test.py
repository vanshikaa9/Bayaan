import speech_recognition as sr
import sounddevice as sd
from scipy.io.wavfile import write

fs = 44100
seconds = 5

print("Speak now...")

recording = sd.rec(
    int(seconds * fs),
    samplerate=fs,
    channels=1,
    dtype="int16"
)

sd.wait()

write("temp.wav", fs, recording)

r = sr.Recognizer()

with sr.AudioFile("temp.wav") as source:
    audio = r.record(source)

try:
    text = r.recognize_google(audio)
    print("You said:", text)

except Exception as e:
    print("Error:", e)