import matter from 'gray-matter';
import { GetStaticPaths, GetStaticProps } from 'next';
import ErrorPage from 'next/error';
import Head from 'next/head';
import { useRouter } from 'next/router';
import * as React from 'react';
import hydrate from 'next-mdx-remote/hydrate';
import renderToString from 'next-mdx-remote/render-to-string';
import s from 'components/markdown.module.css';
import { Banner } from 'components/Banner';
import { SidebarCategory } from 'components/SidebarCategory';
import { SidebarPost } from 'components/SidebarPost';
import { Toc } from 'components/Toc';
import { markdownToHtml, remarkPlugins } from 'lib/docs/markdown-to-html';
import {
  getCurrentTag,
  fetchRemoteDocsManifest,
  fetchLocalDocsManifest,
  getPaths,
  getRawFileFromLocal,
} from 'lib/docs/page';
import { findRouteByPath } from 'lib/docs/findRouteByPath';
import { addTagToSlug, getSlug, removeFromLast } from 'lib/docs/utils';
import { getRouteContext } from 'lib/get-route-context';
import { getRawFileFromRepo } from 'lib/github/raw';
import { RouteItem, Page } from 'lib/types';
import { SidebarHeading } from 'components/SidebarHeading';
import { Sidebar } from 'components/Sidebar';
import { SidebarMobile } from 'components/SidebarMobile';
import { Nav } from 'components/Nav';
import { Sticky } from 'components/Sticky';
import { useIsMobile } from 'components/useIsMobile';
import { Footer } from 'components/Footer';
import { Seo } from 'components/Seo';
import { DocsPageFooter } from 'components/DocsPageFooter';
import MDXComponents from 'components/MDXComponents';
import addRouterEvents from 'components/addRouterEvents';
import remarkHeadings from 'remark-autolink-headings';
import slug from 'remark-slug';
interface DocsProps {
  page: Page;
  routes: RouteItem[];
  route: RouteItem;
  mdxSource: string;
}

