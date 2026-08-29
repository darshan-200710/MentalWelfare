import base64
import hashlib
import hmac
import secrets
import struct
import time
from app.core.security import hash_password, verify_password

def generate_totp_secret() -> str:
    """Generate a random Base32 encoded 20-byte secret."""
    secret_bytes = secrets.token_bytes(20)
    return base64.b32encode(secret_bytes).decode('utf-8')

def generate_totp_uri(secret: str, email: str, issuer: str = "MentalWelfare") -> str:
    """Generate the otpauth:// URI for setting up Authenticator apps (QR code data)."""
    return f"otpauth://totp/{issuer}:{email}?secret={secret}&issuer={issuer}"

def _get_hotp(secret_hex: str, intervals_no: int) -> int:
    """Generate HMAC-based One-Time Password."""
    key = base64.b32decode(secret_hex, casefold=True)
    msg = struct.pack(">Q", intervals_no)
    h = hmac.new(key, msg, hashlib.sha1).digest()
    o = h[19] & 15
    h_str = (struct.unpack(">I", h[o:o+4])[0] & 0x7fffffff) % 1000000
    return h_str

def verify_totp(secret: str, code: str, window: int = 1) -> bool:
    """
    Verify 6-digit TOTP code.
    window: Number of 30-second steps to allow for time drift (+/- window).
    """
    try:
        current_time = int(time.time())
        intervals_no = current_time // 30
        
        for i in range(-window, window + 1):
            expected = str(_get_hotp(secret, intervals_no + i)).zfill(6)
            if hmac.compare_digest(expected, code):
                return True
        return False
    except Exception:
        return False

def generate_recovery_codes(count: int = 8) -> List[str]:
    """Generate alphanumeric recovery codes."""
    codes = []
    for _ in range(count):
        # 8 chars, easy to read, grouped by 4 for visibility is nice, but simple alphanumeric here
        code = secrets.token_hex(4).upper()
        codes.append(code)
    return codes

def verify_recovery_code(code: str, hashed_codes: list[str]) -> tuple[bool, int]:
    """
    Verify a recovery code against a list of hashed codes.
    Returns (True, index_of_matched_code) if valid, else (False, -1).
    """
    for idx, h_code in enumerate(hashed_codes):
        if verify_password(code, h_code):
            return True, idx
    return False, -1

def hash_recovery_code(code: str) -> str:
    return hash_password(code)

