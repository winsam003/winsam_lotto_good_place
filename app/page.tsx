"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  orderBy,
} from "firebase/firestore";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Flame,
  LoaderCircle,
  MapPin,
  MapPinned,
  Search,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";

interface KakaoLatLng {
  getLat: () => number;
  getLng: () => number;
}

interface KakaoBounds {
  getSouthWest: () => KakaoLatLng;
  getNorthEast: () => KakaoLatLng;
}

interface KakaoMap {
  getBounds: () => KakaoBounds;
  getCenter: () => KakaoLatLng;
  getLevel: () => number;
  setCenter: (position: KakaoLatLng) => void;
  panTo: (position: KakaoLatLng) => void;
  setLevel: (level: number) => void;
}

interface KakaoMarker {
  setMap: (map: KakaoMap | null) => void;
}

interface KakaoInfoWindow {
  open: (map: KakaoMap, marker: KakaoMarker) => void;
}

interface KakaoSearchResult {
  x: string;
  y: string;
}

interface KakaoMapsApi {
  load: (callback: () => void) => void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMap;
  Marker: new (options: {
    map: KakaoMap;
    position: KakaoLatLng;
  }) => KakaoMarker;
  InfoWindow: new (options: {
    content: string;
    removable: boolean;
  }) => KakaoInfoWindow;
  services: {
    Status: { OK: string };
    Geocoder: new () => {
      addressSearch: (
        keyword: string,
        callback: (results: KakaoSearchResult[], status: string) => void,
      ) => void;
    };
    Places: new () => {
      keywordSearch: (
        keyword: string,
        callback: (results: KakaoSearchResult[], status: string) => void,
      ) => void;
    };
  };
  event: {
    addListener: (
      target: KakaoMap | KakaoMarker,
      eventName: string,
      callback: () => void,
    ) => void;
  };
}

declare global {
  interface Window {
    kakao: { maps: KakaoMapsApi };
  }
}

interface LottoStore {
  id: string;
  shopName: string;
  address: string;
  lat: number;
  lng: number;
  firstPrizeCount?: number;
  secondPrizeCount?: number;
  lastUpdatedDraw?: number;
}

interface FirestoreQueryError {
  code?: string;
}

interface MapBoundsSnapshot {
  south: number;
  north: number;
  west: number;
  east: number;
}

interface StoreCacheEntry {
  bounds: MapBoundsSnapshot;
  stores: LottoStore[];
  cachedAt: number;
}

type SearchSource = "current" | "place" | "area";

interface SearchOrigin {
  lat: number;
  lng: number;
  source: SearchSource;
}

type LocationAccess = "checking" | "granted" | "prompt" | "denied";

const MAX_VISIBLE_STORES = 300;
const STORE_CACHE_KEY = "lotto-map-store-cache-v1";
const STORE_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_STORE_CACHE_ENTRIES = 8;

const isStoreInBounds = (store: LottoStore, bounds: MapBoundsSnapshot) =>
  store.lat >= bounds.south &&
  store.lat <= bounds.north &&
  store.lng >= bounds.west &&
  store.lng <= bounds.east;

const cacheCoversBounds = (
  cacheBounds: MapBoundsSnapshot,
  requestedBounds: MapBoundsSnapshot,
) => {
  const epsilon = 0.00001;
  return (
    cacheBounds.south <= requestedBounds.south + epsilon &&
    cacheBounds.north >= requestedBounds.north - epsilon &&
    cacheBounds.west <= requestedBounds.west + epsilon &&
    cacheBounds.east >= requestedBounds.east - epsilon
  );
};

const loadStoreCache = () => {
  try {
    const cached = window.localStorage.getItem(STORE_CACHE_KEY);
    if (!cached) return [];

    const now = Date.now();
    return (JSON.parse(cached) as StoreCacheEntry[]).filter(
      (entry) => now - entry.cachedAt < STORE_CACHE_TTL_MS,
    );
  } catch {
    return [];
  }
};

