"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    writeBatch,
    increment,
    serverTimestamp,
} from "firebase/firestore";
import Link from "next/link";

export default function LottoRefinePage() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [startDraw, setStartDraw] = useState(500);
    const [endDraw, setEndDraw] = useState(600);

    // 1. 매장 고유 ID 생성 (특수문자 방어 로직 강화)
    const getStoreId = (shopName: string, address: string) => {
        const combined = `${shopName}_${address}`;
        return combined
            .replace(/\s/g, "")      // 공백 제거
            .replace(/\//g, "_")      // 슬래시(/)를 언더바(_)로 치환 (핵심 에러 원인!)
            .replace(/\./g, "")       // 점(.) 제거
            .replace(/\[/g, "")       // 대괄호 제거
            .replace(/\]/g, "");      // 대괄호 제거
    };

    const startRefine = async () => {
        if (!confirm(`${startDraw}회부터 ${endDraw}회까지 정제를 시작할까요?`)) return;
        setLoading(true);

        try {
            setStatus(`${startDraw} ~ ${endDraw}회차 데이터 로드 중...`);

            const q = query(
                collection(db, "lotto_winners"),
                where("drawNo", ">=", startDraw),
                where("drawNo", "<=", endDraw)
            );
            const snapshot = await getDocs(q);
            const rawData = snapshot.docs.map((doc) => doc.data());

            if (rawData.length === 0) {
                alert("해당 회차에 데이터가 없습니다.");
                setLoading(false);
                return;
            }

            setStatus(`${rawData.length}개 데이터 집계 중...`);

            const storeMap = new Map();

            rawData.forEach((item) => {
                const storeId = getStoreId(item.shopName || "이름없음", item.address || "주소없음");
                if (!storeMap.has(storeId)) {
                    storeMap.set(storeId, {
                        shopName: item.shopName,
                        address: item.address,
                        lat: item.lat,
                        lng: item.lng,
                        firstCount: 0,
                        secondCount: 0,
                        maxDraw: 0,
                    });
                }

                const store = storeMap.get(storeId);
                if (item.rank === 1) store.firstCount += 1;
                if (item.rank === 2) store.secondCount += 1;
                if (item.drawNo > store.maxDraw) store.maxDraw = item.drawNo;
            });

            setStatus(`총 ${storeMap.size}개 매장 업데이트 중...`);

            let batch = writeBatch(db);
            let count = 0;

            for (const [id, data] of storeMap.entries()) {
                const storeRef = doc(db, "lotto_stores", id);

                batch.set(storeRef, {
                    shopName: data.shopName,
                    address: data.address,
                    lat: data.lat,
                    lng: data.lng,
                    firstPrizeCount: increment(data.firstCount),
                    secondPrizeCount: increment(data.secondCount),
                    lastUpdatedDraw: data.maxDraw,
                    updatedAt: serverTimestamp(),
                }, { merge: true });

                count++;

                // 400개마다 커밋하여 안전하게 처리
                if (count % 400 === 0) {
                    await batch.commit();
                    batch = writeBatch(db);
                    setStatus(`${count}개 완료...`);
                }
            }

            await batch.commit();
            alert(`정제 완료! ${rawData.length}개 기록을 ${storeMap.size}개 매장에 누적했습니다.`);

        } catch (error) {
            console.error(error);
            alert("정제 중 오류 발생: " + (error as Error).message);
        } finally {
            setLoading(false);
            setStatus("");
        }
    };

    return (
        <main className="min-h-screen bg-gray-50 flex items-center justify-center p-10 text-black">
            <div className="w-full max-w-md bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100">
                <Link href="/" className="text-blue-500 text-sm font-bold mb-4 inline-block">← 메인</Link>
                <h1 className="text-2xl font-black mb-2 italic text-blue-600">Lotto Refiner v2 🛠️</h1>
                <p className="text-[10px] text-gray-400 font-bold mb-8 uppercase tracking-widest">Store Aggregation System</p>

                <div className="space-y-6 mb-10">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-[10px] font-black text-gray-400 mb-2 ml-1">START</label>
                            <input
                                type="number" value={startDraw}
                                onChange={e => setStartDraw(Number(e.target.value))}
                                className="w-full border-2 border-gray-100 p-4 rounded-2xl text-center font-bold focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-[10px] font-black text-gray-400 mb-2 ml-1">END</label>
                            <input
                                type="number" value={endDraw}
                                onChange={e => setEndDraw(Number(e.target.value))}
                                className="w-full border-2 border-gray-100 p-4 rounded-2xl text-center font-bold focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                {status && (
                    <div className="mb-6 p-4 bg-blue-50 text-blue-600 rounded-2xl text-xs font-bold text-center animate-pulse border border-blue-100">
                        {status}
                    </div>
                )}

                <button
                    onClick={startRefine}
                    disabled={loading}
                    className={`w-full py-5 rounded-2xl text-white font-black shadow-lg transition-all active:scale-95 ${loading ? "bg-gray-300" : "bg-blue-600 hover:bg-blue-700"
                        }`}
                >
                    {loading ? "PROCESSING..." : "정제 프로세스 시작"}
                </button>
            </div>
        </main>
    );
}