/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        domains: [
            'res.cloudinary.com',
            'images.unsplash.com',
            'localhost',
            'via.placeholder.com',
            'app.thinkstack.ai'
        ],
    },
    async headers() {
        return [{
            source: '/(.*)',
            headers: [{
                key: 'Content-Security-Policy',
                value: [
                    "default-src 'self'",
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://ssl.google-analytics.com https://app.thinkstack.ai https://api.thinkstack.ai",
                    "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://ssl.google-analytics.com https://app.thinkstack.ai https://api.thinkstack.ai",
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://app.thinkstack.ai",
                    "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://app.thinkstack.ai",
                    "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.dev https://clerk-telemetry.com https://*.googletagmanager.com https://www.googletagmanager.com https://www.google-analytics.com https://accounts.google.com https://hcaptcha.com https://sentry.hcaptcha.com https://organic-hound-41949.upstash.io https://bqitech-nonprod-1.onrender.com https://bqitech.com https://core.service.elfsight.com https://app.thinkstack.ai https://api.thinkstack.ai wss://api.thinkstack.ai",
                    "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
                    "img-src 'self' data: https://*",
                    "frame-src 'self' https://www.google.com https://maps.google.com https://app.thinkstack.ai https://api.thinkstack.ai",
                ].join('; ')
            }]
        }]
    }
};

export default nextConfig;