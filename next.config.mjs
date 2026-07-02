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
            'res.cloudinary.com',
            'images.unsplash.com',
            'localhost',
            'via.placeholder.com',
            'app.thinkstack.ai',
            'upload.wikimedia.org',
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
        return [{
            source: '/(.*)',
            headers: [{
                key: 'Content-Security-Policy',
                value: [
                    "default-src 'self'",
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://ssl.google-analytics.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://app.thinkstack.ai https://api.thinkstack.ai",
                    "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://ssl.google-analytics.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://app.thinkstack.ai https://api.thinkstack.ai",
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://app.thinkstack.ai",
                    "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://app.thinkstack.ai",
                    "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.dev https://clerk-telemetry.com https://*.googletagmanager.com https://www.googletagmanager.com https://www.google-analytics.com https://accounts.google.com https://www.google.com https://www.google.com/recaptcha/ https://www.gstatic.com https://www.gstatic.com/recaptcha/ https://hcaptcha.com https://sentry.hcaptcha.com https://organic-hound-41949.upstash.io https://*.onrender.com https://bqitech-nonprod-1.onrender.com https://bqitech-staging.onrender.com https://bqitech-dev.onrender.com https://api.bqitech.com https://bqitech.com https://core.service.elfsight.com https://app.thinkstack.ai https://api.thinkstack.ai wss://api.thinkstack.ai",
                    "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
                    "img-src 'self' data: https://*",
                    "frame-src 'self' https://www.google.com https://maps.google.com https://app.thinkstack.ai https://api.thinkstack.ai",
                ].join('; ')
            }]
        }]
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

        // Add explicit module resolution for @ alias
        config.resolve.alias = {
            ...config.resolve.alias,
            '@': process.cwd(),
        };

        // Force case-sensitive module resolution (like Linux)
        config.resolve.plugins = config.resolve.plugins || [];

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
        return [{
            source: '/sitemap.xml',
            destination: '/api/sitemap',
        }, ]
    },
};

export default nextConfig;