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
                const latestQuery = query(
                    collection(db, "lotto_winners"),
                    orderBy("createdAt", "desc"),
                    limit(1),
                );
                const latestSnap = await getDocs(latestQuery);

                if (!latestSnap.empty) {
                    const latestDrawNo = latestSnap.docs[0].data().drawNo;
                    setCurrentDrawNo(latestDrawNo);

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
        <main className="min-h-screen bg-gray-50 py-6 md:py-10 px-4 text-black font-sans">
            <div className="max-w-4xl mx-auto">
                {/* 헤더: 모바일에서 가운데 정렬 대응 */}
                <div className="flex flex-col md:flex-row justify-between items-center md:items-end mb-8 gap-6">
                    <div className="text-center md:text-left">
                        <h1 className="text-2xl md:text-3xl font-black text-blue-600 tracking-tight">
                            {currentDrawNo
                                ? `${currentDrawNo}회 당첨 명당`
                                : "최신 당첨 판매점"}
                        </h1>
                        <p className="text-sm md:text-base text-gray-500 mt-2 font-medium">
                            이번 회차 당첨지 총 {allWinners.length}곳 리스트입니다.
                        </p>
                    </div>
                    <Link
                        href="/"
                        className="w-full md:w-auto text-center text-sm font-bold text-blue-500 hover:bg-blue-50 px-5 py-3 rounded-2xl border border-blue-100 bg-white shadow-sm transition-all"
                    >
                        ← 지도로 돌아가기
                    </Link>
                </div>

                {/* 실시간 검색 인풋: 모바일 터치 최적화 */}
                <div className="mb-6 relative group">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400">
                        🔍
                    </span>
                    <input
                        type="text"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="동네 또는 가게 이름 입력"
                        className="w-full pl-12 pr-6 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all text-sm md:text-base"
                    />
                </div>

                {/* 데이터 영역 */}
                <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl shadow-blue-100/40 overflow-hidden border border-gray-100">
                    {/* 1. PC 버전: 테이블 (md 이상에서 노출) */}
                    <div className="hidden md:block overflow-x-auto">
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
                                {!isLoading &&
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
                                    ))}
                            </tbody>
                        </table>
                    </div>

                    {/* 2. 모바일 버전: 카드 리스트 (md 미만에서 노출) */}
                    <div className="block md:hidden">
                        {isLoading ? (
                            [...Array(5)].map((_, i) => (
                                <div
                                    key={i}
                                    className="p-6 border-b border-gray-50 animate-pulse"
                                >
                                    <div className="h-5 bg-gray-100 rounded w-1/3 mb-3"></div>
                                    <div className="h-4 bg-gray-50 rounded w-2/3"></div>
                                </div>
                            ))
                        ) : filteredWinners.length > 0 ? (
                            <div className="divide-y divide-gray-50">
                                {filteredWinners.map((store) => (
                                    <div
                                        key={store.id}
                                        className="p-5 active:bg-blue-50 transition-colors"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-gray-400">
                                                    {store.rank}위
                                                </span>
                                                <h3 className="font-extrabold text-gray-800 text-base">
                                                    {store.shopName}
                                                </h3>
                                            </div>
                                            <span
                                                className={`px-2 py-0.5 rounded-full font-black text-[10px] ${store.rank === 1 ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}
                                            >
                                                {store.rank}등
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-gray-400 flex items-start gap-1 mb-3">
                                            <span className="shrink-0">📍</span> {store.address}
                                        </p>
                                        <div className="flex justify-end">
                                            <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-bold text-gray-500">
                                                {store.type}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-20 text-center text-gray-400 font-medium">
                                검색 결과가 없습니다.
                            </div>
                        )}
                    </div>

                    {/* 로딩 상태 (테이블용 공통) */}
                    {isLoading && (
                        <div className="hidden md:block py-20 text-center text-blue-500 font-bold">
                            데이터를 불러오는 중...
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
