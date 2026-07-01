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
import { ArrowLeft, CalendarDays, MapPin, Search } from "lucide-react";

interface WinnerRecord {
    id: string;
    shopName?: string | null;
    address?: string | null;
    rank: number;
    type?: string | null;
}

interface RankedStore {
    id: string;
    shopName: string;
    address: string;
    firstPrizeCount: number;
    secondPrizeCount: number;
    types: string[];
    position: number;
}

const rankStores = (records: WinnerRecord[]): RankedStore[] => {
    const stores = new Map<string, Omit<RankedStore, "position">>();

    records.forEach((record) => {
        const shopName = record.shopName ?? "이름 없는 판매점";
        const address = record.address ?? "주소 정보 없음";
        const storeId = `${shopName}_${address.replace(/\s/g, "")}`;
        const store = stores.get(storeId) ?? {
            id: storeId,
            shopName,
            address,
            firstPrizeCount: 0,
            secondPrizeCount: 0,
            types: [],
        };

        if (record.rank === 1) store.firstPrizeCount += 1;
        if (record.rank === 2) store.secondPrizeCount += 1;
        if (record.type && !store.types.includes(record.type)) {
            store.types.push(record.type);
        }

        stores.set(storeId, store);
    });

    const sortedStores = Array.from(stores.values()).sort(
        (a, b) =>
            b.firstPrizeCount - a.firstPrizeCount ||
            b.secondPrizeCount - a.secondPrizeCount,
    );

    let position = 0;

    return sortedStores.map((store, index) => {
        const previousStore = sortedStores[index - 1];
        const isTied =
            previousStore &&
            store.firstPrizeCount === previousStore.firstPrizeCount &&
            store.secondPrizeCount === previousStore.secondPrizeCount;

        if (!isTied) position = index + 1;

        return { ...store, position };
    });
};

