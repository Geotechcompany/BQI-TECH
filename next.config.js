// @ts-check
const withPWA = require("@ducanh2912/next-pwa").default;
const { pwaOptions } = require("./pwa.config.js");

/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        ignoreDuringBuilds: true,
    },
    poweredByHeader: false,
    compress: true,
    reactStrictMode: true,
    swcMinify: true,
    images: {
        unoptimized: true,
        domains: [
            'upload.wikimedia.org',
            'images.unsplash.com',
            'd1.awsstatic.com',
            'dl.dropboxusercontent.com',
            'bqitech.com',
            'cdn.pixabay.com',
            'img.freepik.com',
            'source.unsplash.com',
            'picsum.photos',
            'images.pexels.com'
        ],
        formats: ['image/webp', 'image/avif'],
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
        minimumCacheTTL: 60,
        dangerouslyAllowSVG: true,
        contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
        remotePatterns: [{
                protocol: 'https',
                hostname: '**.dropboxusercontent.com',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: '**.unsplash.com',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: '**.bqitech.com',
                port: '',
                pathname: '/**',
            }
        ]
    },
    async headers() {
        const cspDirectives = [
            `default-src 'self' https://app.thinkstack.ai`,
            `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.thinkstack.ai https://app.thinkstack.ai/bot/thinkstackai-loader.min.js`,
            `script-src-elem 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://static.elfsight.com https://app.thinkstack.ai https://app.thinkstack.ai/bot/thinkstackai-loader.min.js`,
            `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://app.thinkstack.ai`,
            `style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://app.thinkstack.ai`,
            `img-src 'self' data: blob: https://dl.dropboxusercontent.com https://images.unsplash.com https://app.thinkstack.ai`,
            `connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.dev https://clerk-telemetry.com https://*.googletagmanager.com https://www.googletagmanager.com https://www.google-analytics.com https://accounts.google.com https://www.google.com https://www.google.com/recaptcha/ https://www.gstatic.com https://www.gstatic.com/recaptcha/ https://hcaptcha.com https://sentry.hcaptcha.com https://organic-hound-41949.upstash.io https://*.onrender.com https://bqitech-nonprod-1.onrender.com https://bqitech-staging.onrender.com https://bqitech-dev.onrender.com https://api.bqitech.com https://bqitech.com https://core.service.elfsight.com https://app.thinkstack.ai https://api.thinkstack.ai wss://api.thinkstack.ai ${process.env.NODE_ENV === 'development' ? 'ws://localhost:3000/_next/webpack-hmr http://localhost:9000 http://localhost:10000 http://127.0.0.1:10000 http://localhost:9056 http://127.0.0.1:9056 http://api.bqitech.com' : ''}`,
            `frame-src 'self' blob: https://www.google.com https://maps.google.com https://www.google.com/recaptcha/ https://app.thinkstack.ai`,
            `font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com https://app.thinkstack.ai`,
            // Allow service worker / Workbox scripts for PWA
            `worker-src 'self' blob:`,
        ];

        const securityHeaders = [{
                key: 'Content-Security-Policy',
                value: cspDirectives.join('; ')
            },
            {
                key: 'X-Content-Type-Options',
                value: 'nosniff'
            }
        ];

        return [{
            source: '/:path*',
            headers: securityHeaders
        }];
    },
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                net: false,
                tls: false,
                dns: false,
                child_process: false,
            };
        }

        config.module.rules.push({
            test: /\.(mpwebm)$/,
            use: {
                loader: "file-loader",
                options: {
                    publicPath: "/_next/static/videos/",
                    outputPath: "static/videos/",
                    name: "[name].[hash].[ext]",
                },
            },
        });

        return config;
    },
    async redirects() {
        return [{
                source: '/manage',
                destination: '/manage/overview',
                permanent: true,
            },
            {
                source: '/dashboard',
                destination: '/dashboard/overview',
                permanent: true,
            },
            {
                source: '/manage/cv-vault',
                destination: '/manage/applicants',
                permanent: false,
            },
        ];
    },
    transpilePackages: ['@uiw/react-md-editor'],
    async rewrites() {
        return [{
            source: '/sitemap.xml',
            destination: '/api/sitemap',
        }, ]
    },
};

module.exports = withPWA(pwaOptions)(nextConfig);