export default function Docs({
  mdxSource,
  page,
  routes,
  route: _route,
}: DocsProps) {
  const router = useRouter();
  const { asPath, isFallback, query } = router;
  const isMobile = useIsMobile();

  // @ts-ignore
  const { route, prevRoute, nextRoute } = getRouteContext(_route, routes);
  const title = route && `${page.title || route.title} | Formik`;
  const { tag } = getSlug(query as { slug: string[] });

  if (!route && !isFallback) {
    return <ErrorPage statusCode={404} />;
  }

  const content = hydrate(mdxSource, {
    components: MDXComponents,
  });
  React.useEffect(() => {
    const listeners: any[] = [];
    document.querySelectorAll('.docs a').forEach(node => {
      const href = node.getAttribute('href');
      // Exclude paths like #setup and hashes that have the same current path
      if (href && href[0] !== '#' && href.startsWith('/')) {
        // Handle any relative path
        router.prefetch(href);

        listeners.push(
          addRouterEvents(node, router, {
            href,
          })
        );
      }
    });
    return () => {
      listeners.forEach(cleanUpListener => cleanUpListener());
    };
  }, [router]);
  return (
    <>
      {tag && (
        <Head>
          <meta name="robots" content="noindex" />
        </Head>
      )}
      <div>
        <Banner />
        {isMobile ? (
          <Nav />
        ) : (
          <Sticky>
            <Nav />
          </Sticky>
        )}

        <>
          <Seo title={title || page.title} description={page.description} />
          <div className="block">
            <>
              <Sticky shadow>
                <SidebarMobile>
                  <SidebarRoutes isMobile={true} routes={routes} />
                </SidebarMobile>
              </Sticky>

              <div className="container mx-auto pb-12 pt-6 content">
                <div className="flex relative">
                  <Sidebar fixed>
                    <SidebarRoutes routes={routes} />
                  </Sidebar>

                  <div className={s['markdown'] + ' w-full docs'}>
                    <h1>{page.title}</h1>
                    {content}
                    <DocsPageFooter
                      href={route?.path || ''}
                      route={route!}
                      prevRoute={prevRoute}
                      nextRoute={nextRoute}
                    />
                  </div>
                  {!route?.path?.includes('example') ? (
                    <div
                      className="hidden xl:block ml-10 flex-shrink-0"
                      style={{ width: 200 }}
                    >
                      <div className="sticky top-24 ">
                        <h4 className="font-semibold uppercase text-sm mb-2 mt-2 text-gray-500">
                          On this page
                        </h4>
                        <Toc />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          </div>
        </>
      </div>
      <Footer />
      <style jsx>{`
        .docs {
          min-width: calc(100% - 300px - 1rem - 200px);
        }
      `}</style>
    </>
  );
}

function getCategoryPath(routes: RouteItem[]) {
  const route = routes.find(r => r.path);
  return route && removeFromLast(route.path!, '/');
}

function SidebarRoutes({
  isMobile,
  routes: currentRoutes,

  level = 1,
}: {
  isMobile?: boolean;
  routes: RouteItem[];

  level?: number;
}) {
  const { query } = useRouter();
  const { tag, slug } = getSlug(query as any);

  return (currentRoutes as RouteItem[]).map(
    ({ path, title, routes, heading, open }, idx) => {
      if (routes) {
        const pathname = getCategoryPath(routes);
        const selected = slug.startsWith(pathname as any);
        const opened = selected || isMobile ? false : open;

        if (heading) {
          return (
            <SidebarHeading key={`${pathname}-heading-${idx}`} title={title}>
              <SidebarRoutes
                isMobile={isMobile}
                routes={routes}
                level={level + 1}
              />
            </SidebarHeading>
          );
        }

        return (
          <SidebarCategory
            key={`${pathname}-category-${idx}`}
            isMobile={isMobile}
            level={level}
            title={title}
            selected={selected}
            opened={opened}
          >
            <SidebarRoutes
              isMobile={isMobile}
              routes={routes}
              level={level + 1}
            />
          </SidebarCategory>
        );
      }

      const href = '/docs/[...slug]';
      const pagePath = removeFromLast(path!, '.');
      const pathname = addTagToSlug(pagePath, tag);
      const selected = slug.startsWith(pagePath);
      const route = { href, path, title, pathname, selected };
      return (
        <SidebarPost
          key={title}
          isMobile={isMobile}
          level={level}
          route={route}
        />
      );
    }
  ) as any;
}

export const getStaticProps: GetStaticProps<any, { slug: string[] }> = async ({
  params,
}) => {
  // console.log('params', params);
  let { tag, slug } = getSlug(params || { slug: [] });
  const currentTag = await getCurrentTag(tag);
  // console.log('tag', tag);
  // console.log('slug', slug);
  // console.log('product', product);

  let manifest;
  if (tag) {
    console.log('remote');
    manifest = await fetchRemoteDocsManifest(tag);
  } else {
    console.log('local');
    manifest = await fetchLocalDocsManifest();
  }

  if (!manifest) {
    return { props: {} };
  }

  const route = manifest && findRouteByPath(slug, manifest.routes);

  if (!route) {
    return { props: {} };
  }

  let md;
  if (tag) {
    md = await getRawFileFromRepo(route.path!, currentTag);
  } else {
    md = await getRawFileFromLocal(route.path!);
  }

  const { content, data } = matter(md);
  const mdxSource = await renderToString(content, {
    components: MDXComponents,
    mdxOptions: {
      remarkPlugins,
    },
  });

  return {
    props: {
      route,
      routes: manifest.routes,
      mdxSource,
      page: {
        ...data,
      },
    },
  };
};

export const getStaticPaths: GetStaticPaths = async () => {
  const manifest = await fetchLocalDocsManifest();
  return {
    paths: getPaths([...manifest.routes]),
    fallback: 'blocking',
  };
};