export default function RankingPage() {
    const [allWinners, setAllWinners] = useState<RankedStore[]>([]);
    const [filteredWinners, setFilteredWinners] = useState<RankedStore[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [keyword, setKeyword] = useState("");
    const [currentDrawNo, setCurrentDrawNo] = useState<number | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const latestQuery = query(
                    collection(db, "lotto_winners"),
                    orderBy("drawNo", "desc"),
                    limit(1),
                );
                const latestSnap = await getDocs(latestQuery);

                if (!latestSnap.empty) {
                    const latestDrawNo = latestSnap.docs[0].data().drawNo;
                    setCurrentDrawNo(latestDrawNo);

                    const drawQuery = query(
                        collection(db, "lotto_winners"),
                        where("drawNo", "==", latestDrawNo),
                    );

                    const drawSnap = await getDocs(drawQuery);
                    const records = drawSnap.docs.map((doc) => ({
                        id: doc.id,
                        ...doc.data(),
                    })) as WinnerRecord[];
                    const results = rankStores(records);

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
        <main className="page-canvas soft-grid px-4 py-7 md:px-6 md:py-12">
            <div className="mx-auto max-w-5xl animate-enter">
                <Link href="/" className="mb-7 inline-flex items-center gap-2 text-xs font-extrabold text-[#68738a] transition hover:text-[#4f46e5]"><ArrowLeft size={15} /> 지도로 돌아가기</Link>
                {/* 헤더: 모바일에서 가운데 정렬 대응 */}
                <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="mb-3 flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-xl bg-[#eef0ff] text-[#4f46e5]"><CalendarDays size={16} /></span><p className="eyebrow">Latest draw</p></div>
                        <h1 className="text-3xl font-black tracking-[-0.05em] text-[#172033] md:text-5xl">
                            {currentDrawNo
                                ? `${currentDrawNo}회 당첨 명당`
                                : "최신 당첨 판매점"}
                        </h1>
                        <p className="mt-3 text-sm font-medium leading-6 text-[#737d91]">
                            이번 회차 당첨 판매점 {allWinners.length}곳을 1등 배출 횟수순으로 보여드립니다.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-[#e2e4ef] bg-white/80 px-5 py-3 shadow-sm backdrop-blur"><span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9aa1b1]">Winning stores</span><strong className="ml-3 text-lg font-black text-[#4f46e5]">{allWinners.length}</strong></div>
                </div>

                {/* 실시간 검색 인풋: 모바일 터치 최적화 */}
                <div className="glass-panel mb-5 flex items-center rounded-2xl px-4 py-1">
                    <Search size={18} className="shrink-0 text-[#9299aa]" />
                    <input
                        type="text"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="동네 또는 판매점 이름으로 검색"
                        className="focus-field w-full border-0 bg-transparent px-3 py-3.5 text-sm font-semibold outline-none placeholder:text-[#a4aaba]"
                    />
                </div>

                {/* 데이터 영역 */}
                <div className="surface-card overflow-hidden rounded-[1.5rem] md:rounded-[2rem]">
                    {/* 1. PC 버전: 테이블 (md 이상에서 노출) */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[#eceef4] bg-[#fafbfc] text-[#969daf]">
                                    <th className="py-6 px-6 font-bold text-gray-400 text-xs text-center w-24">
                                        순위
                                    </th>
                                    <th className="py-6 px-6 font-bold text-gray-400 text-xs uppercase">
                                        판매점 정보
                                    </th>
                                    <th className="py-6 px-6 font-bold text-gray-400 text-xs text-center uppercase">
                                        1등 배출
                                    </th>
                                    <th className="py-6 px-6 font-bold text-gray-400 text-xs text-center uppercase">
                                        2등 배출
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f0f1f5]">
                                {!isLoading &&
                                    filteredWinners.map((store) => (
                                        <tr
                                            key={store.id}
                                            className="group transition-colors hover:bg-[#f8f8ff]"
                                        >
                                            <td className="py-6 px-6 text-center">
                                                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[#f0f1f7] text-sm font-black text-[#626c80]">{store.position}</span>
                                            </td>
                                            <td className="py-6 px-6">
                                                <div className="text-base font-extrabold text-[#293248]">
                                                    {store.shopName}
                                                </div>
                                                <div className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-[#969daf]">
                                                    <MapPin size={12} /> {store.address}
                                                </div>
                                            </td>
                                            <td className="py-6 px-6 text-center">
                                                <span className="inline-flex min-w-16 justify-center rounded-xl bg-[#fff0ed] px-3 py-2 text-sm font-black text-[#e35e49]">
                                                    {store.firstPrizeCount}회
                                                </span>
                                            </td>
                                            <td className="py-6 px-6 text-center">
                                                <span className="inline-flex min-w-16 justify-center rounded-xl bg-[#edf3ff] px-3 py-2 text-sm font-black text-[#4771bd]">
                                                    {store.secondPrizeCount}회
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>

                    {/* 2. 모바일 버전: 카드 리스트 (md 미만에서 노출) */}
                    <div className="grid gap-3 p-3 md:hidden">
                        {isLoading ? (
                            [...Array(5)].map((_, i) => (
                                <div
                                    key={i}
                                    className="h-32 animate-pulse rounded-2xl bg-[#f1f2f6]"
                                >
                                </div>
                            ))
                        ) : filteredWinners.length > 0 ? (
                            <div className="grid gap-3">
                                {filteredWinners.map((store) => (
                                    <div
                                        key={store.id}
                                        className="lift-card rounded-2xl border border-[#e8eaf1] bg-white p-4"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f0f1f7] text-xs font-black text-[#626c80]">
                                                    {store.position}
                                                </span>
                                                <h3 className="truncate text-sm font-extrabold text-[#293248]">
                                                    {store.shopName}
                                                </h3>
                                            </div>
                                            <span className="rounded-xl bg-[#fff0ed] px-2.5 py-1.5 text-[10px] font-black text-[#e35e49]">
                                                1등 {store.firstPrizeCount}회
                                            </span>
                                        </div>
                                        <p className="mb-3 flex items-start gap-1 text-[10px] leading-4 text-[#969daf]">
                                            <MapPin size={11} className="mt-0.5 shrink-0" /> {store.address}
                                        </p>
                                        <div className="flex justify-end gap-2">
                                            <span className="rounded-lg bg-[#edf3ff] px-2.5 py-1.5 text-[10px] font-bold text-[#4771bd]">
                                                2등 {store.secondPrizeCount}회
                                            </span>
                                            {store.types.length > 0 && (
                                                <span className="rounded-lg bg-[#f2f3f6] px-2.5 py-1.5 text-[10px] font-bold text-[#7f8798]">
                                                    {store.types.join(" · ")}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-20 text-center text-sm font-semibold text-[#949cad]">
                                검색 결과가 없습니다.
                            </div>
                        )}
                    </div>

                    {/* 로딩 상태 (테이블용 공통) */}
                    {isLoading && (
                        <div className="hidden py-24 text-center md:block">
                            <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-4 border-[#dedff4] border-t-[#4f46e5]" />
                            <p className="text-xs font-extrabold tracking-[0.14em] text-[#6761d4]">LOADING</p>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
