import os
import sys
import time
import socket
import signal
import threading
import subprocess
import urllib.request
import webview

def get_base_dir() -> str:
    if getattr(sys, "frozen", False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))

def get_resource_dir() -> str:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return sys._MEIPASS
    return get_base_dir()

def load_runtime_env():
    """Load env vars from the bundled runtime.env file (gitignored, packed into EXE)."""
    res_dir = get_resource_dir()
    base_dir = get_base_dir()
    candidates = [
        os.path.join(res_dir, "runtime.env"),
        os.path.join(base_dir, "runtime.env"),
    ]
    for path in candidates:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        key, _, value = line.partition("=")
                        key = key.strip()
                        value = value.strip().strip('"').strip("'")
                        if not os.environ.get(key):
                            os.environ[key] = value
            return

def setup_embedded_environment():
    base_dir = get_base_dir()
    res_dir = get_resource_dir()

    # ── Load secrets from bundled runtime.env ──
    load_runtime_env()

    # ── Set non-secret defaults ──
    os.environ.setdefault("HOSTNAME", "0.0.0.0")
    os.environ.setdefault("PORT", "3000")

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

    # 2. Locate and configure 135M Parameter LLM & Router
    for p in [
        os.path.join(res_dir, "ml-service", "outputs", "model_ultimate_context"),
        os.path.join(base_dir, "ml-service", "outputs", "model_ultimate_context"),
    ]:
        if os.path.exists(p):
            os.environ["MODEL_LLM_PATH"] = p
            break

    for p in [
        os.path.join(res_dir, "ml-service", "outputs", "transformer_router_final"),
        os.path.join(base_dir, "ml-service", "outputs", "transformer_router_final"),
    ]:
        if os.path.exists(p):
            os.environ["MODEL_ROUTER_PATH"] = p
            break

    # 3. Configure Vector RAG & Device settings
    os.environ.setdefault("ML_DEVICE", "cpu")
    for r in [
        os.path.join(res_dir, "rag_db.json"),
        os.path.join(res_dir, "ml-service", "rag_db.json"),
        os.path.join(base_dir, "ml-service", "rag_db.json"),
    ]:
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

def wait_for_service(url: str, timeout: int = 30) -> bool:
    start = time.time()
    while time.time() - start < timeout:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "MentalWelfare-Desktop"})
            with urllib.request.urlopen(req, timeout=1) as resp:
                if resp.status in (200, 404):
                    return True
        except Exception:
            pass
        time.sleep(0.5)
    return False

def find_node_exe() -> str:
    """Find node.exe — check bundled location first, then system PATH."""
    res_dir = get_resource_dir()
    base_dir = get_base_dir()
    for c in [os.path.join(res_dir, "node.exe"), os.path.join(base_dir, "node.exe")]:
        if os.path.exists(c):
            return c
    import shutil
    return shutil.which("node") or shutil.which("node.exe") or "node"

def find_standalone_server() -> str:
    """Find the pre-built Next.js standalone server.js."""
    res_dir = get_resource_dir()
    base_dir = get_base_dir()
    for c in [
        os.path.join(res_dir, "standalone", "server.js"),
        os.path.join(base_dir, "standalone", "server.js"),
        os.path.join(base_dir, "frontend", ".next", "standalone", "server.js"),
    ]:
        if os.path.exists(c):
            return c
    return ""

processes = []

def start_background_services():
    base_dir = get_base_dir()
    python_exe = sys.executable if not getattr(sys, "frozen", False) else "py"

    # 1. Start ML Microservice on Port 8001
    ml_dir = os.path.join(base_dir, "ml-service")
    if not is_port_open(8001) and os.path.isdir(ml_dir):
        p_ml = subprocess.Popen(
            [python_exe, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"],
            cwd=ml_dir,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        )
        processes.append(p_ml)

    # 2. Start FastAPI Backend Gateway on Port 8000
    backend_dir = os.path.join(base_dir, "backend")
    if not is_port_open(8000) and os.path.isdir(backend_dir):
        p_backend = subprocess.Popen(
            [python_exe, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
            cwd=backend_dir,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        )
        processes.append(p_backend)

    # 3. Start Next.js Frontend on Port 3000
    if not is_port_open(3000):
        standalone_server = find_standalone_server()
        if standalone_server:
            node_exe = find_node_exe()
            server_dir = os.path.dirname(standalone_server)
            p_frontend = subprocess.Popen(
                [node_exe, "server.js"],
                cwd=server_dir,
                env={**os.environ, "HOSTNAME": "0.0.0.0", "PORT": "3000"},
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            )
        else:
            frontend_dir = os.path.join(base_dir, "frontend")
            p_frontend = subprocess.Popen(
                ["npx.cmd" if sys.platform == "win32" else "npx", "next", "dev", "-H", "0.0.0.0", "-p", "3000"],
                cwd=frontend_dir,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            )
        processes.append(p_frontend)

    wait_for_service("http://127.0.0.1:8001/api/ml/health", timeout=15)
    wait_for_service("http://127.0.0.1:8000/health", timeout=15)
    wait_for_service("http://127.0.0.1:3000", timeout=25)

def cleanup():
    for p in processes:
        try:
            p.terminate()
            p.kill()
        except Exception:
            pass

def main():
    setup_embedded_environment()
    threading.Thread(target=start_background_services, daemon=True).start()
    wait_for_service("http://127.0.0.1:3000", timeout=30)

    window = webview.create_window(
        title="CRPF Mental Health & Wellbeing Platform",
        url="http://localhost:3000",
        width=1340, height=890,
        min_size=(1024, 700),
        resizable=True, fullscreen=False,
        confirm_close=False, text_select=True
    )
    try:
        webview.start(gui="edgechromium", debug=False)
    finally:
        cleanup()

if __name__ == "__main__":
    main()
