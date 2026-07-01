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
import { AlertTriangle, ArrowLeft, Database } from "lucide-react";

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
        <main className="page-canvas soft-grid flex min-h-screen items-center justify-center p-4 md:p-10">
            <div className="surface-card w-full max-w-md animate-enter rounded-[2rem] p-7 md:p-9">
                <Link href="/" className="mb-7 inline-flex items-center gap-2 text-xs font-extrabold text-[#68738a] transition hover:text-[#4f46e5]"><ArrowLeft size={15} /> 메인으로</Link>
                <div className="mb-7 flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#4f46e5]"><Database size={20} /></span><div><p className="eyebrow">Admin tool</p><h1 className="mt-0.5 text-2xl font-black tracking-[-0.04em] text-[#172033]">매장 데이터 정제</h1></div></div>
                <div className="mb-7 flex gap-2 rounded-2xl border border-[#f1d8a9] bg-[#fff9ec] p-3.5 text-[11px] font-semibold leading-5 text-[#9a671d]"><AlertTriangle size={16} className="mt-0.5 shrink-0" />같은 회차를 다시 실행하면 집계 횟수가 중복 증가합니다.</div>

                <div className="space-y-6 mb-10">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.12em] text-[#8f97a8]">Start draw</label>
                            <input
                                type="number" value={startDraw}
                                onChange={e => setStartDraw(Number(e.target.value))}
                                className="focus-field w-full rounded-2xl border border-[#e3e5ee] bg-[#fafbfc] p-4 text-center font-extrabold outline-none"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.12em] text-[#8f97a8]">End draw</label>
                            <input
                                type="number" value={endDraw}
                                onChange={e => setEndDraw(Number(e.target.value))}
                                className="focus-field w-full rounded-2xl border border-[#e3e5ee] bg-[#fafbfc] p-4 text-center font-extrabold outline-none"
                            />
                        </div>
                    </div>
                </div>

                {status && (
                    <div className="mb-6 animate-pulse rounded-2xl border border-[#dfe2fb] bg-[#f1f2ff] p-4 text-center text-xs font-bold text-[#5651c9]">
                        {status}
                    </div>
                )}

                <button
                    onClick={startRefine}
                    disabled={loading}
                    className={`w-full rounded-2xl py-4 text-sm font-extrabold text-white shadow-lg transition-all active:scale-[0.98] ${loading ? "bg-[#c4c8d2]" : "bg-[#4f46e5] hover:bg-[#4338ca]"
                        }`}
                >
                    {loading ? "PROCESSING..." : "정제 프로세스 시작"}
                </button>
            </div>
        </main>
    );
}
