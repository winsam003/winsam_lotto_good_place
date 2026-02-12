"use client";

import { useState, useEffect, useRef } from "react";
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

export default function LottoMapPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [map, setMap] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [isZoomTooFar, setIsZoomTooFar] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchAddress, setSearchAddress] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  // 최신 회차 기준 설정 (현재 데이터가 1207회까지 있으므로)
  const LATEST_DRAW = 1207;

  const markersMapRef = useRef<Map<string, any>>(new Map());

  const searchLocation = () => {
    if (!map || !searchAddress.trim()) return;
    const { kakao } = window as any;
    const geocoder = new kakao.maps.services.Geocoder();

    geocoder.addressSearch(searchAddress, (result: any, status: any) => {
      if (status === kakao.maps.services.Status.OK) {
        const coords = new kakao.maps.LatLng(result[0].y, result[0].x);
        map.panTo(coords);
        map.setLevel(3);
        if (window.innerWidth < 768) setIsSidebarOpen(false);
      } else {
        alert("주소를 찾을 수 없습니다.");
      }
    });
  };

  const handleSearchStores = async () => {
    if (!map || isLoading || isZoomTooFar) return;

    setIsLoading(true);
    setHasSearched(true);

    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const center = map.getCenter();

    try {
      const { kakao } = window as any;
      const lottoCol = collection(db, "lotto_stores");

      const qUpper = query(
        lottoCol,
        where("lat", ">=", center.getLat()),
        where("lat", "<=", ne.getLat()),
        orderBy("lat", "asc"),
        limit(40),
      );

      const qLower = query(
        lottoCol,
        where("lat", ">=", sw.getLat()),
        where("lat", "<", center.getLat()),
        orderBy("lat", "desc"),
        limit(40),
      );

      const [upperSnap, lowerSnap] = await Promise.all([
        getDocs(qUpper),
        getDocs(qLower),
      ]);

      markersMapRef.current.forEach((marker) => marker.setMap(null));
      markersMapRef.current.clear();

      let newFetched: any[] = [];
      [...upperSnap.docs, ...lowerSnap.docs].forEach((doc) => {
        const data = doc.data();
        if (data.lng >= sw.getLng() && data.lng <= ne.getLng()) {
          newFetched.push({ id: doc.id, ...data });
        }
      });

      newFetched.sort((a, b) => (b.firstPrizeCount || 0) - (a.firstPrizeCount || 0));

      newFetched.forEach((store) => {
        const isRecent = store.lastUpdatedDraw > (LATEST_DRAW - 100);
        const marker = new kakao.maps.Marker({
          map: map,
          position: new kakao.maps.LatLng(store.lat, store.lng),
        });

        const infowindow = new kakao.maps.InfoWindow({
          content: `<div style="padding:10px; color:black; font-size:12px; width:160px; line-height:1.4;">
            <div style="font-weight:bold; margin-bottom:4px; border-bottom:1px solid #eee; padding-bottom:4px;">${store.shopName}</div>
            ${isRecent ? `<div style="color:#f59e0b; font-weight:bold; font-size:10px; margin-bottom:4px;">🔥 최근 100회 이내 당첨된 명당!</div>` : ""}
            <div style="color:#e11d48; font-weight:bold;">1등: ${store.firstPrizeCount || 0}회</div>
            <div style="color:#2563eb; font-weight:bold;">2등: ${store.secondPrizeCount || 0}회</div>
          </div>`,
          removable: true,
        });

        kakao.maps.event.addListener(marker, "click", () => {
          infowindow.open(map, marker);
        });

        markersMapRef.current.set(store.id, marker);
      });

      setStores(newFetched);
    } catch (error) {
      console.error("데이터 로드 중 오류 발생:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const { kakao } = window as any;
    if (kakao) {
      kakao.maps.load(() => {
        const container = document.getElementById("map");
        const options = {
          center: new kakao.maps.LatLng(37.4449, 127.1389),
          level: 3,
        };
        const newMap = new kakao.maps.Map(container, options);
        setMap(newMap);

        const checkZoomLevel = () => {
          setIsZoomTooFar(newMap.getLevel() > 5);
        };

        checkZoomLevel();
        kakao.maps.event.addListener(newMap, "zoom_changed", checkZoomLevel);
        kakao.maps.event.addListener(newMap, "idle", checkZoomLevel);

        if (window.innerWidth < 768) setIsSidebarOpen(false);
      });
    }
  }, []);

  const moveToCurrentLocation = () => {
    if (!map) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { kakao } = window as any;
      const latlng = new kakao.maps.LatLng(
        pos.coords.latitude,
        pos.coords.longitude,
      );
      map.panTo(latlng);
      map.setLevel(3);
    });
  };

  return (
    <main className="relative flex h-screen w-full overflow-hidden bg-white text-black font-sans">
      <aside
        className={`absolute md:relative z-40 flex flex-col h-full bg-white shadow-2xl transition-all duration-300 ${isSidebarOpen ? "w-[85%] md:w-96" : "w-0"
          }`}
      >
        <div className={`flex flex-col h-full p-5 ${!isSidebarOpen && "hidden"}`}>
          <h1 className="text-lg md:text-xl font-extrabold text-blue-600 mb-6 italic text-center shrink-0">
            WinSam Lotto Map
          </h1>
          <div className="flex-1 overflow-y-auto pr-1">
            <p className="text-xs text-gray-400 mb-4 font-semibold border-b pb-2">
              조회된 명당 ({stores.length}곳)
            </p>
            <div className="space-y-3">
              {stores.length > 0
                ? stores.map((store) => {
                  const isRecent = store.lastUpdatedDraw > (LATEST_DRAW - 100);
                  return (
                    <div
                      key={store.id}
                      className={`p-4 border rounded-2xl cursor-pointer shadow-sm group transition-all active:scale-[0.98] ${isRecent
                        ? "bg-amber-50/50 border-amber-200 hover:bg-amber-100"
                        : "bg-white border-gray-100 hover:bg-blue-50"
                        }`}
                      onClick={() => {
                        map.panTo(new (window as any).kakao.maps.LatLng(store.lat, store.lng));
                        if (window.innerWidth < 768) setIsSidebarOpen(false);
                      }}
                    >
                      {/* 최근 당첨 태그 추가 */}
                      {isRecent && (
                        <div className="flex items-center gap-1 mb-2">
                          <span className="text-[9px] font-black bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full animate-pulse">
                            🔥 최근 100회 이내 당첨된 명당
                          </span>
                        </div>
                      )}

                      <div className="mb-3">
                        <div className="font-bold text-gray-800 text-sm truncate group-hover:text-blue-600">
                          {store.shopName}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1 truncate">
                          📍 {store.address}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-white/50 p-2 rounded-xl border border-gray-100/50">
                        <div className="flex-1 flex flex-col items-center justify-center py-1">
                          <span className="text-[8px] font-black text-red-400 uppercase">1등</span>
                          <span className="text-sm font-black text-red-600">{store.firstPrizeCount || 0}</span>
                        </div>
                        <div className="w-[1px] h-4 bg-gray-200" />
                        <div className="flex-1 flex flex-col items-center justify-center py-1">
                          <span className="text-[8px] font-black text-blue-400 uppercase">2등</span>
                          <span className="text-sm font-black text-blue-600">{store.secondPrizeCount || 0}</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-3 px-1">
                        <span className="text-[9px] font-bold text-gray-300">
                          최근 당첨된 회차: {store.lastUpdatedDraw}회
                        </span>
                        <span className="text-[10px] text-blue-500 font-black">
                          GO MAP →
                        </span>
                      </div>
                    </div>
                  );
                })
                : hasSearched && !isLoading && (
                  <div className="py-20 text-center text-gray-500 font-bold">
                    명당이 없습니다. 지도를 옮겨보세요!
                  </div>
                )}
            </div>
          </div>
        </div>
      </aside>

      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-50 bg-white p-3 md:p-2 rounded-r-lg shadow-md border"
        style={{
          left: isSidebarOpen
            ? typeof window !== "undefined" && window.innerWidth < 768
              ? "85%"
              : "384px"
            : "0",
        }}
      >
        {isSidebarOpen ? "◀" : "▶"}
      </button>

      <section className="relative flex-1 h-full">
        <div id="map" className="w-full h-full" />

        <div className="absolute top-24 md:top-auto md:bottom-10 left-1/2 -translate-x-1/2 z-30 w-full px-10 max-w-xs md:max-w-none md:w-auto">
          <button
            onClick={handleSearchStores}
            disabled={isLoading || isZoomTooFar}
            className={`w-full md:w-auto px-6 md:px-10 py-3 md:py-4 rounded-full shadow-2xl font-black transition-all border-2 text-sm md:text-lg ${isZoomTooFar
              ? "bg-gray-200 text-gray-400 border-gray-300"
              : "bg-blue-600 text-white border-blue-600 active:scale-95"
              }`}
          >
            {isLoading ? "SEARCHING..." : isZoomTooFar ? "🔍 더 확대해주세요" : "이 지역 명당 찾기"}
          </button>
        </div>

        <div className="absolute right-4 bottom-6 md:right-8 md:bottom-10 z-20 flex flex-col items-end gap-3 md:gap-4 max-w-[calc(100vw-32px)]">
          <div className="flex items-center bg-white rounded-xl md:rounded-2xl shadow-2xl border p-1 md:p-2 w-full sm:w-80">
            <input
              type="text"
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchLocation()}
              placeholder="주소 입력"
              className="flex-1 bg-transparent px-3 py-2 outline-none text-xs md:text-sm font-medium min-w-0"
            />
            <button
              onClick={searchLocation}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold shrink-0 active:scale-95"
            >
              GO
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/ranking"
              className="flex items-center gap-2 bg-white text-blue-600 px-5 py-3 md:px-6 md:py-4 rounded-xl md:rounded-2xl shadow-2xl font-bold border border-blue-100 text-xs md:text-sm active:scale-95 transition-all"
            >
              👑 <span className="uppercase italic">매장 랭킹</span>
            </Link>
            <Link
              href="/last"
              className="flex items-center gap-2 bg-white text-blue-600 px-5 py-3 md:px-6 md:py-4 rounded-xl md:rounded-2xl shadow-2xl font-bold border border-blue-100 text-xs md:text-sm active:scale-95 transition-all"
            >
              🍀 <span className="uppercase italic">이번 회차</span>
            </Link>

            <button
              onClick={moveToCurrentLocation}
              className="bg-white p-4 md:p-5 rounded-xl md:rounded-2xl shadow-2xl border text-xl md:text-2xl active:scale-95 shrink-0 transition-all"
            >
              🎯
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}