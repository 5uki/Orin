# Orin Blog Platform

A modern, full-stack blog platform built with TypeScript, featuring a content-focused public site, comprehensive admin dashboard, and serverless API layer. Designed for optimal performance, SEO, and developer experience while maximizing Cloudflare's generous free tier offerings.

## 🚀 Features

- **Public Blog Site**: Lightning-fast Astro-powered blog with MDX content support
- **Admin Dashboard**: React-based management interface for content and users
- **Comment System**: Built-in commenting with AI-powered moderation
- **User Management**: Authentication and role-based access control
- **SEO Optimized**: Automatic sitemap generation, RSS feeds, and meta optimization
- **Edge Deployment**: Serverless architecture on Cloudflare's global network
- **Cost-Effective**: Built to maximize Cloudflare's generous free tier limits

## 🏗️ Architecture

### Monorepo Structure

```
├── apps/                  # Frontend applications
│   ├── admin/             # Admin dashboard (React + Vite)
│   └── site/              # Public blog site (Astro)
├── functions/             # Backend API (Cloudflare Workers + Hono)
├── packages/              # Shared utilities and types
│   └── shared/            # Common types and validators
├── content/               # Blog content (MDX files)
└── scripts/               # Build and deployment scripts
```

### Technology Stack

**Frontend**
- **Admin**: React 19 + TypeScript + Vite + React Router DOM v7
- **Site**: Astro v5 + React integration + MDX

**Backend**
- **Runtime**: Cloudflare Workers (100,000 requests/day free)
- **Framework**: Hono for HTTP routing
- **Database**: Cloudflare D1 (5GB storage free)
- **AI**: Cloudflare Workers AI for content moderation (10,000 requests/day free)
- **CDN**: Cloudflare Pages (unlimited bandwidth on free tier)

**Development Tools**
- **Package Manager**: pnpm (>=8.0.0)
- **Language**: TypeScript
- **Linting**: ESLint
- **Formatting**: Prettier
- **Testing**: Vitest

## 🤝 Contributing

1. Follow the established file naming conventions
2. Use TypeScript for all new code
3. Add tests for new functionality
4. Run `pnpm lint` and `pnpm format` before committing
5. Update documentation for significant changes

## 📄 License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.