const saveStoreCache = (entries: StoreCacheEntry[]) => {
  try {
    window.localStorage.setItem(STORE_CACHE_KEY, JSON.stringify(entries));
  } catch {
    // 저장 공간이 부족하거나 브라우저가 저장소를 차단해도 검색은 계속 동작한다.
  }
};

const getDistanceSquared = (
  store: LottoStore,
  centerLat: number,
  centerLng: number,
) => {
  const latDiff = store.lat - centerLat;
  const lngDiff = (store.lng - centerLng) * Math.cos((centerLat * Math.PI) / 180);
  return latDiff * latDiff + lngDiff * lngDiff;
};

const getDistanceMeters = (
  firstLat: number,
  firstLng: number,
  secondLat: number,
  secondLng: number,
) => {
  const earthRadius = 6371000;
  const toRadians = (degree: number) => (degree * Math.PI) / 180;
  const latDelta = toRadians(secondLat - firstLat);
  const lngDelta = toRadians(secondLng - firstLng);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(firstLat)) *
      Math.cos(toRadians(secondLat)) *
      Math.sin(lngDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (distance: number) =>
  distance < 1000
    ? `${Math.max(10, Math.round(distance / 10) * 10)}m`
    : `${(distance / 1000).toFixed(distance < 10000 ? 1 : 0)}km`;

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );

