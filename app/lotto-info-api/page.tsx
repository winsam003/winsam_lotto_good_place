"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { doc, writeBatch } from "firebase/firestore";
import Link from "next/link";

export default function LottoTestPage() {
  const [loading, setLoading] = useState(false);
  const [currentDraw, setCurrentDraw] = useState<number | null>(null);

  // 시작/종료 회차 상태 관리
  const [startDraw, setStartDraw] = useState<number>(1200);
  const [endDraw, setEndDraw] = useState<number>(1207);

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const fetchAndSaveRange = async () => {
    if (startDraw > endDraw) {
      alert("시작 회차가 종료 회차보다 클 수 없습니다.");
      return;
    }

    if (!confirm(`${startDraw}회부터 ${endDraw}회까지 수집을 시작할까요?`))
      return;

    setLoading(true);

    try {
      for (let i = startDraw; i <= endDraw; i++) {
        setCurrentDraw(i);
        console.log(`🚀 ${i}회차 수집 시작...`);

        const url = `https://www.dhlottery.co.kr/wnprchsplcsrch/selectLtWnShp.do?srchWnShpRnk=all&srchLtEpsd=${i}&srchShpLctn=&_=${Date.now()}`;

        const response = await fetch(url);
        if (!response.ok) {
          console.error(`${i}회차 호출 실패`);
          continue;
        }

        const result = await response.json();
        const winners = result.data.list;

        if (winners && winners.length > 0) {
          const batch = writeBatch(db);

          winners.forEach((item: any) => {
            const docId = `${i}_${item.ltShpId}_${item.rnum}`;
            const docRef = doc(db, "lotto_winners", docId);

            batch.set(docRef, {
              drawNo: i,
              shopName: item.shpNm,
              address: item.shpAddr,
              rank: item.wnShpRnk,
              type: item.atmtPsvYnTxt,
              lat: item.shpLat,
              lng: item.shpLot,
              createdAt: new Date(),
            });
          });

          await batch.commit();
          console.log(`✅ ${i}회차 저장 완료 (${winners.length}개 지점)`);
        }

        await sleep(1000); // 1초 휴식
      }

      alert("모든 회차 수집 및 저장이 완료되었습니다!");
    } catch (error) {
      console.error("❌ 에러 발생:", error);
      alert("수집 중 에러가 발생했습니다. 콘솔을 확인하세요.");
    } finally {
      setLoading(false);
      setCurrentDraw(null);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-10 font-sans text-black">
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-xl p-8 md:p-12 border border-gray-100">
        <Link
          href="/"
          className="text-blue-500 text-sm font-bold mb-6 inline-block"
        >
          ← 메인으로
        </Link>

        <h1 className="text-xl md:text-2xl font-black mb-2 text-gray-800">
          로또 데이터 수집기 🛠️
        </h1>
        <p className="text-sm text-gray-400 mb-8 font-medium">
          동행복권 데이터를 Firestore로 수집합니다.
        </p>

        <div className="space-y-6 mb-10">
          <div className="flex gap-4 items-center justify-between">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 mb-2 ml-1">
                START DRAW
              </label>
              <input
                type="number"
                value={startDraw}
                onChange={(e) => setStartDraw(Number(e.target.value))}
                className="w-full border-2 border-gray-100 p-4 rounded-2xl text-center font-bold focus:border-red-500 outline-none transition-all"
                disabled={loading}
              />
            </div>
            <div className="mt-6 font-bold text-gray-300">~</div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 mb-2 ml-1">
                END DRAW
              </label>
              <input
                type="number"
                value={endDraw}
                onChange={(e) => setEndDraw(Number(e.target.value))}
                className="w-full border-2 border-gray-100 p-4 rounded-2xl text-center font-bold focus:border-red-500 outline-none transition-all"
                disabled={loading}
              />
            </div>
          </div>

          {loading && (
            <div className="bg-blue-50 text-blue-600 p-4 rounded-2xl text-center text-sm font-bold animate-pulse">
              🚀 현재 {currentDraw}회차 수집 중...
            </div>
          )}
        </div>

        <button
          onClick={fetchAndSaveRange}
          disabled={loading}
          className={`w-full py-5 rounded-2xl text-white font-black shadow-lg transition-all active:scale-95 ${
            loading
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-red-500 hover:bg-red-600 shadow-red-200"
          }`}
        >
          {loading ? "DATA COLLECTING..." : "데이터 수집 시작"}
        </button>

        <div className="mt-8 space-y-2">
          <p className="text-[11px] text-gray-400 leading-relaxed text-center">
            * 차단 방지를 위해 회차당 1초의 딜레이가 적용됩니다.
            <br />* 대량 수집 시 Firestore 읽기/쓰기 할당량에 주의하세요.
          </p>
        </div>
      </div>
    </main>
  );
}
