"""
======================================================================
     CRPF MENTAL WELFARE PLATFORM - CLOUD DATABASE SETUP (NEON DB)
======================================================================
This utility connects the platform to a free cloud PostgreSQL database
such as Neon DB (https://neon.tech), Supabase, or Render.

Usage:
    py setup_database.py --url "postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require"
    or interactive prompt:
    py setup_database.py
"""

import os
import sys
import argparse
import subprocess
import shutil

BANNER = r"""
======================================================================
        NEON SERVERLESS POSTGRESQL & CLOUD DATABASE MIGRATOR
======================================================================
"""

def main():
    print(BANNER)
    parser = argparse.ArgumentParser(description="Configure and migrate Neon DB / Cloud PostgreSQL database.")
    parser.add_argument("--url", type=str, help="PostgreSQL connection string (from Neon DB / Supabase)")
    args = parser.parse_args()

    db_url = args.url
    if not db_url:
        print("[?] Get your free PostgreSQL connection URI from: https://console.neon.tech")
        print("    Example: postgresql://alex:secret123@ep-cool-fog-123456.us-east-2.aws.neon.tech/neondb?sslmode=require\n")
        db_url = input("Enter your PostgreSQL / Neon DB URL: ").strip()

    if not db_url or not db_url.startswith(("postgres://", "postgresql://")):
        print("[!] Error: Invalid PostgreSQL connection URI. Must start with 'postgresql://' or 'postgres://'")
        sys.exit(1)

    # Normalize postgres:// to postgresql:// for Prisma and SQLAlchemy compatibility
    if db_url.startswith("postgres://"):
        db_url = "postgresql://" + db_url[len("postgres://"):]

    print(f"\n[*] Target Cloud Database: {db_url.split('@')[-1] if '@' in db_url else db_url}")

    base_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(base_dir, "frontend")
    prisma_schema = os.path.join(frontend_dir, "prisma", "schema.postgresql.prisma")

    # 1. Update .env files
    env_frontend = os.path.join(frontend_dir, ".env")
    env_backend = os.path.join(base_dir, "backend", ".env")
    env_root = os.path.join(base_dir, ".env")

    print("[*] Updating environment configuration files with Neon DB URI...")
    for env_file in [env_frontend, env_backend, env_root]:
        lines = []
        if os.path.exists(env_file):
            with open(env_file, "r", encoding="utf-8") as f:
                lines = f.readlines()
        
        # Replace or append DATABASE_URL and BACKEND_DATABASE_URL
        new_lines = []
        has_db_url = False
        has_backend_url = False
        for line in lines:
            if line.startswith("DATABASE_URL="):
                new_lines.append(f"DATABASE_URL=\"{db_url}\"\n")
                has_db_url = True
            elif line.startswith("BACKEND_DATABASE_URL="):
                new_lines.append(f"BACKEND_DATABASE_URL=\"{db_url}\"\n")
                has_backend_url = True
            else:
                new_lines.append(line)

        if not has_db_url:
            new_lines.append(f"DATABASE_URL=\"{db_url}\"\n")
        if not has_backend_url:
            new_lines.append(f"BACKEND_DATABASE_URL=\"{db_url}\"\n")

        with open(env_file, "w", encoding="utf-8") as f:
            f.writelines(new_lines)

    # 2. Run Prisma db push to generate tables in Neon DB
    print("[*] Deploying relational schema and tables to Neon DB...")
    env_vars = os.environ.copy()
    env_vars["DATABASE_URL"] = db_url

    cmd = ["npx.cmd" if sys.platform == "win32" else "npx", "prisma", "db", "push", f"--schema={prisma_schema}", "--accept-data-loss"]
    res = subprocess.run(cmd, cwd=frontend_dir, env=env_vars)
    if res.returncode != 0:
        print("[!] Failed to push schema to Neon DB. Check your connection URL and internet connectivity.")
        sys.exit(res.returncode)

    # 3. Generate Prisma Client
    print("[*] Generating Prisma Client bindings...")
    cmd_gen = ["npx.cmd" if sys.platform == "win32" else "npx", "prisma", "generate", f"--schema={prisma_schema}"]
    subprocess.run(cmd_gen, cwd=frontend_dir, env=env_vars)

    # 4. Copy schema.postgresql.prisma to schema.prisma
    shutil.copy(prisma_schema, os.path.join(frontend_dir, "prisma", "schema.prisma"))

    print("\n" + "="*70)
    print("  ✨ SUCCESS! Your platform is now connected to Neon PostgreSQL DB!")
    print("  All tables, security constraints, and scrypt chat fields are live.")
    print("  You can now start the platform with: MentalWelfare.exe or npm run dev")
    print("="*70 + "\n")

if __name__ == "__main__":
    main()
