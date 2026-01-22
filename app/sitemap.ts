import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  // 실제 배포된 본인의 도메인 주소로 바꾸세요
  const baseUrl = "https://lotto-good-place.winsam.xyz/";

  return [
    {
      url: baseUrl, // 메인 페이지 (지도)
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/ranking`, // 랭킹 페이지
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
