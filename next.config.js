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
        domains: [
            'upload.wikimedia.org',
            'images.unsplash.com',
            'd1.awsstatic.com',
            'dl.dropboxusercontent.com',
            'bqitech.com',
            'https://bqitech.com',
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
        const isProduction = process.env.NODE_ENV === 'production';

        const cspDirectives = [
            `default-src 'self' https://app.thinkstack.ai`,
            `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.thinkstack.ai https://app.thinkstack.ai/bot/thinkstackai-loader.min.js`,
            `script-src-elem 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://static.elfsight.com https://app.thinkstack.ai https://app.thinkstack.ai/bot/thinkstackai-loader.min.js`,
            `style-src 'self' 'unsafe-inline' https://app.thinkstack.ai`,
            `img-src 'self' data: blob: https://dl.dropboxusercontent.com https://images.unsplash.com https://app.thinkstack.ai`,
            `connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.dev https://clerk-telemetry.com https://*.googletagmanager.com https://www.googletagmanager.com https://www.google-analytics.com https://accounts.google.com https://hcaptcha.com https://sentry.hcaptcha.com https://organic-hound-41949.upstash.io https://bqitech-nonprod-1.onrender.com https://bqitech.com https://core.service.elfsight.com https://app.thinkstack.ai https://app.thinkstack.ai/bot/thinkstackai-loader.min.js ${process.env.NODE_ENV === 'development' ? 'ws://localhost:3000/_next/webpack-hmr http://localhost:9000' : ''};`,
            `frame-src 'self' https://www.google.com https://maps.google.com https://www.google.com/recaptcha/ https://app.thinkstack.ai`,
            `font-src 'self' data: https://app.thinkstack.ai`
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
                source: '/admin',
                destination: '/admin/overview',
                permanent: true,
            },
            {
                source: '/dashboard',
                destination: '/dashboard/overview',
                permanent: true,
            }
        ];
    },
    transpilePackages: ['@uiw/react-md-editor', 'react-beautiful-dnd'],
    async rewrites() {
        return [
            {
                source: '/sitemap.xml',
                destination: '/api/sitemap',
            },
        ]
    },
    output: 'standalone',
};

module.exports = nextConfig;
