import os
import warnings
import asyncio
import edge_tts
import speech_recognition as sr
import whisper
import torch
import sys
import pygame
import tempfile

# Suppress warnings for clean terminal
warnings.filterwarnings('ignore')

print("="*60)
print("≡ƒÄÖ∩╕Å INITIALIZING 'MENTALWELFARE' NEURAL VOICE INTERFACE...")
print("="*60)

# 2. Initialize High-Quality Text-to-Speech (Edge-TTS)
print("[1/3] Booting Neural Audio Subsystem (Edge-TTS)...")
VOICE = "en-US-ChristopherNeural" # Professional, calm male voice

async def async_speak(text):
    print(f"\n[MentalWelfare Speaks]: {text}")
    communicate = edge_tts.Communicate(text, VOICE)
    # Save to temp mp3 and play with pygame
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp_file:
        tmp_path = tmp_file.name
    await communicate.save(tmp_path)
    
    pygame.mixer.init()
    pygame.mixer.music.load(tmp_path)
    pygame.mixer.music.play()
    while pygame.mixer.music.get_busy():
        pygame.time.Clock().tick(10)
    pygame.mixer.quit()
    os.unlink(tmp_path)

def speak(text):
    asyncio.run(async_speak(text))

# 3. Initialize Speech-to-Text (Whisper)
print("[2/3] Loading Whisper (base.en) for Edge Speech Recognition...")
# Use tiny.en or base.en for ultra-fast edge processing
device = "cuda" if torch.cuda.is_available() else "cpu"
audio_model = whisper.load_model("base.en").to(device)

# 4. Load the Mental Health Pipeline
print("[3/3] Loading Neural Pipeline (135M LLM + 66M DistilBERT Router)...")
# We append the dir to sys.path to easily import the azure_job module
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "azure_job")))
from pipeline import run_pipeline

print("\n" + "="*60)
print("Γ£à MENTALWELFARE ONLINE. READY FOR VOICE INPUT.")
print("="*60)

# Audio Configuration
recognizer = sr.Recognizer()
recognizer.energy_threshold = 400
recognizer.dynamic_energy_threshold = True

session_morale_history = []
trend_str = "INITIALIZING..."

with sr.Microphone() as source:
    print("\nCalibrating microphone for ambient noise... (Please be quiet for 2 seconds)")
    recognizer.adjust_for_ambient_noise(source, duration=2)
    speak("MentalWelfare is online. How can I assist you today?")
    
    while True:
        print("\n" + "-"*40)
        print("≡ƒÄñ [Listening... Speak now]")
        try:
            # Listen to the user's voice
            audio = recognizer.listen(source, timeout=10, phrase_time_limit=15)
            print("ΓÅ│ [Processing Audio...]")
            
            # Save audio to temp file for Whisper
            with open("temp_audio.wav", "wb") as f:
                f.write(audio.get_wav_data())
                
            # Transcribe with Whisper
            result = audio_model.transcribe("temp_audio.wav", fp16=torch.cuda.is_available())
            user_text = result["text"].strip()
            
            if not user_text:
                continue
                
            print(f"\n[You Said]: {user_text}")
            
            if user_text.lower() in ['quit', 'exit', 'shutdown', 'shut down']:
                speak("Copy that. MentalWelfare signing off.")
                break
                
            # --- ROUTING AND INFERENCE ---
            print("≡ƒºá [Routing through DistilBERT & Generative AI...]")
            response, morale, mood, is_emerg = run_pipeline(user_input=user_text, trajectory_trend=trend_str, print_logs=True)
            
            # Track Trajectory for next turn
            session_morale_history.append(morale)
            if len(session_morale_history) > 3:
                session_morale_history.pop(0)
                
            if len(session_morale_history) >= 2:
                trend = session_morale_history[-1] - session_morale_history[0]
                if trend <= -20: trend_str = "RAPIDLY DECLINING (Warning)"
                elif trend < 0: trend_str = "DECLINING"
                elif trend >= 20: trend_str = "RAPIDLY IMPROVING"
                elif trend > 0: trend_str = "IMPROVING"
                else: trend_str = "STABLE"
                
            speak(response)
            
        except sr.WaitTimeoutError:
            pass
        except Exception as e:
            print(f"Error: {e}")
