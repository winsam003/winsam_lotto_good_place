"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";

// [추가] 타입 에러 방지를 위한 인터페이스 정의
interface LottoStore {
  id: string;
  shopName: string;
  address: string;
  lat: number;
  lng: number;
  firstPrizeCount: number;
  secondPrizeCount: number;
  lastUpdatedDraw: number;
}

export default function RankingPage() {
  const [allWinners, setAllWinners] = useState<LottoStore[]>([]);
  const [filteredWinners, setFilteredWinners] = useState<LottoStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const q = query(
          collection(db, "lotto_stores"),
          orderBy("firstPrizeCount", "desc"),
          limit(300)
        );

        const snap = await getDocs(q);
        let results = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as LottoStore[]; // [수정] 타입 단언으로 에러 해결

        results.sort((a, b) => {
          if (b.firstPrizeCount !== a.firstPrizeCount) {
            return b.firstPrizeCount - a.firstPrizeCount;
          }
          return (b.secondPrizeCount || 0) - (a.secondPrizeCount || 0);
        });

        setAllWinners(results);
        setFilteredWinners(results);
      } catch (err: any) {
        console.error("데이터 로드 실패:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const term = keyword.trim().toLowerCase();
    if (!term) {
      setFilteredWinners(allWinners);
      return;
    }
    const filtered = allWinners.filter(
      (store) =>
        store.address?.toLowerCase().includes(term) ||
        store.shopName?.toLowerCase().includes(term)
    );
    setFilteredWinners(filtered);
  }, [keyword, allWinners]);

  // [수정] 클릭 시 좌표와 ID를 들고 메인 지도로 이동
  const goToStoreOnMap = (store: LottoStore) => {
    router.push(`/?storeId=${store.id}&lat=${store.lat}&lng=${store.lng}`);
  };

  const getRankDisplay = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return index + 1;
  };

  return (
    <main className="min-h-screen bg-gray-50 py-6 md:py-10 px-4 text-black font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-end mb-8 gap-6">
          <div className="text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-black text-blue-600 tracking-tight">🏆 역대 로또 명당 TOP 100</h1>
            <p className="text-sm md:text-base text-gray-500 mt-2 font-medium">전국에서 1등 당첨을 가장 많이 배출한 매장 순위입니다.</p>
          </div>
          <Link href="/" className="w-full md:w-auto text-center text-sm font-bold text-blue-500 hover:bg-blue-50 px-6 py-3 rounded-2xl border border-blue-100 bg-white shadow-sm active:scale-95 transition-all">
            ← 지도로 돌아가기
          </Link>
        </div>

        <div className="mb-6 relative">
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="동네 또는 판매점 이름으로 검색"
            className="w-full pl-12 pr-6 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all text-sm md:text-base"
          />
        </div>

        <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl shadow-blue-100/40 overflow-hidden border border-gray-100">
          {!isLoading ? (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="py-6 px-6 font-bold text-gray-400 text-xs text-center w-24">순위</th>
                      <th className="py-6 px-6 font-bold text-gray-400 text-xs">판매점 정보</th>
                      <th className="py-6 px-6 font-bold text-gray-400 text-xs text-center">1등 배출</th>
                      <th className="py-6 px-6 font-bold text-gray-400 text-xs text-center">2등 배출</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredWinners.slice(0, 100).map((store, index) => (
                      <tr
                        key={store.id}
                        className={`transition-colors group cursor-pointer ${index < 3 ? 'bg-amber-50/20' : 'hover:bg-blue-50/40'}`}
                        onClick={() => goToStoreOnMap(store)}
                      >
                        <td className="py-6 px-6 text-center">
                          <span className={`text-xl font-black ${index < 3 ? "scale-110 inline-block" : "text-gray-300"}`}>{getRankDisplay(index)}</span>
                        </td>
                        <td className="py-6 px-6">
                          <div className="font-extrabold text-gray-800 text-base group-hover:text-blue-600 transition-colors">{store.shopName}</div>
                          <div className="text-[11px] text-gray-400 mt-1">📍 {store.address}</div>
                        </td>
                        <td className="py-6 px-6 text-center">
                          <span className="bg-red-50 text-red-600 px-4 py-1.5 rounded-full font-black text-sm border border-red-100">{store.firstPrizeCount || 0}회</span>
                        </td>
                        <td className="py-6 px-6 text-center">
                          <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full font-black text-sm border border-blue-100">{store.secondPrizeCount || 0}회</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="block md:hidden">
                {filteredWinners.slice(0, 100).map((store, index) => (
                  <div
                    key={store.id}
                    className={`p-6 border-b border-gray-50 active:bg-blue-50 cursor-pointer ${index < 3 ? 'bg-amber-50/30' : ''}`}
                    onClick={() => goToStoreOnMap(store)}
                  >
                    <div className="flex gap-4 items-start mb-4">
                      <span className="text-2xl font-black shrink-0">{getRankDisplay(index)}</span>
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-gray-800 text-base mb-1 truncate">{store.shopName}</h3>
                        <p className="text-[11px] text-gray-400 leading-tight line-clamp-2">📍 {store.address}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white border border-red-100 py-3 rounded-2xl text-center shadow-sm">
                        <span className="block text-[9px] font-black text-red-400 mb-0.5">1ST PRIZE</span>
                        <span className="text-red-600 font-black text-base">{store.firstPrizeCount || 0}회</span>
                      </div>
                      <div className="bg-white border border-blue-100 py-3 rounded-2xl text-center shadow-sm">
                        <span className="block text-[9px] font-black text-blue-400 mb-0.5">2ND PRIZE</span>
                        <span className="text-blue-600 font-black text-base">{store.secondPrizeCount || 0}회</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-24 text-center">
              <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-blue-600 font-black animate-pulse tracking-widest text-xs uppercase">Ranking Loading...</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}