export default function LottoMapPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [map, setMap] = useState<KakaoMap | null>(null);
  const [stores, setStores] = useState<LottoStore[]>([]);
  const [isZoomTooFar, setIsZoomTooFar] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchAddress, setSearchAddress] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [latestDrawNo, setLatestDrawNo] = useState<number | null>(null);
  const [isResultLimited, setIsResultLimited] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [locationAccess, setLocationAccess] =
    useState<LocationAccess>("checking");
  const [searchOrigin, setSearchOrigin] = useState<SearchOrigin | null>(null);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(true);

  const mapRef = useRef<KakaoMap | null>(null);
  const latestDrawNoRef = useRef<number | null>(null);
  const markersMapRef = useRef<Map<string, KakaoMarker>>(new Map());
  const searchRequestIdRef = useRef(0);
  const geoIndexUnavailableRef = useRef(false);
  const didHandleInitialLocationRef = useRef(false);
  const autoSearchTimerRef = useRef<number | null>(null);
  const storeCacheRef = useRef<StoreCacheEntry[] | null>(null);
  const searchSourceRef = useRef<SearchSource>("area");

  const clearSearchResults = useCallback(() => {
    if (autoSearchTimerRef.current !== null) {
      window.clearTimeout(autoSearchTimerRef.current);
      autoSearchTimerRef.current = null;
    }
    searchRequestIdRef.current += 1;
    markersMapRef.current.forEach((marker) => marker.setMap(null));
    markersMapRef.current.clear();
    setStores([]);
    setHasSearched(false);
    setIsResultLimited(false);
    setSearchError("");
    setIsLoading(false);
  }, []);

  const handleSearchStores = useCallback(async (targetMap?: KakaoMap) => {
    const currentMap = targetMap ?? mapRef.current;
    if (!currentMap || currentMap.getLevel() > 5) return;

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    setIsLoading(true);
    setHasSearched(true);
    setSearchError("");

    markersMapRef.current.forEach((marker) => marker.setMap(null));
    markersMapRef.current.clear();
    setStores([]);

    const bounds = currentMap.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const center = currentMap.getCenter();
    const currentSearchOrigin: SearchOrigin = {
      lat: center.getLat(),
      lng: center.getLng(),
      source: searchSourceRef.current,
    };
    setSearchOrigin(currentSearchOrigin);
    const requestedBounds: MapBoundsSnapshot = {
      south: sw.getLat(),
      north: ne.getLat(),
      west: sw.getLng(),
      east: ne.getLng(),
    };
    const lottoCol = collection(db, "lotto_stores");

    try {
      if (storeCacheRef.current === null) {
        storeCacheRef.current = loadStoreCache();
      }

      const now = Date.now();
      storeCacheRef.current = storeCacheRef.current.filter(
        (entry) => now - entry.cachedAt < STORE_CACHE_TTL_MS,
      );
      const cachedEntry = storeCacheRef.current.find((entry) =>
        cacheCoversBounds(entry.bounds, requestedBounds),
      );

      let storesInBounds: LottoStore[];

      if (cachedEntry) {
        storesInBounds = cachedEntry.stores.filter((store) =>
          isStoreInBounds(store, requestedBounds),
        );
      } else {
        let documents;

        if (!geoIndexUnavailableRef.current) {
          try {
            const boundsQuery = query(
              lottoCol,
              where("lat", ">=", requestedBounds.south),
              where("lat", "<=", requestedBounds.north),
              where("lng", ">=", requestedBounds.west),
              where("lng", "<=", requestedBounds.east),
            );
            documents = (await getDocs(boundsQuery)).docs;
          } catch (error) {
            if ((error as FirestoreQueryError).code !== "failed-precondition") {
              throw error;
            }
            geoIndexUnavailableRef.current = true;
          }
        }

        if (!documents) {
          const latitudeQuery = query(
            lottoCol,
            where("lat", ">=", requestedBounds.south),
            where("lat", "<=", requestedBounds.north),
            orderBy("lat", "asc"),
          );
          const latitudeSnap = await getDocs(latitudeQuery);
          documents = latitudeSnap.docs.filter((document) => {
            const longitude = document.data().lng;
            return (
              longitude >= requestedBounds.west &&
              longitude <= requestedBounds.east
            );
          });
        }

        storesInBounds = documents.map((document) => {
          const data = document.data();
          return {
            id: document.id,
            ...data,
            shopName: data.shopName ?? "이름 없는 판매점",
            address: data.address ?? "주소 정보 없음",
          } as LottoStore;
        });

        storeCacheRef.current = [
          {
            bounds: requestedBounds,
            stores: storesInBounds,
            cachedAt: now,
          },
          ...storeCacheRef.current,
        ].slice(0, MAX_STORE_CACHE_ENTRIES);
        saveStoreCache(storeCacheRef.current);
      }

      if (requestId !== searchRequestIdRef.current) return;

      const nearestStores = storesInBounds
        .sort(
          (a, b) =>
            getDistanceSquared(a, center.getLat(), center.getLng()) -
            getDistanceSquared(b, center.getLat(), center.getLng()),
        )
        .slice(0, MAX_VISIBLE_STORES);
      const sortedStores = [...nearestStores].sort(
        (a, b) =>
          (b.firstPrizeCount ?? 0) - (a.firstPrizeCount ?? 0) ||
          (b.secondPrizeCount ?? 0) - (a.secondPrizeCount ?? 0) ||
          getDistanceSquared(a, center.getLat(), center.getLng()) -
            getDistanceSquared(b, center.getLat(), center.getLng()),
      );

      setIsResultLimited(storesInBounds.length > MAX_VISIBLE_STORES);

      const { kakao } = window;
      sortedStores.forEach((store) => {
        const isRecent =
          latestDrawNoRef.current !== null &&
          (store.lastUpdatedDraw ?? 0) > latestDrawNoRef.current - 100;
        const marker = new kakao.maps.Marker({
          map: currentMap,
          position: new kakao.maps.LatLng(store.lat, store.lng),
        });
        const infowindow = new kakao.maps.InfoWindow({
          content: `<div style="padding:10px; color:black; font-size:12px; width:160px; line-height:1.4;">
            <div style="font-weight:bold; margin-bottom:4px; border-bottom:1px solid #eee; padding-bottom:4px;">${escapeHtml(store.shopName)}</div>
            ${isRecent ? `<div style="color:#f59e0b; font-weight:bold; font-size:10px; margin-bottom:4px;">🔥 최근 100회 이내 당첨된 명당!</div>` : ""}
            <div style="color:#e11d48; font-weight:bold;">1등: ${store.firstPrizeCount ?? 0}회</div>
            <div style="color:#2563eb; font-weight:bold;">2등: ${store.secondPrizeCount ?? 0}회</div>
          </div>`,
          removable: true,
        });

        kakao.maps.event.addListener(marker, "click", () => {
          infowindow.open(currentMap, marker);
        });
        markersMapRef.current.set(store.id, marker);
      });

      setStores(sortedStores);
    } catch (error) {
      console.error("데이터 로드 중 오류 발생:", error);
      if (requestId === searchRequestIdRef.current) {
        setSearchError("명당 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      if (requestId === searchRequestIdRef.current) setIsLoading(false);
    }
  }, []);

  const moveToAndSearch = useCallback(
    (lat: number, lng: number, source: SearchSource = "place") => {
      const currentMap = mapRef.current;
      if (!currentMap) return;

      clearSearchResults();
      searchSourceRef.current = source;
      const coords = new window.kakao.maps.LatLng(lat, lng);
      currentMap.setLevel(source === "current" ? 5 : 3);
      currentMap.setCenter(coords);
      autoSearchTimerRef.current = window.setTimeout(() => {
        autoSearchTimerRef.current = null;
        void handleSearchStores(currentMap);
      }, 200);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    },
    [clearSearchResults, handleSearchStores],
  );

  const requestCurrentLocation = useCallback(() => {
    if (!mapRef.current || !navigator.geolocation) {
      setLocationAccess("denied");
      return;
    }

    setLocationAccess("checking");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationAccess("granted");
        moveToAndSearch(
          position.coords.latitude,
          position.coords.longitude,
          "current",
        );
      },
      () => setLocationAccess("denied"),
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 },
    );
  }, [moveToAndSearch]);

  const searchLocation = () => {
    if (!mapRef.current || !searchAddress.trim()) return;
    const { kakao } = window;
    const keyword = searchAddress.trim();
    const geocoder = new kakao.maps.services.Geocoder();

    const applySearchResult = (result: KakaoSearchResult[]) => {
      if (!result[0]) return false;
      moveToAndSearch(Number(result[0].y), Number(result[0].x), "place");
      return true;
    };

    geocoder.addressSearch(keyword, (addressResults, addressStatus) => {
      if (
        addressStatus === kakao.maps.services.Status.OK &&
        applySearchResult(addressResults)
      ) {
        return;
      }

      const places = new kakao.maps.services.Places();
      places.keywordSearch(keyword, (placeResults, placeStatus) => {
        if (
          placeStatus === kakao.maps.services.Status.OK &&
          applySearchResult(placeResults)
        ) {
          return;
        }
        alert("주소나 장소를 찾을 수 없습니다.");
      });
    });
  };

  useEffect(() => {
    const { kakao } = window;
    if (kakao) {
      kakao.maps.load(() => {
        const container = document.getElementById("map");
        if (!container) return;
        const options = {
          center: new kakao.maps.LatLng(37.4449, 127.1389),
          level: 3,
        };
        const newMap = new kakao.maps.Map(container, options);
        mapRef.current = newMap;
        setMap(newMap);

        const checkZoomLevel = () => {
          setIsZoomTooFar(newMap.getLevel() > 5);
        };

        checkZoomLevel();
        kakao.maps.event.addListener(newMap, "zoom_changed", () => {
          checkZoomLevel();
        });
        kakao.maps.event.addListener(newMap, "idle", checkZoomLevel);

        if (window.innerWidth < 768) setIsSidebarOpen(false);
      });
    }
  }, [clearSearchResults]);

  useEffect(() => {
    const fetchLatestDraw = async () => {
      try {
        const latestQuery = query(
          collection(db, "lotto_winners"),
          orderBy("drawNo", "desc"),
          limit(1),
        );
        const latestSnap = await getDocs(latestQuery);
        if (!latestSnap.empty) {
          const drawNo = latestSnap.docs[0].data().drawNo as number;
          latestDrawNoRef.current = drawNo;
          setLatestDrawNo(drawNo);
        }
      } catch (error) {
        console.error("최신 회차 로드 실패:", error);
      }
    };

    void fetchLatestDraw();
  }, []);

  useEffect(() => {
    if (!map || didHandleInitialLocationRef.current) return;
    didHandleInitialLocationRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat && lng) {
      moveToAndSearch(lat, lng, "place");
      return;
    }

    if (!navigator.permissions) {
      setLocationAccess("prompt");
      return;
    }

    void navigator.permissions
      .query({ name: "geolocation" })
      .then((permission) => {
        if (permission.state === "granted") {
          requestCurrentLocation();
        } else {
          setLocationAccess(permission.state);
        }
      })
      .catch(() => setLocationAccess("prompt"));
  }, [map, moveToAndSearch, requestCurrentLocation]);

  const featuredStore = stores[0];
  const featuredDistance =
    featuredStore && searchOrigin
      ? getDistanceMeters(
          searchOrigin.lat,
          searchOrigin.lng,
          featuredStore.lat,
          featuredStore.lng,
        )
      : null;

  return (
    <main className="relative flex h-screen w-full overflow-hidden bg-[#edf0f7] font-sans text-[#172033]">
      <aside
        className={`absolute md:relative z-40 flex h-full max-w-[88vw] flex-col overflow-hidden border-r border-white/80 bg-[#f8f9fc]/95 shadow-[20px_0_60px_rgba(30,41,75,0.16)] backdrop-blur-xl transition-all duration-300 ${isSidebarOpen ? "w-[360px] md:w-[390px]" : "w-0"
          }`}
      >
        <div className={`flex h-full min-w-[min(88vw,360px)] flex-col md:min-w-[390px] ${!isSidebarOpen && "hidden"}`}>
          <header className="shrink-0 border-b border-[#e7e9f1] px-5 pb-5 pt-6">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#4f46e5] text-white shadow-[0_10px_24px_rgba(79,70,229,0.28)]">
                <Sparkles size={21} strokeWidth={2.4} />
              </div>
              <div>
                <p className="eyebrow">Lotto place finder</p>
                <h1 className="mt-0.5 text-xl font-extrabold tracking-[-0.04em] text-[#172033]">
                  로또 명당 지도
                </h1>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-2xl border border-[#e6e8f1] bg-white px-4 py-3 shadow-sm">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9199aa]">
                  Search result
                </p>
                <p className="mt-0.5 text-sm font-bold text-[#30394e]">
                  조회된 판매점
                </p>
              </div>
              <div className="rounded-xl bg-[#eef0ff] px-3 py-1.5 text-sm font-black text-[#4f46e5]">
                {stores.length}곳
              </div>
            </div>
          </header>
          <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-3">
              {stores.length > 0
                ? stores.map((store) => {
                  const isRecent =
                    latestDrawNo !== null &&
                    (store.lastUpdatedDraw ?? 0) > latestDrawNo - 100;
                  return (
                    <div
                      key={store.id}
                      className={`lift-card group cursor-pointer rounded-2xl border p-4 active:scale-[0.99] ${isRecent
                        ? "border-[#f2d6a4] bg-[#fffaf0]"
                        : "border-[#e6e8f0] bg-white"
                      }`}
                      onClick={() => {
                        map?.panTo(
                          new window.kakao.maps.LatLng(store.lat, store.lng),
                        );
                        if (window.innerWidth < 768) setIsSidebarOpen(false);
                      }}
                    >
                      {/* 최근 당첨 태그 추가 */}
                      {isRecent && (
                        <div className="mb-3 flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#fff0d5] px-2.5 py-1 text-[9px] font-extrabold text-[#b76a13]">
                            <Flame size={10} fill="currentColor" /> 최근 100회 이내 당첨
                          </span>
                        </div>
                      )}

                      <div className="mb-3.5">
                        <div className="truncate text-[15px] font-extrabold tracking-[-0.02em] text-[#263047] transition-colors group-hover:text-[#4f46e5]">
                          {store.shopName}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1 truncate text-[10px] font-medium text-[#939bad]">
                          <MapPin size={11} className="shrink-0" /> {store.address}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-[#fff1ef] px-3 py-2.5">
                          <span className="block text-[9px] font-extrabold text-[#d96b5a]">1등 배출</span>
                          <span className="mt-0.5 block text-base font-black text-[#e45945]">{store.firstPrizeCount || 0}회</span>
                        </div>
                        <div className="rounded-xl bg-[#eef4ff] px-3 py-2.5">
                          <span className="block text-[9px] font-extrabold text-[#6480b9]">2등 배출</span>
                          <span className="mt-0.5 block text-base font-black text-[#466fbd]">{store.secondPrizeCount || 0}회</span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between px-0.5">
                        <span className="text-[9px] font-bold text-[#a0a7b6]">
                          최근 {store.lastUpdatedDraw}회 당첨
                        </span>
                        <span className="text-[10px] font-extrabold text-[#5b56d8]">
                          지도에서 보기 →
                        </span>
                      </div>
                    </div>
                  );
                })
                : searchError && !isLoading ? (
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-14 text-center text-sm font-bold text-red-500">
                    {searchError}
                  </div>
                )
                : hasSearched && !isLoading && (
                  <div className="rounded-2xl border border-dashed border-[#d8dbe7] bg-white/70 px-5 py-14 text-center">
                    <MapPinned className="mx-auto mb-3 text-[#a7adbc]" size={24} />
                    <p className="text-sm font-bold text-[#68738a]">이 지역에는 등록된 명당이 없습니다.</p>
                    <p className="mt-1 text-[11px] text-[#a0a7b6]">지도를 조금 옮겨 다시 찾아보세요.</p>
                  </div>
                )}
            </div>
            {isResultLimited && (
              <p className="sticky bottom-0 mt-3 rounded-xl border border-[#dfe2fb] bg-[#f0f1ff]/95 p-3 text-center text-[10px] font-bold text-[#5550c5] backdrop-blur">
                화면 중심에서 가까운 {MAX_VISIBLE_STORES}곳만 표시합니다.
                지도를 더 확대하면 정확한 결과를 볼 수 있습니다.
              </p>
            )}
          </div>
        </div>
      </aside>

      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        aria-label={isSidebarOpen ? "검색 결과 닫기" : "검색 결과 열기"}
        className="absolute left-0 top-1/2 z-50 flex size-10 -translate-y-1/2 items-center justify-center rounded-r-xl border border-l-0 border-white/80 bg-white/95 text-[#525c72] shadow-[8px_8px_24px_rgba(32,42,74,0.18)] backdrop-blur transition hover:text-[#4f46e5]"
        style={{
          left: isSidebarOpen
            ? typeof window !== "undefined" && window.innerWidth < 768
              ? "min(88vw, 360px)"
              : "390px"
            : "0",
        }}
      >
        {isSidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>

      <section className="relative flex-1 h-full">
        <div id="map" className="w-full h-full" />

        {isSpotlightOpen && featuredStore && featuredDistance !== null && (
          <div className="glass-panel absolute bottom-4 left-1/2 z-30 w-[calc(100%-24px)] max-w-[370px] -translate-x-1/2 animate-enter rounded-[1.5rem] p-4 md:bottom-6 md:left-6 md:translate-x-0 md:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-xl bg-[#fff1d8] text-[#c47a16]"><Trophy size={15} /></span>
                <div>
                  <p className="eyebrow">{searchOrigin?.source === "current" ? "Near me" : "Top pick"}</p>
                  <p className="text-[11px] font-extrabold text-[#697389]">{searchOrigin?.source === "current" ? "내 주변 1등 명당" : "이 지역 1등 명당"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2"><span className="rounded-lg bg-[#202942] px-2.5 py-1 text-[10px] font-black text-white">1위</span><button onClick={() => setIsSpotlightOpen(false)} aria-label="추천 카드 닫기" className="flex size-7 items-center justify-center rounded-lg bg-[#f1f2f6] text-[#7d8698] transition hover:bg-[#e7e9f0] hover:text-[#30394e]"><X size={14} /></button></div>
            </div>
            <div className="mt-4">
              <h2 className="truncate text-xl font-black tracking-[-0.04em] text-[#202942]">{featuredStore.shopName}</h2>
              <p className="mt-1.5 flex items-center gap-1 truncate text-[10px] font-medium text-[#969daf]"><MapPin size={11} /> {featuredStore.address}</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-[#fff0ed] px-3 py-2.5"><span className="block text-[9px] font-extrabold text-[#d87868]">1등 배출</span><strong className="mt-0.5 block text-base font-black text-[#e35e49]">{featuredStore.firstPrizeCount ?? 0}회</strong></div>
              <div className="rounded-xl bg-[#edf3ff] px-3 py-2.5"><span className="block text-[9px] font-extrabold text-[#6e89ba]">2등 배출</span><strong className="mt-0.5 block text-base font-black text-[#4771bd]">{featuredStore.secondPrizeCount ?? 0}회</strong></div>
              <div className="rounded-xl bg-[#f1f2f6] px-3 py-2.5"><span className="block text-[9px] font-extrabold text-[#858d9e]">거리</span><strong className="mt-0.5 block text-base font-black text-[#525c72]">{formatDistance(featuredDistance)}</strong></div>
            </div>
            <div className="mt-3">
              <button onClick={() => map?.panTo(new window.kakao.maps.LatLng(featuredStore.lat, featuredStore.lng))} className="w-full rounded-xl bg-[#4f46e5] px-3 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#4338ca]">지도에서 보기</button>
            </div>
          </div>
        )}

        {isSpotlightOpen && !featuredStore && !hasSearched && (
          <div className="glass-panel absolute bottom-4 left-1/2 z-30 w-[calc(100%-24px)] max-w-[370px] -translate-x-1/2 animate-enter rounded-[1.5rem] p-5 md:bottom-6 md:left-6 md:translate-x-0">
            <button onClick={() => setIsSpotlightOpen(false)} aria-label="주변 명당 안내 닫기" className="absolute right-4 top-4 flex size-7 items-center justify-center rounded-lg bg-[#f1f2f6] text-[#7d8698] transition hover:bg-[#e7e9f0] hover:text-[#30394e]"><X size={14} /></button>
            <div className="flex items-start gap-3 pr-7"><span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#4f46e5]"><MapPinned size={19} /></span><div><p className="eyebrow">Discover nearby</p><h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-[#202942]">내 주변 명당을 바로 찾아보세요</h2><p className="mt-1.5 text-[11px] font-medium leading-5 text-[#7e8799]">가까운 판매점 중 1등 당첨을 가장 많이 배출한 곳을 먼저 보여드려요.</p></div></div>
            {locationAccess === "checking" ? (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#f2f3f7] py-3 text-xs font-bold text-[#7e8799]"><LoaderCircle size={15} className="animate-spin" /> 위치 권한 확인 중...</div>
            ) : locationAccess === "denied" ? (
              <div className="mt-4 rounded-xl bg-[#fff7e8] px-4 py-3 text-center text-[11px] font-bold leading-5 text-[#9a6a21]">위치 권한이 꺼져 있습니다. 위 검색창에서 주소나 장소명을 검색해 주세요.</div>
            ) : (
              <button onClick={requestCurrentLocation} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#4f46e5] py-3 text-xs font-extrabold text-white transition hover:bg-[#4338ca] active:scale-[0.98]"><Crosshair size={15} /> 내 주변 명당 보기</button>
            )}
          </div>
        )}

        {!isSpotlightOpen && (
          <button onClick={() => setIsSpotlightOpen(true)} className="glass-panel absolute bottom-4 left-3 z-30 inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[11px] font-extrabold text-[#3f4960] transition hover:-translate-y-0.5 hover:text-[#4f46e5] md:bottom-6 md:left-6"><Sparkles size={14} className="text-[#4f46e5]" /> 주변 추천 보기</button>
        )}

        <div className="absolute left-1/2 top-24 z-30 w-full max-w-xs -translate-x-1/2 px-5 md:bottom-6 md:left-auto md:right-6 md:top-auto md:w-auto md:max-w-none md:translate-x-0 md:px-0">
          <button
            onClick={() => {
              searchSourceRef.current = "area";
              void handleSearchStores();
            }}
            disabled={isLoading || isZoomTooFar}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-6 py-3.5 text-sm font-extrabold shadow-[0_14px_32px_rgba(34,43,72,0.2)] backdrop-blur transition md:w-auto md:px-7 ${isZoomTooFar
              ? "cursor-not-allowed border-white/70 bg-white/90 text-[#9ca3b3]"
              : "border-[#4f46e5] bg-[#4f46e5] text-white hover:-translate-y-0.5 hover:bg-[#4338ca] active:scale-[0.98]"
              }`}
          >
            {isLoading ? (
              <><LoaderCircle size={17} className="animate-spin" /> 찾는 중...</>
            ) : isZoomTooFar ? (
              <><Search size={17} /> 지도를 더 확대해 주세요</>
            ) : (
              <><MapPinned size={17} /> 이 지역 명당 찾기</>
            )}
          </button>
        </div>

        <div className="absolute right-3 top-3 z-20 flex w-[calc(100vw-24px)] max-w-sm flex-col items-end gap-3 md:right-6 md:top-6 md:w-auto md:max-w-none">
          <div className="glass-panel flex w-full items-center rounded-2xl p-1.5 md:w-[360px]">
            <Search size={17} className="ml-3 shrink-0 text-[#8a92a5]" />
            <input
              type="text"
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchLocation()}
              placeholder="주소 또는 장소명 검색"
              aria-label="주소 또는 장소명 검색"
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-xs font-semibold text-[#30394e] outline-none placeholder:text-[#a0a7b6] md:text-sm"
            />
            <button
              onClick={searchLocation}
              className="shrink-0 rounded-xl bg-[#202942] px-4 py-2.5 text-[11px] font-extrabold text-white transition hover:bg-[#303b5b] active:scale-95 md:text-xs"
            >
              검색
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/ranking"
              className="glass-panel inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[11px] font-extrabold text-[#30394e] transition hover:-translate-y-0.5 hover:text-[#4f46e5] active:scale-95 md:rounded-2xl md:px-4 md:py-3 md:text-xs"
            >
              <Trophy size={15} className="text-[#d18b23]" /> <span>매장 랭킹</span>
            </Link>
            <Link
              href="/last"
              className="glass-panel inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[11px] font-extrabold text-[#30394e] transition hover:-translate-y-0.5 hover:text-[#4f46e5] active:scale-95 md:rounded-2xl md:px-4 md:py-3 md:text-xs"
            >
              <CalendarDays size={15} className="text-[#5b56d8]" /> <span>이번 회차</span>
            </Link>

            <button
              onClick={requestCurrentLocation}
              aria-label="현재 위치로 이동"
              className="glass-panel flex size-10 shrink-0 items-center justify-center rounded-xl text-[#4f46e5] transition hover:-translate-y-0.5 hover:bg-white active:scale-95 md:size-11 md:rounded-2xl"
            >
              <Crosshair size={18} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
