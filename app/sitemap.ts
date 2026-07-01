import type { MetadataRoute } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

const publicPages: MetadataRoute.Sitemap = [
  {
    url: SITE_URL,
    changeFrequency: "daily",
    priority: 1,
  },
  {
    url: `${SITE_URL}/ranking`,
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    url: `${SITE_URL}/last`,
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    url: `${SITE_URL}/board`,
    changeFrequency: "daily",
    priority: 0.7,
  },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const db = getAdminDb();
    const [notices, posts] = await Promise.all([
      db.collection("board_notices").orderBy("createdAt", "desc").limit(20).get(),
      db.collection("board_posts").orderBy("createdAt", "desc").limit(50).get(),
    ]);

    const entryPages: MetadataRoute.Sitemap = [
      ...notices.docs.map((document) => ({
        url: `${SITE_URL}/board/notice/${document.id}`,
        lastModified: document.data().updatedAt?.toDate?.(),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
      ...posts.docs.map((document) => ({
        url: `${SITE_URL}/board/post/${document.id}`,
        lastModified: document.data().updatedAt?.toDate?.(),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    ];

    return [...publicPages, ...entryPages];
  } catch (error) {
    console.error("Sitemap board entries error:", error);
    return publicPages;
  }
}
