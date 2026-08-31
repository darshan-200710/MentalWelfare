import os
import sys
import time
import signal
import socket
import subprocess
import webbrowser
import urllib.request

BANNER = r"""
======================================================================
  ____ ____  ____  _____   __  __ _____ _   _ _____  _    _     
 / ___|  _ \|  _ \|  ___| |  \/  | ____| \ | |_   _|/ \  | |    
| |   | |_) | |_) | |_    | |\/| |  _| |  \| | | | / _ \ | |    
| |___|  _ <|  __/|  _|   | |  | | |___| |\  | | |/ ___ \| |___ 
 \____|_| \_\_|   |_|     |_|  |_|_____|_| \_| |_/_/   \_\_____|
                                                                
       CRPF MENTAL HEALTH & WELLBEING PLATFORM (STANDALONE)
  [Embedded: 135M Causal LLM • Whisper STT • Edge-TTS • DistilBERT • FFmpeg]
======================================================================
"""

def get_base_dir() -> str:
    if getattr(sys, "frozen", False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))

def get_resource_dir() -> str:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return sys._MEIPASS
    return get_base_dir()

def setup_embedded_environment():
    base_dir = get_base_dir()
    res_dir = get_resource_dir()

    # 1. Locate and configure bundled FFmpeg
    possible_ffmpeg_paths = [
        os.path.join(res_dir, "ffmpeg.exe"),
        os.path.join(res_dir, "ml-service", "ffmpeg.exe"),
        os.path.join(base_dir, "ffmpeg.exe"),
        os.path.join(base_dir, "ml-service", "ffmpeg.exe"),
    ]
    
    ffmpeg_bin = None
    for p in possible_ffmpeg_paths:
        if os.path.exists(p):
            ffmpeg_bin = p
            break

    if ffmpeg_bin:
        ffmpeg_dir = os.path.dirname(ffmpeg_bin)
        os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
        os.environ["FFMPEG_BINARY"] = ffmpeg_bin
        os.environ["IMAGEIO_FFMPEG_EXE"] = ffmpeg_bin
        print(f"[+] Embedded FFmpeg Active: {ffmpeg_bin}")
    else:
        print("[!] Warning: ffmpeg.exe not found in bundle, using system PATH.")

    # 2. Locate and configure 135M Parameter LLM & Router
    possible_135m_paths = [
        os.path.join(res_dir, "ml-service", "outputs", "model_ultimate_context"),
        os.path.join(base_dir, "ml-service", "outputs", "model_ultimate_context"),
    ]
    for p in possible_135m_paths:
        if os.path.exists(p):
            os.environ["MODEL_LLM_PATH"] = p
            print(f"[+] Embedded 135M Parameter Model: {p}")
            break

    possible_router_paths = [
        os.path.join(res_dir, "ml-service", "outputs", "transformer_router_final"),
        os.path.join(base_dir, "ml-service", "outputs", "transformer_router_final"),
    ]
    for p in possible_router_paths:
        if os.path.exists(p):
            os.environ["MODEL_ROUTER_PATH"] = p
            print(f"[+] Embedded Intent Router: {p}")
            break

    # 3. Configure Vector RAG & Device settings
    os.environ["ML_DEVICE"] = os.environ.get("ML_DEVICE", "cpu")
    rag_paths = [
        os.path.join(res_dir, "rag_db.json"),
        os.path.join(res_dir, "ml-service", "rag_db.json"),
        os.path.join(base_dir, "ml-service", "rag_db.json"),
    ]
    for r in rag_paths:
        if os.path.exists(r):
            os.environ["RAG_DB_PATH"] = r
            break

def is_port_open(port: int, host: str = "127.0.0.1") -> bool:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.5)
        res = s.connect_ex((host, port))
        s.close()
        return res == 0
    except Exception:
        return False

def wait_for_service(url: str, name: str, timeout: int = 30) -> bool:
    print(f"[*] Waiting for {name} to be ready...", end="", flush=True)
    start = time.time()
    while time.time() - start < timeout:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "MentalWelfare-Launcher"})
            with urllib.request.urlopen(req, timeout=1) as resp:
                if resp.status in (200, 404):
                    print(" [READY]")
                    return True
        except Exception:
            pass
        print(".", end="", flush=True)
        time.sleep(1)
    print(" [TIMEOUT - Continuing]")
    return False

def main():
    print(BANNER)
    base_dir = get_base_dir()
    print(f"[*] Platform Root Directory: {base_dir}")

    setup_embedded_environment()

    processes = []

    def cleanup(sig=None, frame=None):
        print("\n[*] Shutting down MentalWelfare platform services...")
        for p in processes:
            try:
                p.terminate()
                p.kill()
            except Exception:
                pass
        print("[+] All services stopped successfully.")
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    python_exe = sys.executable if not getattr(sys, "frozen", False) else "py"

    # 1. Start ML Microservice on Port 8001 (135M LLM, Whisper STT, DistilBERT, RAG)
    ml_dir = os.path.join(base_dir, "ml-service")
    if not is_port_open(8001):
        print("[*] Starting AI / ML Intelligence Microservice (Port 8001)...")
        p_ml = subprocess.Popen(
            [python_exe, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"],
            cwd=ml_dir,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        )
        processes.append(p_ml)
    else:
        print("[+] AI / ML Intelligence Microservice already active on Port 8001.")

    # 2. Start FastAPI Backend Gateway on Port 8000
    backend_dir = os.path.join(base_dir, "backend")
    if not is_port_open(8000):
        print("[*] Starting Security Gateway & Backend API (Port 8000)...")
        p_backend = subprocess.Popen(
            [python_exe, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
            cwd=backend_dir,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        )
        processes.append(p_backend)
    else:
        print("[+] Backend API already active on Port 8000.")

    # 3. Start Next.js Frontend on Port 3000
    frontend_dir = os.path.join(base_dir, "frontend")
    if not is_port_open(3000):
        print("[*] Starting Next.js Web Application (Port 3000)...")
        p_frontend = subprocess.Popen(
            ["npx.cmd" if sys.platform == "win32" else "npx", "next", "dev", "-H", "0.0.0.0", "-p", "3000"],
            cwd=frontend_dir,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        )
        processes.append(p_frontend)
    else:
        print("[+] Next.js Frontend already active on Port 3000.")

    # 4. Wait for readiness
    wait_for_service("http://127.0.0.1:8001/api/ml/health", "AI Microservice (8001)", timeout=15)
    wait_for_service("http://127.0.0.1:8000/health", "Backend Gateway (8000)", timeout=15)
    wait_for_service("http://127.0.0.1:3000", "Frontend Portal (3000)", timeout=20)

    # 5. Open Web Browser
    app_url = "http://127.0.0.1:3000"
    print(f"\n======================================================================")
    print(f"  [+] PLATFORM ONLINE! Opening web portal in your browser...")
    print(f"  🔗 URL: {app_url}")
    print(f"  🛡️ Admin Console: {app_url}/admin")
    print(f"  Press Ctrl+C in this window at any time to stop the server.")
    print(f"======================================================================\n")

    time.sleep(1)
    webbrowser.open(app_url)

    try:
        while True:
            time.sleep(2)
    except KeyboardInterrupt:
        cleanup()

if __name__ == "__main__":
    main()
