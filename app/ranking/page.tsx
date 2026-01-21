"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  where,
} from "firebase/firestore";
import Link from "next/link";

export default function RankingPage() {
  const [allWinners, setAllWinners] = useState<any[]>([]);
  const [filteredWinners, setFilteredWinners] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [currentDrawNo, setCurrentDrawNo] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // 1단계: 가장 최근에 등록된 데이터 1개만 가져와서 최신 회차 번호(drawNo) 확인
        const latestQuery = query(
          collection(db, "lotto_winners"),
          orderBy("createdAt", "desc"),
          limit(1),
        );
        const latestSnap = await getDocs(latestQuery);

        if (!latestSnap.empty) {
          const latestDrawNo = latestSnap.docs[0].data().drawNo;
          setCurrentDrawNo(latestDrawNo);

          // 2단계: 위에서 알아낸 최신 회차(latestDrawNo)와 일치하는 데이터 '전체' 가져오기
          // rank 순으로 정렬하여 1등이 상단에 오도록 구성
          const drawQuery = query(
            collection(db, "lotto_winners"),
            where("drawNo", "==", latestDrawNo),
            orderBy("rank", "asc"),
          );

          const drawSnap = await getDocs(drawQuery);
          const results = drawSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          setAllWinners(results);
          setFilteredWinners(results);
        }
      } catch (error) {
        console.error("데이터 로드 실패:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // 검색 로직 (메모리 필터링)
  useEffect(() => {
    const term = keyword.trim().toLowerCase();
    if (!term) {
      setFilteredWinners(allWinners);
      return;
    }
    const filtered = allWinners.filter(
      (store) =>
        store.address?.toLowerCase().includes(term) ||
        store.shopName?.toLowerCase().includes(term),
    );
    setFilteredWinners(filtered);
  }, [keyword, allWinners]);

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 text-black font-sans">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-blue-600 tracking-tight">
              {currentDrawNo
                ? `${currentDrawNo}회 당첨 명당`
                : "최신 당첨 판매점"}
            </h1>
            <p className="text-gray-500 mt-2 font-medium">
              이번 회차 당첨지 총 {allWinners.length}곳 리스트입니다.
            </p>
          </div>
          <Link
            href="/"
            className="text-sm font-bold text-blue-500 hover:bg-blue-50 px-5 py-2.5 rounded-2xl border border-blue-100 bg-white shadow-sm transition-all"
          >
            ← 지도로 돌아가기
          </Link>
        </div>

        {/* 실시간 검색 인풋 */}
        <div className="mb-6 relative group">
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400">
            🔍
          </span>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="동네 또는 가게 이름 입력 (예: 성남, 대운)"
            className="w-full pl-12 pr-6 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
          />
        </div>

        {/* 테이블 데이터 */}
        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-blue-100/40 overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="py-6 px-6 font-bold text-gray-400 text-xs text-center w-24">
                    순위
                  </th>
                  <th className="py-6 px-6 font-bold text-gray-400 text-xs uppercase">
                    판매점 정보
                  </th>
                  <th className="py-6 px-6 font-bold text-gray-400 text-xs text-center uppercase">
                    당첨결과
                  </th>
                  <th className="py-6 px-6 font-bold text-gray-400 text-xs text-center uppercase">
                    구분
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={4} className="py-10 bg-gray-50/30"></td>
                    </tr>
                  ))
                ) : filteredWinners.length > 0 ? (
                  filteredWinners.map((store) => (
                    <tr
                      key={store.id}
                      className="hover:bg-blue-50/40 transition-colors group cursor-default"
                    >
                      <td className="py-6 px-6 text-center font-bold text-gray-400">
                        {store.rank}위
                      </td>
                      <td className="py-6 px-6">
                        <div className="font-extrabold text-gray-800 text-base group-hover:text-blue-600 transition-colors">
                          {store.shopName}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                          📍 {store.address}
                        </div>
                      </td>
                      <td className="py-6 px-6 text-center">
                        <span
                          className={`px-3 py-1 rounded-full font-black text-xs ${store.rank === 1 ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}
                        >
                          {store.rank}등 당첨
                        </span>
                      </td>
                      <td className="py-6 px-6 text-center text-gray-500 font-bold text-xs">
                        <span className="bg-gray-100 px-2 py-1 rounded-md">
                          {store.type}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-20 text-center text-gray-400 font-medium"
                    >
                      검색 결과가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
