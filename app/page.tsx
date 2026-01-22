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
        // 모바일 배려: 검색 후 사이드바 닫기 (선택 사항)
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
      const lottoCol = collection(db, "lotto_winners");

      const qUpper = query(
        lottoCol,
        where("lat", ">=", center.getLat()),
        where("lat", "<=", ne.getLat()),
        orderBy("lat", "asc"), // 위쪽은 위도가 커지는 순서대로 (중심에서 가까운 순)
        limit(25),
      );

      const qLower = query(
        lottoCol,
        where("lat", ">=", sw.getLat()),
        where("lat", "<", center.getLat()),
        orderBy("lat", "desc"), // 아래쪽은 위도가 작아지는 순서대로 (중심에서 가까운 순)
        limit(25),
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

      newFetched.forEach((store) => {
        const marker = new kakao.maps.Marker({
          map: map,
          position: new kakao.maps.LatLng(store.lat, store.lng),
        });

        const infowindow = new kakao.maps.InfoWindow({
          content: `<div style="padding:10px; color:black; font-size:12px; width:160px;">
            <div style="font-weight:bold; margin-bottom:4px;">${store.shopName}</div>
            <div style="color:${store.rank === 1 ? "#e11d48" : "#2563eb"}; font-weight:bold;">
              ${store.rank}등 당첨
            </div>
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

        // 초기 로드 시 모바일이면 사이드바 닫아두기
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
      {/* 사이드바: 모바일에서는 absolute로 띄워 지도를 가리도록 설정 */}
      <aside
        className={`absolute md:relative z-40 flex flex-col h-full bg-white shadow-2xl transition-all duration-300 ${
          isSidebarOpen ? "w-[85%] md:w-96" : "w-0"
        }`}
      >
        <div
          className={`flex flex-col h-full p-5 ${!isSidebarOpen && "hidden"}`}
        >
          <h1 className="text-lg md:text-xl font-extrabold text-blue-600 mb-6 italic text-center shrink-0">
            WinSam Lotto Map
          </h1>
          <div className="flex-1 overflow-y-auto pr-1">
            <p className="text-xs text-gray-400 mb-4 font-semibold border-b pb-2">
              조회된 당첨 기록 ({stores.length}곳)
            </p>
            <div className="space-y-3">
              {stores.length > 0
                ? stores.map((store) => (
                    <div
                      key={store.id}
                      className="p-3 md:p-4 border border-gray-100 rounded-xl hover:bg-blue-50 cursor-pointer shadow-sm group bg-white"
                      onClick={() => {
                        map.panTo(
                          new (window as any).kakao.maps.LatLng(
                            store.lat,
                            store.lng,
                          ),
                        );
                        if (window.innerWidth < 768) setIsSidebarOpen(false);
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-gray-800 text-sm truncate group-hover:text-blue-600">
                            {store.shopName}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                            {store.address}
                          </div>
                        </div>
                        <span
                          className={`ml-2 text-[10px] px-2 py-0.5 rounded font-black whitespace-nowrap ${
                            store.rank === 1
                              ? "bg-red-50 text-red-600 border border-red-100"
                              : "bg-blue-50 text-blue-600 border border-blue-100"
                          }`}
                        >
                          {store.rank}등
                        </span>
                      </div>

                      {/* 추가된 회차 및 자동/수동 정보 */}
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-dotted border-gray-100">
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          {store.drawNo || "000"}회
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            store.method === "자동"
                              ? "text-green-600"
                              : "text-purple-600"
                          }`}
                        >
                          {store.method || "자동"}
                        </span>
                      </div>
                    </div>
                  ))
                : hasSearched &&
                  !isLoading && (
                    <div className="py-20 text-center text-gray-500 font-bold">
                      명당이 없습니다. 지도를 옮겨보세요!
                    </div>
                  )}
            </div>
          </div>
        </div>
      </aside>

      {/* 사이드바 토글 버튼: 모바일 터치 대응을 위해 크기 키움 */}
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

        {/* 중앙 검색 버튼: [수정] md(PC)에서는 하단 고정, 모바일에서는 상단 주소창 근처로 이동 */}
        <div className="absolute top-24 md:top-auto md:bottom-10 left-1/2 -translate-x-1/2 z-30 w-full px-10 max-w-xs md:max-w-none md:w-auto">
          <button
            onClick={handleSearchStores}
            disabled={isLoading || isZoomTooFar}
            className={`w-full md:w-auto px-6 md:px-10 py-3 md:py-4 rounded-full shadow-2xl font-black transition-all border-2 text-sm md:text-lg ${
              isZoomTooFar
                ? "bg-gray-200 text-gray-400 border-gray-300"
                : "bg-blue-600 text-white border-blue-600 active:scale-95"
            }`}
          >
            {isLoading
              ? "SEARCHING..."
              : isZoomTooFar
                ? "🔍 더 확대해주세요"
                : "이 지역 명당 찾기"}
          </button>
        </div>

        {/* 우측 하단 컨트롤 섹션 (기본 구조 유지) */}
        <div className="absolute right-4 bottom-6 md:right-8 md:bottom-10 z-20 flex flex-col items-end gap-3 md:gap-4 max-w-[calc(100vw-32px)]">
          {/* 주소 검색창 */}
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

          {/* 하단 버튼 그룹 */}
          <div className="flex items-center gap-3">
            <Link
              href="/ranking"
              className="flex items-center gap-2 bg-white text-blue-600 px-5 py-3 md:px-6 md:py-4 rounded-xl md:rounded-2xl shadow-2xl font-bold border border-blue-100 text-xs md:text-sm active:scale-95 transition-all"
            >
              🏆 <span className="uppercase italic">이번 회차</span>
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
