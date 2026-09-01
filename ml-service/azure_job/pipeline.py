import os
import re
import json
import torch
import torch.nn as nn
from transformers import AutoTokenizer, AutoModelForSequenceClassification, AutoModelForCausalLM
from scipy.special import softmax

print("=== Loading the Hierarchical AI Pipeline ===")
print("[1/2] Loading Advanced Semantic Router Model...")
device = "cuda" if torch.cuda.is_available() else "cpu"

router_type = "transformer"
router_path = "outputs/transformer_router_final"

router_tokenizer = None
router_model = None
llm_tokenizer = None
llm_model = None

try:
    if os.path.exists(router_path):
        print("  -> Detected 66M DistilBERT Semantic Router!")
        router_tokenizer = AutoTokenizer.from_pretrained(router_path)
        router_model = AutoModelForSequenceClassification.from_pretrained(router_path).to(device)
except Exception as e:
    print(f"  [Note] Router weights loading deferred/fallback: {e}")

print("[2/2] Loading 135M Ultimate Mental Health LLM...")
model_path = "outputs/model_ultimate_context"
if not os.path.exists(model_path):
    model_path = "outputs/model_ultimate"

try:
    if os.path.exists(model_path):
        llm_tokenizer = AutoTokenizer.from_pretrained(model_path)
        llm_model = AutoModelForCausalLM.from_pretrained(
            model_path,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
            device_map="auto" if device == "cuda" else None
        )
except Exception as e:
    print(f"  [Note] LLM weights loading deferred/fallback: {e}")


def regex_safety_net(text):
    pattern = r"(kill myself|suicide|end it all|shoot myself|want to die|frag him)"
    return bool(re.search(pattern, text.lower()))

def trigger_emergency_api(user_input, source="System"):
    print(f"\n≡ƒÜ¿ [EMERGENCY API TRIGGERED BY {source}] ≡ƒÜ¿")
    print(f"Payload: {user_input}")

def analyze_intent(text):
    if router_tokenizer is not None and router_model is not None:
        inputs = router_tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(device)
        with torch.no_grad():
            logits = router_model(**inputs).logits[0].cpu().numpy()
            
        probs = softmax(logits / 1.2) 
        joy_prob, triage_prob, emergency_prob = probs[0], probs[1], probs[2]
        
        w_joy = joy_prob * 2.5
        w_triage = triage_prob * 1.0
        w_emerg = emergency_prob * 1.8
        
        total = w_joy + w_triage + w_emerg
        p_joy = w_joy / total
        p_triage = w_triage / total
        p_emerg = w_emerg / total
    else:
        # High precision lexical analysis fallback
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
        v = SentimentIntensityAnalyzer().polarity_scores(text)
        comp = v['compound']
        is_emerg = regex_safety_net(text)
        emergency_prob = 0.9 if is_emerg else 0.05
        joy_prob = max(0.1, (comp + 1.0) / 2.0) if not is_emerg else 0.05
        triage_prob = max(0.1, 1.0 - joy_prob) if not is_emerg else 0.05
        p_joy, p_triage, p_emerg = joy_prob, triage_prob, emergency_prob

    
    # 1. Macro Semantic Score (DistilBERT Expected Value)
    macro_morale = (p_joy * 100.0) + (p_triage * 45.0) + (p_emerg * 10.0)
    
    # 2. Micro Lexical Score (VADER Sentiment)
    global vader_analyzer
    if 'vader_analyzer' not in globals():
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
        vader_analyzer = SentimentIntensityAnalyzer()
        
    vader_scores = vader_analyzer.polarity_scores(text)
    compound = vader_scores['compound'] # Ranges from -1.0 (extreme negative) to 1.0 (extreme positive)
    micro_morale = ((compound + 1.0) / 2.0) * 90.0 + 10.0 # Map to 10-100 scale
    
    # 3. Hybrid Blending
    # If it's a severe emergency, trust the deep neural network entirely.
    # Otherwise, blend them (70% Neural Intent, 30% Micro Emotion) for hyper-granularity.
    if p_emerg > 0.35 or emergency_prob > 0.3:
        final_morale = macro_morale
        prediction = 2
    else:
        final_morale = (0.7 * macro_morale) + (0.3 * micro_morale)
        
        # Non-linear boost for neutral smoothing
        if 40 < final_morale < 70:
            final_morale += (p_joy * 15.0)
            
        prediction = 0 if p_joy > p_triage else 1
        
    morale_score = int(round(final_morale))
    morale_score = max(0, min(100, morale_score))
        
    if prediction == 2:
        return "emergency", morale_score
    elif prediction == 0:
        return "joy", morale_score
    else:
        return "triage", morale_score

