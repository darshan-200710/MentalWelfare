import sys
import os
import time

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "azure_job")))
from pipeline import run_pipeline

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def main():
    clear_screen()
    print("="*60)
    print(" ≡ƒ¢í∩╕Å MentalWelfare - Text Interface (Fallback Mode) ≡ƒ¢í∩╕Å")
    print("="*60)
    
    base = input("\nEnter your Military Installation/Base: ").strip()
    
    print("\n[System] Initializing Neural Networks...")
    time.sleep(1) # Simulated delay for UI feel since models load inside pipeline lazily or at import
    
    # We do a quick dummy run to force models to load into VRAM before the first user message
    print("[System] Loading DistilBERT Router and 135M LLM into VRAM...")
    _, _, _, _ = run_pipeline("Load models", trajectory_trend="INITIALIZING", print_logs=False)
    
    print("\n[System] Ready. Type 'quit' or 'exit' to end the session.")
    print("="*60)
    print(f"\nMentalWelfare: Welcome to {base}. I'm here to support you. How are you feeling today?")
    
    trajectory_trend = "STABLE"
    recent_scores = []

    while True:
        print("\n" + "-"*60)
        user_input = input("You: ").strip()
        
        if user_input.lower() in ['quit', 'exit']:
            print("\nMentalWelfare: Stay safe. We are always here if you need us. Session ended.")
            break
            
        if not user_input:
            continue
            
        print("\n[Thinking...]")
        
        # Determine trajectory
        if len(recent_scores) >= 2:
            avg_recent = sum(recent_scores[-2:]) / 2
            if avg_recent < 40:
                trajectory_trend = "DECLINING"
            elif avg_recent > 70:
                trajectory_trend = "IMPROVING"
            else:
                trajectory_trend = "STABLE"
                
        # Run Pipeline
        response, morale_score, mood, is_emergency = run_pipeline(
            user_input=user_input, 
            trajectory_trend=trajectory_trend, 
            print_logs=True # True prints the RAG retrieval logs!
        )
        
        recent_scores.append(morale_score)
        
        print(f"\nMentalWelfare: {response}")
        print(f"\n[Debug] Morale: {morale_score}/100 | Mood: {mood.upper()} | Emergency: {is_emergency}")

if __name__ == "__main__":
    main()
