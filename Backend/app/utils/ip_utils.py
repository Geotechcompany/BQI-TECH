"""
IP Address utilities for accurate client IP detection
Handles various proxy scenarios and forwarded headers
"""
import ipaddress
from typing import Optional
from fastapi import Request


def get_real_client_ip(request: Request) -> Optional[str]:
    """
    Extract the real client IP address from request headers.
    Handles various proxy scenarios including:
    - X-Forwarded-For (most common)
    - X-Real-IP (nginx)
    - CF-Connecting-IP (Cloudflare)
    - X-Client-IP (some proxies)
    - X-Forwarded (RFC 7239)
    - Forwarded (RFC 7239)
    
    Args:
        request: FastAPI Request object
        
    Returns:
        str: Real client IP address or None if not found
    """
    # List of headers to check in order of preference
    ip_headers = [
        'x-forwarded-for',
        'x-real-ip', 
        'cf-connecting-ip',  # Cloudflare
        'x-client-ip',
        'x-forwarded',
        'forwarded',
        'x-cluster-client-ip',
        'x-original-forwarded-for'
    ]
    
    # Check each header
    for header in ip_headers:
        ip_value = request.headers.get(header)
        if ip_value:
            # X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2, ...)
            # The first IP is usually the original client
            if header == 'x-forwarded-for':
                # Split by comma and take the first IP
                ips = [ip.strip() for ip in ip_value.split(',')]
                for ip in ips:
                    if is_valid_ip(ip):
                        return ip
            else:
                # For other headers, use the value directly
                if is_valid_ip(ip_value):
                    return ip_value
    
    # Fallback to direct connection IP
    if request.client and request.client.host:
        return request.client.host
    
    return None


def is_valid_ip(ip: str) -> bool:
    """
    Check if the given string is a valid IP address.
    
    Args:
        ip: IP address string to validate
        
    Returns:
        bool: True if valid IP, False otherwise
    """
    if not ip or not isinstance(ip, str):
        return False
    
    # Remove any whitespace
    ip = ip.strip()
    
    # Skip if empty or contains non-IP characters
    if not ip or ' ' in ip:
        return False
    
    try:
        # Try to parse as IP address
        ipaddress.ip_address(ip)
        return True
    except ValueError:
        return False


def is_private_ip(ip: str) -> bool:
    """
    Check if the given IP is a private/internal IP address.
    
    Args:
        ip: IP address string
        
    Returns:
        bool: True if private IP, False otherwise
    """
    if not is_valid_ip(ip):
        return False
    
    try:
        ip_obj = ipaddress.ip_address(ip)
        return ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local
    except ValueError:
        return False


def get_client_ip_with_metadata(request: Request) -> dict:
    """
    Get client IP with additional metadata for logging.
    
    Args:
        request: FastAPI Request object
        
    Returns:
        dict: Client IP information with metadata
    """
    real_ip = get_real_client_ip(request)
    direct_ip = request.client.host if request.client else None
    
    return {
        'real_ip': real_ip,
        'direct_ip': direct_ip,
        'is_private': is_private_ip(real_ip) if real_ip else None,
        'user_agent': request.headers.get('user-agent'),
        'forwarded_headers': {
            'x-forwarded-for': request.headers.get('x-forwarded-for'),
            'x-real-ip': request.headers.get('x-real-ip'),
            'cf-connecting-ip': request.headers.get('cf-connecting-ip'),
            'x-client-ip': request.headers.get('x-client-ip'),
        }
    }