def run_pipeline(user_input, trajectory_trend="INITIALIZING...", print_logs=False):
    mood, morale_score = analyze_intent(user_input)
    is_emergency = (mood == "emergency") or regex_safety_net(user_input)
    
    # --- RAG INJECTION ---
    rag_context = ""
    try:
        if os.path.exists('rag_db.json'):
            with open('rag_db.json', 'r', encoding='utf-8') as f:
                db = json.load(f)
            
            # Very fast lazy loading of sentence transformer
            global rag_model
            if 'rag_model' not in globals():
                from sentence_transformers import SentenceTransformer
                rag_model = SentenceTransformer('all-MiniLM-L6-v2')
            
            # Compute query vector
            query_vec = torch.tensor(rag_model.encode(user_input))
            
            # Find closest document
            best_score = -1
            best_doc = None
            for doc in db:
                doc_vec = torch.tensor(doc['vector'])
                score = torch.nn.functional.cosine_similarity(query_vec.unsqueeze(0), doc_vec.unsqueeze(0)).item()
                if score > best_score:
                    best_score = score
                    best_doc = doc
                    
            if best_doc and best_score > 0.40:  # Threshold for semantic match
                # Truncate content to protect 135M context window
                content_preview = best_doc['content'][:500] + "..." if len(best_doc['content']) > 500 else best_doc['content']
                rag_context = f"\n[Relevant Clinical Protocol: {best_doc['title']}]\n{content_preview}\n"
                if print_logs:
                    print(f"≡ƒôÜ [RAG] Retrieved '{best_doc['title']}' (Score: {best_score:.2f})")
    except Exception as e:
        print(f"RAG Error: {e}")
        
    if is_emergency:
        if print_logs: trigger_emergency_api(user_input, source="System Override")
        mood_str = "EMERGENCY / CRISIS"
        morale_score = 0
        system_prompt = "You are 'MentalWelfare', an emergency crisis intervention AI for military personnel. A human medical team has been alerted. Your ONLY job is to provide immediate, gentle, grounding support. Remind them they are safe and help is coming. Keep it brief and highly empathetic. Do not give generic advice."
    else:
        mood_str = "JOY / CASUAL" if mood == "joy" else "STRESS / TRIAGE"
        if mood == "joy":
            system_prompt = "You are 'MentalWelfare', an upbeat, encouraging, and joyful squadmate assistant. Match the user's positive energy, celebrate with them, and keep responses highly supportive and brief. Consolidate your thoughts and do not ask unnecessary questions; it is okay to simply listen and validate."
        else:
            system_prompt = "You are 'MentalWelfare', a professional, empathetic mental health triage aide for uniformed personnel. Validate their feelings, provide grounding support, and offer actionable but gentle advice. Consolidate your thoughts and do not ask overly probing or repetitive questions. Limit questions to one at most, and only if absolutely necessary. Avoid ending every response with a question."
            
    enriched_user_input = f"""[Real-Time System Context]
Morale Score: {morale_score}/100
Detected Mood: {mood_str}
Session Trajectory: {trajectory_trend}
Emergency Triggered: {is_emergency}{rag_context}

[User Message]
{user_input}"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": enriched_user_input}
    ]
    
    if llm_tokenizer is not None and llm_model is not None:
        text = llm_tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = llm_tokenizer(text, return_tensors="pt").to(llm_model.device)
        
        with torch.no_grad():
            outputs = llm_model.generate(
                **inputs, 
                max_new_tokens=150, 
                temperature=0.7,         
                top_k=50,                
                repetition_penalty=1.05, 
                pad_token_id=llm_tokenizer.eos_token_id
            )
            
        response = llm_tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True).strip()
    else:
        if is_emergency:
            response = "I hear you, and I want you to know that you are not alone. Please take a deep breath. Support is available for you right now, and I encourage you to connect with your unit medical officer or reach out to our emergency support route."
        elif mood == "joy":
            response = f"That's great to hear! It sounds like things are going well. Keep that momentum going and take pride in your achievements."
        else:
            response = f"Thank you for sharing that with me. It sounds like you're carrying a lot right now. Taking a moment to pause and pace yourself is important. What part of your day has felt most demanding?"
    return response, morale_score, mood_str, is_emergency

