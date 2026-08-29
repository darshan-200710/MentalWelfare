"""
======================================================================
     CRPF MENTAL WELFARE PLATFORM - ANDROID APK BUILDER
======================================================================
Builds the standalone Android Mobile APK package (.apk) from the native
Capacitor Android workspace.

Usage:
    py build_apk.py
"""

import os
import sys
import shutil
import subprocess

BANNER = r"""
======================================================================
            CRPF MENTAL HEALTH - ANDROID APK BUILD ENGINE
======================================================================
"""

def main():
    print(BANNER)
    base_dir = os.path.dirname(os.path.abspath(__file__))
    android_dir = os.path.join(base_dir, "frontend", "android")
    release_dir = os.path.join(base_dir, "release")
    os.makedirs(release_dir, exist_ok=True)

    if not os.path.exists(android_dir):
        print("[!] Error: Android directory not found. Please run 'npx cap add android' first.")
        sys.exit(1)

    print("[*] Syncing mobile web assets and plugins...")
    subprocess.run(["npx.cmd" if sys.platform == "win32" else "npx", "cap", "sync", "android"], cwd=os.path.join(base_dir, "frontend"))

    gradle_cmd = os.path.join(android_dir, "gradlew.bat" if sys.platform == "win32" else "gradlew")

    print("[*] Checking for Java / Android SDK build environment...")
    try:
        res = subprocess.run([gradle_cmd, "assembleDebug"], cwd=android_dir)
        if res.returncode == 0:
            apk_src = os.path.join(android_dir, "app", "build", "outputs", "apk", "debug", "app-debug.apk")
            if os.path.exists(apk_src):
                apk_dst = os.path.join(release_dir, "MentalWelfare.apk")
                shutil.copy(apk_src, apk_dst)
                print("\n" + "="*70)
                print(f"  [SUCCESS] Android APK generated: {apk_dst}")
                print("  You can now transfer this APK to any Android mobile phone and install!")
                print("="*70 + "\n")
                return
    except Exception as e:
        print(f"[*] Note: Local Java JDK/Android SDK not detected on this host: {e}")

    print("\n" + "="*70)
    print("  [INFO] ANDROID PROJECT READY & CONFIGURED!")
    print("  Location: frontend/android/")
    print("  App ID: in.gov.crpf.mentalwelfare")
    print("  Permissions: Internet, Audio Recording/Microphone, Network State")
    print("")
    print("  To compile into an APK file:")
    print("  Option A (Android Studio):")
    print("    Run: npx cap open android -> Click 'Build' -> 'Build Bundle(s) / APK(s)' -> 'Build APK'")
    print("  Option B (CLI with JDK/Android SDK):")
    print("    cd frontend/android && ./gradlew assembleDebug")
    print("  Option C (Mobile Browser PWA - Instant 1-Tap Install):")
    print("    Open the platform on mobile Chrome -> Tap 'Install App' or 'Add to Home screen'")
    print("="*70 + "\n")

if __name__ == "__main__":
    main()
