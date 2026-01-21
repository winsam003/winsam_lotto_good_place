"use client";

import { useState } from "react";

export default function LottoMapPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <main className="relative flex h-screen w-full overflow-hidden bg-white">
      {/* 1. 왼쪽 사이드바 */}
      <aside
        className={`relative z-10 flex flex-col bg-white shadow-xl transition-all duration-300 ease-in-out overflow-hidden ${
          isSidebarOpen ? "w-96" : "w-0"
        }`}
      >
        {/* 내부 컨텐츠가 찌그러지지 않도록 min-w-96 설정 */}
        <div className="flex flex-col h-full min-w-[24rem] p-5">
          <h1 className="text-xl font-extrabold text-blue-600 mb-6">
            WinSam Lotto Good Place
          </h1>

          {/* 검색창 영역 */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="지역구 또는 지점명 검색"
              className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
          </div>

          {/* 결과 리스트 영역 (스크롤 가능) */}
          <div className="flex-1 overflow-y-auto pr-1">
            <p className="text-sm text-gray-500 mb-3">내 주변 명당 목록</p>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
                <div
                  key={item}
                  className="p-4 border border-gray-100 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors shadow-sm"
                >
                  <div className="font-bold text-gray-800">
                    럭키 복권방 (1등 12회)
                  </div>
                  <div className="text-sm text-gray-600">
                    경기도 성남시 수정구...
                  </div>
                  <div className="mt-2 text-xs font-semibold text-red-500">
                    최근 당첨: 1205회차
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 사이드바 접기/펴기 버튼 (aside 밖에 위치하도록 설정) */}
      </aside>

      {/* 사이드바 토글 버튼 (aside 영역 밖에서 항상 보이게) */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white p-2 rounded-r-lg shadow-md border border-l-0 transition-all duration-300 ease-in-out"
        style={{
          transform: `translateY(-50%) translateX(${isSidebarOpen ? "384px" : "0px"})`,
        }}
      >
        {isSidebarOpen ? "◀" : "▶"}
      </button>

      {/* 2. 오른쪽 지도 영역 */}
      <section className="relative flex-1 bg-gray-50">
        <div id="map" className="w-full h-full">
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            카카오 지도를 불러오는 중...
          </div>
        </div>

        {/* 지도 위 플로팅 버튼 */}
        <div className="absolute right-5 bottom-5 z-20 flex flex-col gap-2">
          <button
            className="bg-white p-3 rounded-full shadow-lg hover:bg-gray-50 transition-all border text-xl"
            title="내 위치"
          >
            📍
          </button>
        </div>
      </section>
    </main>
  );
}
