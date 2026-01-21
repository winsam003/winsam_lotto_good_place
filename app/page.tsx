"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
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

  // 1. 주소 검색 함수
  const searchLocation = () => {
    if (!map || !searchAddress.trim()) return;
    const { kakao } = window as any;
    const geocoder = new kakao.maps.services.Geocoder();

    geocoder.addressSearch(searchAddress, (result: any, status: any) => {
      if (status === kakao.maps.services.Status.OK) {
        const coords = new kakao.maps.LatLng(result[0].y, result[0].x);
        map.panTo(coords);
        map.setLevel(3);
      } else {
        alert("주소를 찾을 수 없습니다.");
      }
    });
  };

  // 2. 명당 데이터 검색
  const handleSearchStores = async () => {
    if (!map || isLoading || isZoomTooFar) return;

    setIsLoading(true);
    setHasSearched(true);
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    try {
      const q = query(
        collection(db, "lotto_winners"),
        where("lat", ">=", sw.getLat()),
        where("lat", "<=", ne.getLat()),
        limit(50),
      );

      const querySnapshot = await getDocs(q);
      let newStores: any[] = [];
      const { kakao } = window as any;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.lng >= sw.getLng() && data.lng <= ne.getLng()) {
          newStores.push({ id: doc.id, ...data });
        }
      });

      // 마커 업데이트 로직
      const newStoreIds = new Set(newStores.map((s) => s.id));
      markersMapRef.current.forEach((marker, id) => {
        if (!newStoreIds.has(id)) {
          marker.setMap(null);
          markersMapRef.current.delete(id);
        }
      });

      newStores.forEach((store) => {
        if (!markersMapRef.current.has(store.id)) {
          const marker = new kakao.maps.Marker({
            map: map,
            position: new kakao.maps.LatLng(store.lat, store.lng),
          });

          const infowindow = new kakao.maps.InfoWindow({
            content: `<div style="padding:10px; color:black; font-size:12px; width:160px;">
              <div style="font-weight:bold; margin-bottom:4px;">${store.shopName}</div>
              <div style="color:${store.rank === 1 ? "#e11d48" : "#2563eb"}; font-weight:bold;">
                ${store.rank}등 당첨 (${store.type || "정보없음"})
              </div>
              <div style="font-size:10px; color:#999; margin-top:2px;">${store.drawNo}회차</div>
            </div>`,
            removable: true,
          });

          kakao.maps.event.addListener(marker, "click", () => {
            infowindow.open(map, marker);
          });
          markersMapRef.current.set(store.id, marker);
        }
      });

      setStores(newStores);
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
          const currentLevel = newMap.getLevel();
          setIsZoomTooFar(currentLevel > 5);
        };

        checkZoomLevel();
        kakao.maps.event.addListener(newMap, "zoom_changed", checkZoomLevel);
        kakao.maps.event.addListener(newMap, "idle", checkZoomLevel);
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
        className={`relative z-10 flex flex-col bg-white shadow-xl transition-all duration-300 ${isSidebarOpen ? "w-96" : "w-0"}`}
      >
        <div className="flex flex-col h-full min-w-[24rem] p-5">
          <h1 className="text-xl font-extrabold text-blue-600 mb-6 italic text-center">
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
                      className="p-4 border border-gray-100 rounded-xl hover:bg-blue-50 cursor-pointer shadow-sm group"
                      onClick={() => {
                        map.panTo(
                          new (window as any).kakao.maps.LatLng(
                            store.lat,
                            store.lng,
                          ),
                        );
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-bold text-gray-800 text-sm group-hover:text-blue-600 transition-colors">
                            {store.shopName}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-1 line-clamp-1">
                            {store.address}
                          </div>
                        </div>
                        {/* 🚀 0 0 버그 해결: rank 필드 직접 사용 */}
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
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">
                          {store.type || "자동"}
                        </span>
                        <span className="text-[9px] text-gray-400 font-medium">
                          {store.drawNo}회차
                        </span>
                      </div>
                    </div>
                  ))
                : hasSearched &&
                  !isLoading && (
                    <div className="py-20 text-center">
                      <p className="text-gray-500 font-bold">
                        이 지역에는 명당이 없습니다.
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        지도를 옮겨서 다시 검색해보세요!
                      </p>
                    </div>
                  )}
            </div>
          </div>
        </div>
      </aside>

      {/* 나머지 버튼 및 지도 섹션은 기존과 동일 */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white p-2 rounded-r-lg shadow-md border"
        style={{
          transform: `translateY(-50%) translateX(${isSidebarOpen ? "384px" : "0px"})`,
        }}
      >
        {isSidebarOpen ? "◀" : "▶"}
      </button>

      <section className="relative flex-1">
        <div id="map" className="w-full h-full" />
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30">
          <button
            onClick={handleSearchStores}
            disabled={isLoading || isZoomTooFar}
            className={`px-10 py-4 rounded-full shadow-2xl font-black transition-all border-2 text-lg ${isZoomTooFar ? "bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed" : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 active:scale-95"}`}
          >
            {isLoading
              ? "SEARCHING..."
              : isZoomTooFar
                ? "🔍 지도를 더 확대해주세요"
                : "이 지역 명당 찾기"}
          </button>
        </div>
        <div className="absolute right-8 bottom-10 z-20 flex flex-col items-end gap-3">
          <Link
            href="/ranking"
            className="flex items-center gap-2 bg-white text-blue-600 px-6 py-4 rounded-2xl shadow-2xl font-bold border border-blue-100 hover:bg-blue-50 transition-all"
          >
            <span className="text-xl">🏆</span>
            <span className="text-sm uppercase italic">이번 회차 당첨지</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white rounded-2xl shadow-2xl border p-2 w-72">
              <input
                type="text"
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchLocation()}
                placeholder="동네/주소 입력"
                className="flex-1 bg-transparent px-3 py-2 outline-none text-sm font-medium"
              />
              <button
                onClick={searchLocation}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
              >
                GO
              </button>
            </div>
            <button
              onClick={moveToCurrentLocation}
              className="bg-white p-5 rounded-2xl shadow-2xl border text-2xl hover:scale-110 active:scale-95 transition-all"
            >
              🎯
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
