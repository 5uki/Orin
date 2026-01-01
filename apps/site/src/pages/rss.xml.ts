import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  const sortedPosts = posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  const siteTitle = import.meta.env.PUBLIC_SITE_TITLE || 'Orin Blog';
  const siteDescription =
    import.meta.env.PUBLIC_SITE_DESCRIPTION || '分享技术、开发与生活的点滴思考。';
  const siteUrl =
    context.site?.toString() || import.meta.env.PUBLIC_SITE_URL || 'https://example.com';

  return rss({
    title: siteTitle,
    description: siteDescription,
    site: siteUrl,
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.summary || '',
      link: `/posts/${post.id}/`,
      categories: post.data.tags,
    })),
    customData: `<language>zh-cn</language>`,
  });
}
