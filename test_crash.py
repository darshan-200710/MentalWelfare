import sys, os
try:
    with open("debug.log", "w") as f:
        f.write("Starting...\n")
        f.write(f"sys.argv: {sys.argv}\n")
        
        # Load environment first
        from desktop_app import setup_embedded_environment, get_resource_dir
        setup_embedded_environment()
        
        res_dir = get_resource_dir()
        ml_dir = os.path.join(res_dir, "ml-service")
        f.write(f"ml_dir: {ml_dir}\n")
        f.write(f"ml_dir exists: {os.path.exists(ml_dir)}\n")
        
        sys.path.insert(0, ml_dir)
        os.chdir(ml_dir)
        
        f.write("Importing uvicorn...\n")
        import uvicorn
        f.write("Uvicorn imported!\n")
        
        f.write("Importing app.main...\n")
        import app.main
        f.write("app.main imported!\n")
        
except Exception as e:
    import traceback
    with open("debug.log", "a") as f:
        f.write(traceback.format_exc())
